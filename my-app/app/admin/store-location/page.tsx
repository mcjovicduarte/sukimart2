"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import LocationPicker, { type Coordinates } from "../../shop/location-picker";
import { Alert, PageHeader } from "../ui";
import styles from "../admin.module.css";

export default function StoreLocationPage() {
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    void createClient().from("store_settings").select("latitude,longitude").eq("id", true).maybeSingle().then(({ data, error: loadError }) => {
      if (!active) return;
      if (loadError || !data) setError("Could not load the store location. Run supabase/store-location.sql in Supabase.");
      else setLocation([data.latitude, data.longitude]);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function save() {
    if (!location) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { error: saveError } = await createClient().rpc("set_store_location", { p_lat: location[0], p_lng: location[1] });
      if (saveError) throw new Error(saveError.message);
      setMessage("Store location saved. New delivery orders will use this location.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the store location.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <PageHeader eyebrow="Store settings" title="Store Location" description="Choose the active branch location used to calculate delivery minimums." />
    {error && <Alert tone="error">{error}</Alert>}
    {message && <Alert tone="success">{message}</Alert>}
    {loading ? <p>Loading store location…</p> : <>
      <p>Tap the map to pin the store, then save. This changes the active location for all customers, not just your account.</p>
      <LocationPicker value={location} onChange={(next) => { setLocation(next); setMessage(""); }} />
      <button type="button" className={`${styles.button} ${styles.primaryButton}`} disabled={!location || saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save store location"}
      </button>
    </>}
  </>;
}
