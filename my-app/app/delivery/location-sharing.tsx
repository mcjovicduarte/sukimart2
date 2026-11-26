"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./delivery.module.css";

export default function LocationSharing({ orderId }: { orderId: string }) {
  const watch = useRef<number | null>(null);
  const sharing = useRef(false);
  const timer = useRef<number | null>(null);
  const latest = useRef<{ lat: number; lng: number; capturedAt: number } | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState("");

  function stop() {
    sharing.current = false;
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
    latest.current = null;
    watch.current = null;
    setActive(false);
    setMessage("Location sharing stopped.");
    void createClient().rpc("stop_delivery_location", { p_order_id: orderId });
  }

  const start = useCallback(() => {
    if (sharing.current) return;
    if (!navigator.geolocation) { setMessage("Your browser does not support location sharing."); return; }
    sharing.current = true;
    setActive(true);
    setMessage("Waiting for location permission and GPS…");
    async function publish(coordinates: { lat: number; lng: number }) {
      if (!sharing.current) return;
      try {
        const { error } = await createClient().rpc("share_delivery_location", {
          p_order_id: orderId, p_lat: coordinates.lat, p_lng: coordinates.lng,
        });
        if (sharing.current) setMessage(error ? `Unable to share location: ${error.message}` : "Your location is shared with this order's customer while this page is open.");
      } catch {
        if (sharing.current) setMessage("Unable to share location. Check your connection.");
      }
    }
    watch.current = navigator.geolocation.watchPosition((position) => {
      latest.current = { lat: position.coords.latitude, lng: position.coords.longitude, capturedAt: position.timestamp };
      void publish(latest.current);
    }, (error) => {
      latest.current = null;
      if (sharing.current) setMessage(`Location unavailable: ${error.message}`);
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 });
    timer.current = window.setInterval(() => {
      if (latest.current && Date.now() - latest.current.capturedAt < 60000) void publish(latest.current);
    }, 30000);
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    // Request browser permission after the accepted order appears.
    void Promise.resolve().then(() => { if (!cancelled) start(); });
    return () => {
      cancelled = true;
      sharing.current = false;
      if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
      if (timer.current !== null) window.clearInterval(timer.current);
      watch.current = null;
      timer.current = null;
      void createClient().rpc("stop_delivery_location", { p_order_id: orderId });
    };
  }, [orderId, start]);

  return <section className={styles.card}>
    <h2>Share delivery location</h2>
    <p>After accepting an order, your browser asks to share your GPS location with that customer. Keep this page open; you can stop sharing at any time.</p>
    <div className={styles.actions}><button type="button" onClick={active ? stop : start}>{active ? "Stop sharing location" : "Share my location"}</button></div>
    {message && <p role="status">{message}</p>}
  </section>;
}
