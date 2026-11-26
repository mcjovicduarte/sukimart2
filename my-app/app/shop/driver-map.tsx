"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./customer-shop.module.css";

export default function DriverMap({ lat, lng, storeLat, storeLng }: { lat?: number; lng?: number; storeLat?: number; storeLng?: number }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let instance: LeafletMap | null = null;
    void import("leaflet").then((L) => {
      if (cancelled || !element.current) return;
      const hasLocation = lat != null && lng != null;
      const hasStore = storeLat != null && storeLng != null;
      instance = L.map(element.current).setView(hasLocation ? [lat, lng] : hasStore ? [storeLat, storeLng] : [7.9, 124.8], hasLocation ? 15 : hasStore ? 12 : 7);
      map.current = instance;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(instance);
      if (hasLocation) {
        L.circleMarker([lat, lng], { radius: 10, color: "#fff", weight: 3, fillColor: "#426c7d", fillOpacity: 1 })
          .addTo(instance).bindPopup("Driver's last shared location");
      } else if (hasStore) {
        L.circleMarker([storeLat, storeLng], { radius: 10, color: "#fff", weight: 3, fillColor: "#ba4f2d", fillOpacity: 1 })
          .addTo(instance).bindPopup("Store location");
      }
    }).catch(() => { if (!cancelled) setError("The map could not be loaded."); });
    return () => { cancelled = true; instance?.remove(); map.current = null; };
  }, [lat, lng, storeLat, storeLng]);
  return <>{error && <p role="alert">{error}</p>}<div className={styles.trackerMap} ref={element} role="img" aria-label={lat != null && lng != null ? "Map showing the driver's last shared location" : storeLat != null && storeLng != null ? "Map showing the store location" : "Map; location unavailable"} /></>;
}
