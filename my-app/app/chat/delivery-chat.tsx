"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./chat.module.css";

type Message = { id: string; sender_id: string; body: string; created_at: string };

export default function DeliveryChat({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [userId, setUserId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const panel = useRef<HTMLElement>(null);

  const refresh = useCallback(async () => {
    const client = createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) { setError("Please sign in to use messages."); setLoading(false); return; }
    const { data, error: queryError } = await client.from("delivery_messages")
      .select("id,sender_id,body,created_at").eq("order_id", orderId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(200);
    if (queryError) setError("Unable to load messages. Ask the store to run supabase/delivery-messages.sql.");
    else {
      const rows = ((data as Message[]) ?? []).reverse();
      setUserId(user.id);
      setMessages(rows);
      setError("");
      const incoming = rows.filter((item) => item.sender_id !== user.id).map((item) => item.id);
      if (incoming.length) {
        const { error: readError } = await client.rpc("mark_delivery_messages_read", { p_order_id: orderId, p_message_ids: incoming });
        if (readError) setError("Messages loaded, but read status is unavailable. Ask the store to run supabase/delivery-message-notifications.sql.");
        else window.dispatchEvent(new Event("delivery-messages-read"));
      }
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    void Promise.resolve().then(refresh);
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const { error: sendError } = await createClient().rpc("send_delivery_message", { p_order_id: orderId, p_body: draft });
      if (sendError) throw new Error(sendError.message);
      setDraft("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the message.");
    } finally { setSending(false); }
  }

  return <section ref={panel} className={styles.panel} aria-label="Order conversation">
    <div className={styles.heading}><h2>Order messages</h2><p>Messages are shared with the customer and assigned driver for this order.</p>
      <button type="button" onClick={onClose}>Close messages</button>
    </div>
    <div className={styles.conversation}>
      <div className={styles.messages} aria-live="polite">
        {loading ? <p>Loading messages…</p> : messages.length === 0 ? <p>No messages yet.</p> : messages.map((message) => (
          <div key={message.id} className={`${styles.bubble} ${message.sender_id === userId ? styles.mine : ""}`}>
            {message.body}<small>{new Date(message.created_at).toLocaleString()}</small>
          </div>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
      <form className={styles.form} onSubmit={send}>
        <textarea aria-label="Message" maxLength={2000} required value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" />
        <button type="submit" disabled={sending || !draft.trim()}>{sending ? "Sending…" : "Send"}</button>
      </form>
    </div>
  </section>;
}
