"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { createClient } from "@/utils/supabase/client";
import { Phone } from "lucide-react";
import ProductImage from "../product-image";
import styles from "./chat.module.css";

type Message = {
  id: string;
  customer_id: string;
  sender_id: string;
  body: string;
  attachment_path: string | null;
  created_at: string;
};
type Customer = { user_id: string; full_name: string; email: string; phone: string | null };

export default function Chat({
  admin,
  onClose,
}: {
  admin: boolean;
  onClose?: () => void;
}) {
  const [userId, setUserId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, { url: string; expires: number }>>({});
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentCustomers, setRecentCustomers] = useState<string[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [storeContact, setStoreContact] = useState<{ full_name: string; phone: string | null } | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const sendLock = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    const init = async () => {
      const client = createClient();
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (!active) return;
      if (authError || !user) {
        setError("Please sign in to use messages.");
        setLoading(false);
        return;
      }
      setUserId(user.id);
      if (!admin) {
        setCustomerId(user.id);
        const { data: contact } = await client.rpc("store_chat_contact");
        if (!active) return;
        setStoreContact(contact?.[0] ?? null);
        setLoading(false);
        return;
      }
      const { data, error: profileError } = await client
        .from("profiles")
        .select("user_id,full_name,email,phone")
        .eq("role", "customer")
        .order("full_name");
      if (!active) return;
      if (profileError) setError(profileError.message);
      else setCustomers((data as Customer[]) || []);
      setLoading(false);
    };
    void init();
    return () => {
      active = false;
    };
  }, [admin]);

  useEffect(() => {
    if (!admin || !userId) return;
    let active = true;
    const refresh = async () => {
      const { data, error: listError } = await createClient()
        .from("customer_messages")
        .select("customer_id")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (!active) return;
      if (listError)
        setError(
          `${listError.message} — run supabase/customer-chat.sql in the Supabase SQL Editor.`,
        );
      else
        setRecentCustomers(
          Array.from(new Set((data || []).map((item) => item.customer_id))),
        );
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [admin, userId]);

  useEffect(() => {
    if (!admin || !userId) return;
    let active = true;
    const refresh = async () => {
      const { data, error: countError } =
        await createClient().rpc("chat_unread_counts");
      if (!active) return;
      if (!countError)
        setUnread(
          Object.fromEntries(
            (data || []).map(
              (row: {
                conversation_id: string;
                unread_count: number | string;
              }) => [row.conversation_id, Number(row.unread_count)],
            ),
          ),
        );
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("sukimart-chat-read", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("sukimart-chat-read", refresh);
    };
  }, [admin, userId]);

  useEffect(() => {
    if (!customerId) return;
    let active = true;
    const refresh = async () => {
      const { data, error: queryError } = await createClient()
        .from("customer_messages")
        .select("id,customer_id,sender_id,body,attachment_path,created_at")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(200);
      if (!active) return;
      if (queryError)
        setError(
          `${queryError.message} — run supabase/customer-chat.sql and supabase/chat-images.sql in the Supabase SQL Editor.`,
        );
      else {
        const rows = ((data as Message[]) || []).reverse();
        setMessages(rows);
        setError("");
        const incomingIds = rows
          .filter((message) => message.sender_id !== userId)
          .map((message) => message.id);
        if (incomingIds.length) {
          const { error: readError } = await createClient().rpc(
            "chat_mark_read",
            { p_customer_id: customerId, p_message_ids: incomingIds },
          );
          if (!active) return;
          if (readError)
            setError(
              `${readError.message} — run supabase/chat-notifications.sql in the Supabase SQL Editor.`,
            );
          else window.dispatchEvent(new Event("sukimart-chat-read"));
        }
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [customerId, userId]);

  useEffect(() => {
    let active = true;
    const paths = Array.from(new Set(messages.map(message => message.attachment_path).filter((path): path is string => Boolean(path))))
      .filter(path => !imageUrls[path] || imageUrls[path].expires < Date.now() + 60000);
    if (!paths.length) return;
    const loadImages = async () => {
      const client = createClient();
      const results = await Promise.all(paths.map(async path => {
        const { data, error: imageError } = await client.storage.from("sukimart-chat-images").createSignedUrl(path, 3600);
        return !imageError && data ? [path, { url: data.signedUrl, expires: Date.now() + 3500 * 1000 }] as const : null;
      }));
      if (!active) return;
      const successful = results.filter((result): result is NonNullable<typeof result> => result !== null);
      if (successful.length) setImageUrls(current => ({ ...current, ...Object.fromEntries(successful) }));
    };
    void loadImages();
    return () => { active = false; };
  }, [messages, imageUrls]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (lastMessageId) end.current?.scrollIntoView({ block: "nearest" });
  }, [lastMessageId]);

  const send = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const body = draft.trim();
      if ((!body && !attachment) || !userId || !customerId || sendLock.current) return;
      sendLock.current = true;
      setSending(true);
      setError("");
      try {
        const client = createClient();
        let attachmentPath: string | null = null;
        if (attachment) {
          if (!globalThis.crypto?.randomUUID) { setError("Image upload requires HTTPS or localhost. Please use a secure connection."); return; }
          const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
          const extension = extensions[attachment.type];
          if (!extension || attachment.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG, WebP or GIF image of 5 MB or less."); return; }
          attachmentPath = `${customerId}/${userId}/${globalThis.crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await client.storage.from("sukimart-chat-images").upload(attachmentPath, attachment, { contentType: attachment.type, upsert: false });
          if (uploadError) { setError(`${uploadError.message} — check that supabase/chat-images.sql has been run.`); return; }
        }
        const { data, error: sendError } = await client
          .from("customer_messages")
          .insert({ customer_id: customerId, sender_id: userId, body, attachment_path: attachmentPath })
          .select("id,customer_id,sender_id,body,attachment_path,created_at")
          .single();
        if (sendError) {
          setError(sendError.message);
          return;
        }
        setMessages((current) =>
          current.some((m) => m.id === data.id)
            ? current
            : [...current, data as Message],
        );
        setDraft("");
        setAttachment(null);
        if (fileInput.current) fileInput.current.value = "";
        end.current?.scrollIntoView({ block: "nearest" });
      } catch {
        setError(
          "Could not send your message. Check your connection and try again.",
        );
      } finally {
        sendLock.current = false;
        setSending(false);
      }
    },
    [attachment, customerId, draft, userId],
  );

  const activeCustomer = customers.find(
    (customer) => customer.user_id === customerId,
  );
  const contactPhone = admin ? activeCustomer?.phone : storeContact?.phone;
  const callNumber = contactPhone?.replace(/[^+0-9]/g, "") || "";
  const orderedCustomers = [...customers].sort((a, b) => {
    const ai = recentCustomers.indexOf(a.user_id),
      bi = recentCustomers.indexOf(b.user_id);
    return (
      (ai < 0 ? Number.MAX_SAFE_INTEGER : ai) -
      (bi < 0 ? Number.MAX_SAFE_INTEGER : bi)
    );
  });
  return (
    <section
      className={styles.panel}
      aria-label={admin ? "Customer messages" : "Chat with the store"}
    >
      <div className={styles.heading}>
        {onClose && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            disabled={sending}
            aria-label="Close chat"
          >
            ✕
          </button>
        )}
        <h2>{admin ? "Customer messages" : "Chat with SukiMart"}</h2>
        <p>
          {admin
            ? "Select a customer to view and reply to their conversation."
            : "Send the store a message. Replies appear here."}
        </p>
      </div>
      <div
        className={`${styles.layout} ${!admin ? styles.customerLayout : ""}`}
      >
        {admin && (
          <div className={styles.list}>
            <p className={styles.listHeading}>Chats</p>
            {loading ? (
              <p className={styles.empty}>Loading customers…</p>
            ) : customers.length === 0 ? (
              <p className={styles.empty}>No customers found.</p>
            ) : (
              orderedCustomers.map((customer) => (
                <button
                  type="button"
                  disabled={sending}
                  key={customer.user_id}
                  className={
                    customerId === customer.user_id ? styles.selected : ""
                  }
                  onClick={() => {
                    setCustomerId(customer.user_id);
                    setMessages([]);
                    setDraft("");
                    setAttachment(null);
                    if (fileInput.current) fileInput.current.value = "";
                    setError("");
                  }}
                >
                  {customer.full_name || customer.email || "Customer"}
                  {Boolean(unread[customer.user_id]) && (
                    <span
                      className={styles.unread}
                      aria-label={`${unread[customer.user_id]} unread messages`}
                    >
                      {unread[customer.user_id]}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
        <div className={styles.conversation}>
          {(!admin || activeCustomer) && (
            <div className={`${styles.heading} ${styles.conversationHeading}`}>
              <strong>
                {admin ? activeCustomer?.full_name || activeCustomer?.email || "Customer" : storeContact?.full_name || "Store owner"}
              </strong>
              {callNumber ? (
                <a className={styles.callButton} href={`tel:${callNumber}`} aria-label={admin ? `Call ${activeCustomer?.full_name || "customer"}` : "Call store owner"} title={`Call ${contactPhone}`}>
                  <Phone size={18} aria-hidden="true" />
                </a>
              ) : (
                <span className={styles.callUnavailable} title="No contact number available" aria-label="No contact number available"><Phone size={18} aria-hidden="true" /></span>
              )}
            </div>
          )}
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          {!customerId ? (
            <p className={styles.empty}>
              {loading ? "Loading…" : "Select a customer to start."}
            </p>
          ) : (
            <>
              <div className={styles.messages} aria-live="polite">
                {messages.length === 0 && (
                  <p className={styles.empty}>No messages yet.</p>
                )}
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`${styles.bubble} ${message.sender_id === userId ? styles.mine : ""}`}
                  >
                    {message.attachment_path && (imageUrls[message.attachment_path] ? <a href={imageUrls[message.attachment_path].url} target="_blank" rel="noreferrer"><ProductImage src={imageUrls[message.attachment_path].url} alt="Image sent in chat" className={styles.chatImage} /></a> : <small>Loading image…</small>)}
                    {message.body && <span>{message.body}</span>}
                    <small>
                      {new Date(message.created_at).toLocaleString()}
                    </small>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form className={styles.form} onSubmit={send}>
                <button type="button" className={styles.addImage} onClick={() => fileInput.current?.click()} disabled={sending} aria-label="Add image" title="Add image">+</button>
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={sending} hidden onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError("Choose a JPG, PNG, WebP or GIF image of 5 MB or less."); event.target.value = ""; setAttachment(null); return; } setError(""); setAttachment(file); }} />
                <div className={styles.composer}>
                {attachment && <div className={styles.attachmentInfo}><span>Image: {attachment.name}</span><button type="button" disabled={sending} onClick={() => { setAttachment(null); if (fileInput.current) fileInput.current.value = ""; }}>Remove</button></div>}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message…"
                  maxLength={2000}
                  rows={2}
                  aria-label="Message"
                  disabled={sending}
                />
                </div>
                <button type="submit" disabled={sending || (!draft.trim() && !attachment)}>
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
