"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./delivery.module.css";

export default function ProfileEditor({ name, email }: { name: string; email: string }) {
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState(name);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [savedProfile, setSavedProfile] = useState({ name, phone: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const client = createClient();
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Please sign in again.");
        setLoading(false);
        return;
      }
      const { data, error: profileError } = await client.from("profiles")
        .select("phone,full_name").eq("user_id", user.id).single();
      if (!active) return;
      if (profileError) setError("Could not load your contact number. Ask the administrator to apply supabase/delivery-profile.sql.");
      else {
        const profile = { name: data.full_name || "", phone: data.phone || "" };
        setPhone(profile.phone);
        setFullName(profile.name);
        setSavedProfile(profile);
        setLoaded(true);
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!/^[+0-9 ()-]+$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 7) {
      setError("Enter a valid contact number with at least 7 digits.");
      return;
    }
    setSaving(true);
    try {
      const { error: saveError } = await createClient().rpc("update_delivery_profile", { p_full_name: fullName, p_phone: phone });
      if (saveError) throw saveError;
      setPhone(phone.trim());
      setFullName(fullName.trim());
      setSavedProfile({ name: fullName.trim(), phone: phone.trim() });
      setEditing(false);
      setMessage("Profile saved. Customers can see your name and number once you accept their order.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your contact number. Ask the administrator to apply supabase/delivery-profile.sql.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.card}>
      <h2>My profile</h2>
      <p><strong>Email:</strong> {email}</p>
      <p>Contact the administrator to change your sign-in email.</p>
      {loading ? <p>Loading contact information…</p> : loaded && (editing ? (
        <form className={styles.profileForm} onSubmit={save}>
          <label htmlFor="driver-name">Full name</label>
          <input id="driver-name" autoComplete="name" required maxLength={100} value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <label htmlFor="driver-phone">Contact number</label>
          <input id="driver-phone" type="tel" autoComplete="tel" required maxLength={25} value={phone} onChange={(event) => setPhone(event.target.value)} />
          <div className={styles.actions}>
            <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
            <button type="button" disabled={saving} onClick={() => {
              setFullName(savedProfile.name);
              setPhone(savedProfile.phone);
              setError("");
              setEditing(false);
            }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p><strong>Name:</strong> {savedProfile.name || "Not provided"}</p>
          <p><strong>Contact number:</strong> {savedProfile.phone || "Not provided"}</p>
          <div className={styles.actions}><button type="button" onClick={() => { setMessage(""); setError(""); setEditing(true); }}>Edit profile</button></div>
        </>
      ))}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
