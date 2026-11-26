"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { Alert, PageHeader } from "../ui";
import styles from "../admin.module.css";

export default function DriversPage() {
  const [drivers, setDrivers] = useState<{ user_id: string; full_name: string; email: string; phone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDrivers = useCallback(async () => {
    const { data, error: loadError } = await createClient().from("profiles")
      .select("user_id,full_name,email,phone").eq("role", "delivery").order("full_name");
    if (loadError) setError("Could not load delivery drivers: " + loadError.message + ". Make sure supabase/driver-contact.sql has been applied.");
    else setDrivers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void Promise.resolve().then(loadDrivers); }, [loadDrivers]);

  async function removeDriver(userId: string) {
    if (!window.confirm("Permanently remove this delivery account? This cannot be undone.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/drivers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not update the driver.");
      setMessage("Delivery account removed.");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the driver.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/admin/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, phone }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not create the account.");
      setMessage(`Delivery account created for ${fullName.trim()}. Share the sign-in details securely.`);
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      await loadDrivers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader eyebrow="Team" title="Delivery Drivers" description="Manage delivery drivers and create accounts for your team." />
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <h2>Existing drivers</h2>
      {loading ? <p>Loading drivers…</p> : drivers.length === 0 ? <p>No delivery drivers yet.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Email</th><th>Contact number</th><th>Actions</th></tr></thead>
            <tbody>{drivers.map((driver) => (
              <tr key={driver.user_id}>
                <td>{driver.full_name}</td>
                <td>{driver.email}</td>
                <td>{driver.phone || "Not provided"}</td>
                <td>
                  <button type="button" className={`${styles.button} ${styles.dangerButton}`} disabled={busy} onClick={() => void removeDriver(driver.user_id)}>Remove</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className={styles.hint}>Drivers with assigned orders cannot be removed, to preserve order history.</p>
      <h2>Create driver account</h2>
      <form className={styles.form} onSubmit={submit} style={{ maxWidth: 520 }}>
        <label className={styles.field}><span>Full name</span>
          <input required maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className={styles.field}><span>Email</span>
          <input required type="email" maxLength={254} autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className={styles.field}><span>Contact number</span>
          <input required type="tel" maxLength={25} autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className={styles.field}><span>Password</span>
          <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <p className={styles.hint}>Use at least 8 characters. The driver can sign in at /delivery/login.</p>
        <div><button className={`${styles.button} ${styles.primaryButton}`} type="submit" disabled={busy}>{busy ? "Creating…" : "Create driver account"}</button></div>
      </form>
    </>
  );
}
