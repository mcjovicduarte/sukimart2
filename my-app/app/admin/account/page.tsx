"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { Alert, PageHeader } from "../ui";
import styles from "../admin.module.css";

export default function AdminAccountPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState({ name: "", phone: "" });
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = createClient();
        const { data: { user }, error: authError } = await client.auth.getUser();
        if (authError || !user) throw new Error("Please sign in again.");
        const { data, error: profileError } = await client.from("profiles").select("full_name,phone").eq("user_id", user.id).single();
        if (profileError || !data) throw new Error("Could not load your account. Run supabase/admin-profile.sql in Supabase.");
        if (!active) return;
        const profile = { name: data.full_name || "", phone: data.phone || "" };
        setEmail(user.email || "");
        setName(profile.name);
        setPhone(profile.phone);
        setSaved(profile);
        setLoaded(true);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load your account.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanPhone = phone.trim();
    if (cleanPhone && (!/^[+0-9 ()-]+$/.test(cleanPhone) || cleanPhone.replace(/\D/g, "").length < 7)) {
      setError("Enter a valid contact number with at least 7 digits.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { error: saveError } = await createClient().rpc("update_admin_profile", { p_full_name: name, p_phone: phone });
      if (saveError) throw new Error(saveError.message);
      setSaved({ name: name.trim(), phone: cleanPhone });
      setName(name.trim());
      setPhone(cleanPhone);
      setEditing(false);
      setMessage("Your account details have been saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your account.");
    } finally { setSaving(false); }
  }

  return <>
    <PageHeader eyebrow="Account" title="My Account" description="View and update your administrator profile." />
    {error && <Alert tone="error">{error}</Alert>}
    {message && <Alert tone="success">{message}</Alert>}
    {loading ? <p>Loading your account…</p> : loaded && (editing ? (
      <form className={styles.form} style={{ maxWidth: 520 }} onSubmit={save}>
        <label className={styles.field}><span>Full name</span><input required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className={styles.field}><span>Contact number</span><input type="tel" maxLength={25} autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
        <p className={styles.hint}>Contact number is optional. Email is managed by your sign-in account.</p>
        <div>
          <button type="submit" className={`${styles.button} ${styles.primaryButton}`} disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>{" "}
          <button type="button" className={`${styles.button} ${styles.secondaryButton}`} disabled={saving} onClick={() => { setName(saved.name); setPhone(saved.phone); setError(""); setEditing(false); }}>Cancel</button>
        </div>
      </form>
    ) : <>
      <p><strong>Name:</strong> {saved.name || "Not provided"}</p>
      <p><strong>Email:</strong> {email || "Not provided"}</p>
      <p><strong>Contact number:</strong> {saved.phone || "Not provided"}</p>
      <button type="button" className={`${styles.button} ${styles.primaryButton}`} onClick={() => { setError(""); setMessage(""); setEditing(true); }}>Edit profile</button>
    </>)}
  </>;
}
