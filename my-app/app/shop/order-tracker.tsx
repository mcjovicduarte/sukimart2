"use client";

import { useEffect, useState } from "react";
import { Phone, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatOrderCode } from "@/utils/format";
import styles from "./customer-shop.module.css";
import DriverMap from "./driver-map";

type Tracking = { status: string; delivery_status: string; payment_method: string | null };
type Contact = { order_id: string; full_name: string; phone: string | null };
type Location = { lat: number; lng: number; updated_at: string };
const steps = ["Order placed", "Preparing", "On the way", "Delivered"];

export default function OrderTracker({ orderId, onClose, onMessageDriver }: { orderId: string; onClose: () => void; onMessageDriver: () => void }) {
  const [order, setOrder] = useState<Tracking | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [error, setError] = useState("");
  const [contactError, setContactError] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [store, setStore] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const client = createClient();
        const [orderResult, contactResult, locationResult, storeResult] = await Promise.all([
          client.from("orders").select("status,delivery_status,payment_method").eq("id", orderId).single(),
          client.rpc("customer_delivery_contacts"),
          client.rpc("customer_delivery_location", { p_order_id: orderId }),
          client.from("store_settings").select("latitude,longitude").eq("id", true).maybeSingle(),
        ]);
        if (!active) return;
        if (orderResult.error || !orderResult.data) {
          setError("Unable to load this order. Please try again.");
          return;
        }
        setOrder(orderResult.data as Tracking);
        setError("");
        setContactError(Boolean(contactResult.error));
        setContact(contactResult.error ? null : ((contactResult.data as Contact[] | null) ?? []).find((item) => item.order_id === orderId) ?? null);
        setLocationError(Boolean(locationResult.error));
        setLocation(locationResult.error ? null : ((locationResult.data as Location[] | null) ?? [])[0] ?? null);
        setStore(storeResult.data ?? null);
      } catch {
        if (active) setError("Unable to refresh tracking. Check your connection.");
      }
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [orderId]);

  const progress = order ? ({ new: 0, pending: 0, preparing: 1, processing: 1, on_the_way: 2, completed: 3 } as Record<string, number>)[order.status] : undefined;
  const pickup = order?.payment_method === "Pickup and pay at store";
  const dialNumber = contact?.phone?.replace(/[^+0-9]/g, "") || "";

  return (
    <div className={styles.modalOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby="tracker-title">
        <div className={styles.modalHeader}>
          <div><h2 id="tracker-title">Order tracker</h2><p>Order {formatOrderCode(orderId)}</p></div>
          <button type="button" className={styles.modalClose} aria-label="Close tracker" onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.checkoutBody}>
          {error && <p className={styles.locationError} role="alert">{error}</p>}
          {!order && !error && <p role="status">Loading order tracker…</p>}
          {order && <>
            {order.status === "cancelled" ? <p><strong>This order was cancelled.</strong></p> : progress === undefined ? (
              <p>Current status: {order.status.replace(/_/g, " ")}</p>
            ) : (
              <ol className={styles.trackerSteps} aria-label="Order progress">
                {steps.map((step, index) => (
                  <li key={step} className={index <= progress ? styles.trackerStepActive : ""} aria-current={index === progress ? "step" : undefined}>
                    <span>{index < progress ? "✓" : index + 1}</span>
                    {pickup && index === 2 ? "Ready for pickup" : step}
                    {index === progress && <strong>Current</strong>}
                  </li>
                ))}
              </ol>
            )}
            {!pickup && order.status !== "cancelled" && <div className={styles.trackerDriver}>
              <strong>Delivery driver</strong>
              {contact ? <>
                <p>{contact.full_name || "Delivery driver"}</p>
                {dialNumber ? <>
                  <p>{contact.phone}</p>
                  <a className={styles.trackerCall} href={`tel:${dialNumber}`}><Phone size={16} /> Call driver</a>
                </> : <p>Contact number not available yet.</p>}
              </> : <p>{contactError ? "Driver details are temporarily unavailable." : "Driver details appear after the driver accepts your order."}</p>}
              {order.status !== "completed" && ["confirmed", "out_for_delivery"].includes(order.delivery_status) && (
                <p><button type="button" className={styles.trackerCall} onClick={onMessageDriver}>Message driver</button></p>
              )}
            </div>}
            {!pickup && <div className={styles.trackerDriver}>
              <strong>{location ? "Driver location" : "Store location"}</strong>
              <DriverMap lat={location?.lat} lng={location?.lng} storeLat={store?.latitude} storeLng={store?.longitude} />
              {location ? <p>Last updated: {new Date(location.updated_at).toLocaleTimeString()}</p> :
                <p>{order.status === "completed" ? "Delivery is complete. The driver's location is no longer shared." :
                  order.status === "cancelled" ? "This order was cancelled. No driver location is available." :
                  locationError ? "Driver location tracking is temporarily unavailable; the store location is shown." :
                  contact ? "Showing the store. The driver's location appears when they allow location sharing." :
                  "Showing the store. The driver's location appears after they accept and allow location sharing."}</p>}
            </div>}
            <p className={styles.trackerHint}>Updates every 15 seconds. Driver location is shown only while the driver shares it for this order.</p>
          </>}
        </div>
      </section>
    </div>
  );
}
