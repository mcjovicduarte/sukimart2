"use client";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import LocationPicker, { type Coordinates } from "./location-picker";
import styles from "./customer-shop.module.css";

export default function AccountEditor({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (address: string, location: Coordinates) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      const client = createClient();
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }
      setEmail(user.email || "");
      const result = await client
        .from("profiles")
        .select("full_name,phone,delivery_address,delivery_lat,delivery_lng")
        .eq("user_id", user.id)
        .single();
      if (!active) return;
      if (result.error)
        setError(
          `${result.error.message} — ask the store to run supabase/customer-profile.sql.`,
        );
      else {
        setName(result.data.full_name || "");
        setPhone(result.data.phone || "");
        setAddress(result.data.delivery_address || "");
        if (
          result.data.delivery_lat != null &&
          result.data.delivery_lng != null
        )
          setLocation([result.data.delivery_lat, result.data.delivery_lng]);
      }
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!location) {
      setError("Pin your store or delivery location on the map.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await createClient().rpc(
      "update_customer_profile",
      {
        p_full_name: name,
        p_phone: phone,
        p_address: address,
        p_lat: location[0],
        p_lng: location[1],
      },
    );
    setSaving(false);
    if (saveError) setError(saveError.message);
    else onSaved(address.trim(), location);
  };
  return (
    <div className={styles.modalOverlay}>
      <form className={styles.checkoutModal} onSubmit={save}>
        <div className={styles.modalHeader}>
          <div>
            <h2>My account</h2>
            <p>Save your details and default delivery location.</p>
          </div>
          <button
            className={styles.modalClose}
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className={styles.checkoutBody}>
          {loading ? (
            <p>Loading account…</p>
          ) : (
            <>
              <label className={styles.field}>
                <span>Full name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Email (managed by your sign-in account)</span>
                <input value={email} readOnly />
              </label>
              <label className={styles.field}>
                <span>Contact number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Complete delivery address</span>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Store name, street, barangay, city, province"
                  required
                />
              </label>
              <LocationPicker value={location} onChange={setLocation} />
              <p className={styles.checkoutHint}>
                Check the pin carefully. Existing orders keep the address and
                pin they were placed with.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className={styles.locationError}>
              {error}
            </p>
          )}
        </div>
        <div className={styles.checkoutFooter}>
          <button
            type="button"
            className={`${styles.checkoutButton} ${styles.checkoutSecondary}`}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.checkoutButton}
            disabled={loading || saving}
          >
            {saving ? "Saving…" : "Save account"}
          </button>
        </div>
      </form>
    </div>
  );
}
