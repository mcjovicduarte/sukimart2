"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, LocateFixed, MapPin, Navigation, Search } from "lucide-react";
import type { Map as LeafletMap } from "leaflet";
import { createClient } from "@/utils/supabase/client";
import { formatDateTime, formatPeso } from "@/utils/format";
import "leaflet/dist/leaflet.css";
import styles from "./delivery.module.css";
import ProfileEditor from "./profile-editor";
import LocationSharing from "./location-sharing";
import DeliveryChat from "../chat/delivery-chat";

type Order = {
  id: string;
  order_number?: number | string | null;
  customer_id: string;
  status: string;
  delivery_status: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  delivered_at: string | null;
  created_at: string;
  total: number;
  order_items: { product_name: string; quantity: number }[];
};
type Profile = { user_id: string; full_name: string; phone?: string };
const labels: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};
export default function Dashboard({
  name,
  email,
  storeLocation,
}: {
  name: string;
  email: string;
  storeLocation: [number, number] | null;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [view, setView] = useState("Dashboard");
  const [selected, setSelected] = useState<string>("");
  const [chatOrder, setChatOrder] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [numberingAvailable, setNumberingAvailable] = useState(true);
  const [destination, setDestination] = useState<[number, number] | null>(null);
  const [gps, setGps] = useState<[number, number] | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [manualLocation, setManualLocation] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [mapVersion, setMapVersion] = useState(0);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const updatingRef = useRef(false);
  const [route, setRoute] = useState<{
    key: string;
    points: [number, number][];
  } | null>(null);
  const [routeMessage, setRouteMessage] = useState<{
    key: string;
    text: string;
  } | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const acceptedOrders = orders.filter((o) =>
    ["confirmed", "out_for_delivery"].includes(o.delivery_status) &&
    !["cancelled", "completed"].includes(o.status),
  );
  const order = acceptedOrders.find((o) => o.id === selected) ?? acceptedOrders[0];
  const orderId = order?.id;
  const orderLat = order?.delivery_lat;
  const orderLng = order?.delivery_lng;
  const orderAddress = order?.delivery_address;
  const origin = gps ?? storeLocation;
  const routeKey = destination && origin ? `${origin[0]},${origin[1]}:${destination[0]},${destination[1]}` : "";
  const load = useCallback(async () => {
    const client = createClient();
    const [o, p] = await Promise.all([
      client
        .from("orders")
        .select(
          "id,order_number,customer_id,status,delivery_status,delivery_address,delivery_lat,delivery_lng,delivered_at,created_at,total,order_items(product_name,quantity)",
        )
        .order("created_at", { ascending: false }),
      client.from("profiles").select("user_id,full_name,phone"),
    ]);
    let orderData: unknown = o.data;
    let orderError = o.error;
    if (o.error && (o.error.code === "42703" || o.error.message.includes("order_number"))) {
      setNumberingAvailable(false);
      const fallback = await client.from("orders").select("id,customer_id,status,delivery_status,delivery_address,delivery_lat,delivery_lng,delivered_at,created_at,total,order_items(product_name,quantity)").order("created_at", { ascending: false });
      orderData = fallback.data;
      orderError = fallback.error;
    } else if (!o.error) {
      setNumberingAvailable(true);
    }
    if (orderError) {
      setMessage(orderError.message + " — run supabase/delivery.sql first.");
      return;
    }
    const profileRows = p.error
      ? await client.from("profiles").select("user_id,full_name")
      : p;
    setOrders((orderData as Order[]) || []);
    setProfiles(profileRows.data || []);
  }, []);
  // The initial fetch updates state only after the database request completes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  useEffect(() => {
    // Realtime is optional in Supabase; polling also keeps assignments current
    // when the orders table is not enabled for the realtime publication.
    const timer = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  useEffect(() => {
    if (!orderId) return;
    // Only saved coordinates are shown automatically; address lookups require an explicit action.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDestination(
      orderLat != null && orderLng != null ? [orderLat, orderLng] : null,
    );
  }, [orderId, orderLat, orderLng]);
  useEffect(() => {
    if (
      view !== "Map and Navigation" ||
      !orderId ||
      !orderAddress ||
      (orderLat != null && orderLng != null)
    )
      return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "1",
      countrycodes: "ph",
      viewbox: "118.5,10.4,127,4.3",
      bounded: "1",
      q: orderAddress,
    });
    void fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Address lookup is unavailable.");
        const results = await response.json();
        if (!results.length)
          throw new Error(
            "Address not found. Ask the customer to provide a precise pin or use Start Direction in Google Maps.",
          );
        const lat = Number(results[0].lat),
          lng = Number(results[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng))
          throw new Error("Address lookup returned an invalid location.");
        if (!controller.signal.aborted) {
          setDestination([lat, lng]);
          setMessage(
            "Address lookup is approximate; verify the customer location before delivery.",
          );
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "Address lookup unavailable.",
          );
      });
    return () => controller.abort();
  }, [view, orderId, orderAddress, orderLat, orderLng]);
  useEffect(() => {
    if (view !== "Map and Navigation" || !orderId || !destination || !routeKey || !origin) return;
    const controller = new AbortController();
    const [lat, lng] = destination;
    void fetch(
      `https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${lng},${lat}?overview=full&geometries=geojson`,
      { signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("Routing service unavailable.");
        const result = await response.json();
        const coordinates = result.routes?.[0]?.geometry?.coordinates;
        if (
          result.code !== "Ok" ||
          !Array.isArray(coordinates) ||
          coordinates.length < 2
        )
          throw new Error("No driving route found for this location.");
        const points: [number, number][] = coordinates.map(
          (point: [number, number]) => [point[1], point[0]],
        );
        if (!controller.signal.aborted) {
          setRoute({ key: routeKey, points });
          setRouteMessage({
            key: routeKey,
            text: gps
              ? `Blue line: suggested driving route from your ${manualLocation ? "selected" : "current"} location. Verify road conditions and destination.`
              : "Blue line: suggested driving route from the store. Use your location to route from where you are.",
          });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setRouteMessage({
            key: routeKey,
            text: `${error instanceof Error ? error.message : "Route unavailable."} Use Start Direction to open Google Maps.`,
          });
      });
    return () => controller.abort();
  }, [view, orderId, destination, routeKey, origin, gps, manualLocation]);
  useEffect(() => {
    if (view !== "Map and Navigation" || !orderId || !mapRef.current || !storeLocation) return;
    let cancelled = false;
    let instance: LeafletMap | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current) return;
      const bounds = L.latLngBounds([4.3, 118.5], [10.4, 127]);
      instance = L.map(mapRef.current, {
        maxBounds: bounds,
        maxBoundsViscosity: 1,
        minZoom: 6,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView(storeLocation, 15, { animate: false });
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(instance);
      L.circleMarker(storeLocation, {
        color: "#7442b8",
        radius: 10,
        fillOpacity: 0.8,
      })
        .addTo(instance)
        .bindPopup("Store location");
      setMapVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
      if (instance) {
        instance.stop();
        instance.off();
        instance.remove();
        if (map.current === instance) map.current = null;
      }
    };
  }, [view, orderId, storeLocation]);

  useEffect(() => {
    const instance = map.current;
    if (view !== "Map and Navigation" || !instance || !mapVersion || !storeLocation) return;
    let cancelled = false;
    let layers: import("leaflet").LayerGroup | null = null;
    let onMapClick: ((event: import("leaflet").LeafletMouseEvent) => void) | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || map.current !== instance) return;
      layers = L.layerGroup().addTo(instance);
      const customerIcon = L.divIcon({
        className: "",
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42" aria-hidden="true"><path d="M17 1C8.2 1 1 8.2 1 17c0 11.1 16 23.6 16 23.6S33 28.1 33 17C33 8.2 25.8 1 17 1Z" fill="#dc4a36" stroke="white" stroke-width="2"/><circle cx="17" cy="16.5" r="5.5" fill="white"/></svg>',
        iconSize: [34, 42], iconAnchor: [17, 41], popupAnchor: [0, -39],
      });
      const truckIcon = L.divIcon({
        className: "",
        html: '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="19" fill="#166ad3" stroke="white" stroke-width="3"/><path d="M8 13h17v13H8zM25 17h5l4 5v4h-9z" fill="white"/><path d="M27 19h2l2 3h-4z" fill="#166ad3"/><circle cx="14" cy="28" r="3" fill="white" stroke="#166ad3" stroke-width="1.5"/><circle cx="29" cy="28" r="3" fill="white" stroke="#166ad3" stroke-width="1.5"/></svg>',
        iconSize: [42, 42], iconAnchor: [21, 21], popupAnchor: [0, -21],
      });
      if (destination)
        L.marker(destination, { icon: customerIcon, title: "Customer destination", alt: "Customer destination" })
          .addTo(layers)
          .bindPopup("Customer destination");
      if (gps)
        L.marker(gps, { icon: truckIcon, title: manualLocation ? "Manually selected driver location" : "Delivery person location", alt: manualLocation ? "Manually selected driver location" : "Delivery person location" })
          .addTo(layers)
          .bindPopup(
            manualLocation
              ? "Your manually selected location"
              : "Your device location",
          );
      if (gps && !manualLocation && accuracy != null)
        L.circle(gps, {
          radius: accuracy,
          color: "#1671ce",
          weight: 1,
          fillOpacity: 0.1,
        }).addTo(layers);
      if (destination && route?.key === routeKey) {
        const line = L.polyline(route.points, {
          color: "#166ad3",
          weight: 5,
        }).addTo(layers);
        const visibleBounds = line.getBounds().extend(storeLocation).extend(destination);
        if (gps) visibleBounds.extend(gps);
        instance.fitBounds(
          visibleBounds,
          { padding: [40, 40], maxZoom: 16, animate: false },
        );
      } else if (destination)
        instance.fitBounds(L.latLngBounds(gps ? [storeLocation, destination, gps] : [storeLocation, destination]), {
          padding: [40, 40],
          maxZoom: 16,
          animate: false,
        });
      else if (gps) instance.setView(gps, 15, { animate: false });
      if (pickingLocation) {
        onMapClick = (event) => {
          setGps([event.latlng.lat, event.latlng.lng]);
          setManualLocation(true);
          setAccuracy(null);
          setPickingLocation(false);
          setMessage(
            "Your manually selected starting location is shown in blue. Tap Set location on map again to change it.",
          );
        };
        instance.on("click", onMapClick);
      }
    });
    return () => {
      cancelled = true;
      if (map.current === instance) {
        if (onMapClick) instance.off("click", onMapClick);
        layers?.remove();
      }
    };
  }, [
    view,
    destination,
    gps,
    pickingLocation,
    manualLocation,
    accuracy,
    route,
    routeKey,
    mapVersion,
    storeLocation,
  ]);
  const lookup = async () => {
    if (!order?.delivery_address) {
      setMessage("This order has no delivery address.");
      return;
    }
    try {
      const params = new URLSearchParams({
        format: "jsonv2",
        limit: "1",
        countrycodes: "ph",
        viewbox: "118.5,10.4,127,4.3",
        bounded: "1",
        q: order.delivery_address,
      });
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
      );
      const results = await res.json();
      if (!res.ok)
        throw new Error(
          "Address lookup is temporarily unavailable. You can still use Start Direction to search in Google Maps.",
        );
      if (!results.length)
        throw new Error(
          "No matching address found in the Mindanao map area. Include the street, barangay, city and province, or use Start Direction in Google Maps.",
        );
      setDestination([Number(results[0].lat), Number(results[0].lon)]);
      setMessage(
        "Approximate address lookup result. Verify the destination before delivering.",
      );
    } catch (e) {
      setMessage(
        e instanceof TypeError
          ? "Unable to reach the address lookup service. Check your internet connection or use Start Direction in Google Maps."
          : e instanceof Error
            ? e.message
            : "Address lookup failed.",
      );
    }
  };
  const useLocation = () => {
    if (!window.isSecureContext) {
      setMessage(
        "Location requires HTTPS, or localhost on this computer. If using a phone over your local network, open the app over HTTPS.",
      );
      return;
    }
    if (!navigator.geolocation) {
      setMessage("This browser does not support location services.");
      return;
    }
    setMessage(
      "Finding your location. Please allow location access in your browser.",
    );
    const onSuccess = (p: GeolocationPosition) => {
      const { latitude, longitude } = p.coords;
      if (
        latitude < 4.3 ||
        latitude > 10.4 ||
        longitude < 118.5 ||
        longitude > 127
      ) {
        setMessage(
          "Your reported location is outside the Mindanao map area. Check your device location settings or set your location on the map.",
        );
        return;
      }
      setGps([latitude, longitude]);
      setAccuracy(p.coords.accuracy);
      setManualLocation(false);
      setPickingLocation(false);
      setMessage(
        `Your location is marked in blue. Estimated accuracy: ${Math.round(p.coords.accuracy)} metres.`,
      );
    };
    const onError = (error: GeolocationPositionError) =>
      setMessage(
        error.code === error.PERMISSION_DENIED
          ? "Location access was denied. Allow location for this site in your browser and device settings, then try again."
          : error.code === error.TIMEOUT
            ? "Location request timed out. Turn on your device location and try again outdoors or with a better signal."
            : "Your device could not determine its location. Turn on location services and try again.",
      );
    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          onError(error);
          return;
        }
        setMessage(
          "Precise GPS is unavailable. Trying your device's approximate location...",
        );
        navigator.geolocation.getCurrentPosition(onSuccess, onError, {
          enableHighAccuracy: false,
          timeout: 20000,
          maximumAge: 0,
        });
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  const advance = async (id: string, status: string) => {
    if (updatingRef.current) return;
    if (
      status === "delivered" &&
      !window.confirm(
        "Has the customer received this order? Marking it delivered will complete the order.",
      )
    )
      return;
    updatingRef.current = true;
    setUpdatingOrder(id);
    try {
      const { error } = await createClient().rpc("delivery_advance", {
        p_order_id: id,
        p_status: status,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setMessage(
        status === "delivered"
          ? "Order marked as delivered. The customer and admin have been notified."
          : status === "confirmed"
            ? "Order accepted. The customer and admin have been notified."
            : "Delivery status updated successfully.",
      );
      await load();
      if (status === "confirmed") {
        setDestination(null);
        setSelected(id);
        setView("Map and Navigation");
      }
    } catch {
      setMessage(
        "Could not update the order. Check your connection and try again.",
      );
    } finally {
      updatingRef.current = false;
      setUpdatingOrder(null);
    }
  };
  const sections = [
    "Dashboard",
    "Assigned Orders",
    "Map and Navigation",
    "Delivery History",
    "Account/Profile",
  ];
  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <h2 className={styles.brand}><Image src="/sukimart-logo.png" alt="" width={48} height={36} className={styles.logo} />SukiMart</h2>
        <p>DELIVERY PARTNER</p>
        {sections.map((s) => (
          <button
            key={s}
            className={view === s ? styles.active : ""}
            type="button"
            aria-pressed={view === s}
            onClick={() => setView(s)}
          >
            {s}
          </button>
        ))}
        <button
          onClick={async () => {
            await createClient().auth.signOut();
            router.replace("/delivery/login");
            router.refresh();
          }}
        >
          Logout
        </button>
      </aside>
      <main className={styles.main}>
        <header>
          <p>DELIVERY WORKSPACE</p>
          <h1>{view}</h1>
          <span>Welcome, {name}</span>
        </header>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        {!numberingAvailable && <p role="status" className={styles.notice}>Order numbering is not set up yet. Run supabase/order-numbering.sql in the Supabase SQL Editor.</p>}
        {!storeLocation && <p role="status" className={styles.notice}>Store location unavailable. Ask an administrator to configure the store location.</p>}
        {chatOrder && <DeliveryChat orderId={chatOrder} onClose={() => setChatOrder(null)} />}
        {orders.filter((item) => ["new", "preparing", "on_the_way"].includes(item.status) && ["confirmed", "out_for_delivery"].includes(item.delivery_status)).map((item) => (
          <LocationSharing key={item.id} orderId={item.id} />
        ))}
        {view === "Account/Profile" ? (
          <ProfileEditor name={name} email={email} />
        ) : null}
        {view === "Dashboard" && (
          <div className={styles.stats}>
            {[
              ["Total Assigned Orders", orders.length],
              ...Object.entries(labels).map(([key, label]) => [
                label,
                orders.filter((o) => o.delivery_status === key).length,
              ]),
            ].map(([label, value]) => (
              <div className={styles.card} key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
        {view === "Map and Navigation" && !order && (
          <section className={styles.card}>
            <h2>No accepted order</h2>
            <p>Accept an assigned order to see its delivery directions here.</p>
            <div className={styles.actions}><button type="button" onClick={() => setView("Assigned Orders")}>View assigned orders</button></div>
          </section>
        )}
        {view === "Map and Navigation" && order && (
          <section className={styles.card}>
            <div className={styles.navigationLayout}>
              <div className={styles.navigationDetails}>
            {order ? (
              <div className={styles.selectedOrder}>
                <h2>{order.order_number != null ? `Order #${order.order_number}` : "Order number unavailable"}</h2>
                <p><strong>Order ID:</strong> {order.id}</p>
                <p><strong>Customer:</strong> {profiles.find(profile => profile.user_id === order.customer_id)?.full_name || "Customer"}</p>
              </div>
            ) : (
              <div className={styles.selectedOrder}>
                <h2>No order selected</h2>
                <p>Choose an order from Assigned Orders to see its delivery details and map.</p>
                <button type="button" className={styles.chooseOrder} onClick={() => setView("Assigned Orders")}>View assigned orders</button>
              </div>
            )}
            <p className={styles.navigationLabel}>Customer delivery address</p>
            <p className={styles.addressBox}>
              {order?.delivery_address || "Select an order to see its address."}
            </p>
            {order && <p className={styles.addressHint}>This address and its saved pin are from the order. Verify approximate address lookups before delivery.</p>}
            <p>
              The purple marker shows the configured store location. Confirm the map position before relying on it.
            </p>
            <p>Red pin: customer destination · Blue truck: your GPS or manually selected location.</p>
            <div className={styles.navigationActions}>
              {order &&
                (order.delivery_address || (order.delivery_lat != null && order.delivery_lng != null)) && (
                  <a className={styles.navigationPrimary} target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.delivery_lat != null && order.delivery_lng != null ? `${order.delivery_lat},${order.delivery_lng}` : `${order.delivery_address}, Philippines`)}&travelmode=driving&dir_action=navigate`}>
                    <Navigation size={18} aria-hidden="true" /> Start Direction
                  </a>
                )}
              <p className={styles.navigationGroupLabel}>Location tools</p>
              <div className={styles.locationTools}>
              <button onClick={lookup} disabled={!order?.delivery_address}>
                <Search size={16} aria-hidden="true" /> Look up address
              </button>
              <button onClick={useLocation}><LocateFixed size={16} aria-hidden="true" /> Use my location</button>
              <button
                onClick={() => {
                  setPickingLocation(!pickingLocation);
                  setMessage(
                    pickingLocation
                      ? "Manual location selection cancelled."
                      : "Tap your current position on the map to set your starting point.",
                  );
                }}
              >
                <MapPin size={16} aria-hidden="true" /> {pickingLocation
                  ? "Cancel location selection"
                  : "Set location on map"}
              </button>
              </div>
              {order?.delivery_status === "out_for_delivery" && order.status === "on_the_way" && (
                <button className={styles.deliveredAction} disabled={updatingOrder !== null} onClick={() => advance(order.id, "delivered")}><CheckCircle2 size={17} aria-hidden="true" /> {updatingOrder === order.id ? "Saving…" : "Mark as Delivered"}</button>
              )}
            </div>
            <p>Start Direction opens Google Maps using the device’s current location when available. Google Maps may ask for location permission or require you to tap Start.</p>
            {!destination && !gps && (
              <p>
                The purple marker shows the shop. Select an assigned order and
                look up its address, or set your location.
              </p>
            )}
            {pickingLocation && (
              <p>Tap the map where you are currently located.</p>
            )}
            {orders.length === 0 && (
              <p>
                No orders assigned yet. Ask an administrator to assign one to
                your account.
              </p>
            )}
            {destination && (
              <p role="status">
                {routeMessage?.key === routeKey
                  ? routeMessage.text
                  : gps ? "Finding a driving route from your location…" : "Finding a driving route from the store…"}
              </p>
            )}
              </div>
              <div className={styles.navigationMap}>
                <h2>Delivery map</h2>
                <div ref={mapRef} className={styles.map} aria-label="Map showing the shop, delivery route and customer destination" />
              </div>
            </div>
          </section>
        )}
        {["Dashboard", "Assigned Orders", "Delivery History"].includes(
          view,
        ) && (
          <section>
            <h2>
              {view === "Delivery History"
                ? "Delivered orders"
                : "Your assigned orders"}
            </h2>
            {orders
              .filter((o) =>
                view === "Delivery History"
                  ? o.delivery_status === "delivered"
                  : o.delivery_status !== "delivered",
              )
              .map((o) => (
                <article className={styles.card} key={o.id}>
                  <div className={styles.row}>
                    <div><h3>{o.order_number != null ? `Order #${o.order_number}` : "Order number unavailable"}</h3><p className={styles.orderId}>Order ID: {o.id}</p></div>
                    <span
                      className={`${styles.badge} ${styles[o.delivery_status]}`}
                    >
                      {labels[o.delivery_status]}
                    </span>
                  </div>
                  <p>
                    <b>
                      {profiles.find((p) => p.user_id === o.customer_id)
                        ?.full_name || "Customer"}
                    </b>{" "}
                    · {formatDateTime(o.created_at)}
                  </p>
                  <p>{o.delivery_address || "No delivery address provided"}</p>
                  <p>
                    {profiles.find((p) => p.user_id === o.customer_id)?.phone ||
                      "Contact number not available"}
                  </p>
                  <p>
                    {o.order_items
                      .map((i) => `${i.product_name} × ${i.quantity}`)
                      .join(", ")}
                  </p>
                  <p>
                    <b>{formatPeso(o.total)}</b>
                    {o.delivered_at &&
                      ` · Delivered ${formatDateTime(o.delivered_at)}`}
                  </p>
                  <div className={styles.actions}>
                    {["confirmed", "out_for_delivery", "delivered"].includes(o.delivery_status) && o.status !== "cancelled" && <>
                      <button type="button" onClick={() => setChatOrder(o.id)}>Message customer</button>
                      {profiles.find((p) => p.user_id === o.customer_id)?.phone && (
                        <a href={`tel:${profiles.find((p) => p.user_id === o.customer_id)!.phone!.replace(/[^+0-9]/g, "")}`}>Call customer</a>
                      )}
                    </>}
                    {["confirmed", "out_for_delivery"].includes(o.delivery_status) && !["completed", "cancelled"].includes(o.status) && <button
                      onClick={() => {
                        if (selected !== o.id) setDestination(null);
                        setSelected(o.id);
                        setView("Map and Navigation");
                      }}
                    >
                      View map & details
                    </button>}
                    {o.delivery_status === "pending" &&
                      o.status !== "cancelled" &&
                      o.status !== "completed" && (
                        <button
                          disabled={updatingOrder !== null}
                          onClick={() => advance(o.id, "confirmed")}
                        >
                          {updatingOrder === o.id ? "Accepting…" : "Accept order"}
                        </button>
                      )}
                    {o.delivery_status === "confirmed" &&
                      o.status === "preparing" && (
                        <button
                          disabled={updatingOrder !== null}
                          onClick={() => advance(o.id, "out_for_delivery")}
                        >
                          Start Delivery
                        </button>
                      )}
                    {o.delivery_status === "confirmed" &&
                      o.status === "new" && (
                        <small>
                          Waiting for the store to prepare this order.
                        </small>
                      )}
                    {o.delivery_status === "out_for_delivery" &&
                      o.status === "on_the_way" && (
                        <button
                          disabled={updatingOrder !== null}
                          onClick={() => advance(o.id, "delivered")}
                        >
                          {updatingOrder === o.id
                            ? "Saving…"
                            : "Mark as Delivered"}
                        </button>
                      )}
                  </div>
                </article>
              ))}
            {orders.length === 0 && <p>No assigned orders yet. Available drivers are automatically assigned waiting delivery orders.</p>}
          </section>
        )}
      </main>
    </div>
  );
}
