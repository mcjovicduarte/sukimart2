"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bell, MapPin, Wallet, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatDateTime, formatOrderCode, formatPeso } from "@/utils/format";
import { statusLabel, statusTone } from "@/utils/order-status";
import { resolveProductImage } from "@/utils/product-images";
import { deliveryMinimum } from "@/utils/delivery-minimum";
import ProductImage from "../product-image";
import LocationPicker, { type Coordinates } from "./location-picker";
import AccountEditor from "./account-editor";
import Chat from "../chat/chat";
import DeliveryChat from "../chat/delivery-chat";
import UnreadBadge from "../chat/unread";
import OrderReceipt from "./order-receipt";
import OrderTracker from "./order-tracker";
import styles from "./customer-shop.module.css";

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  stock: number;
  image_url: string | null;
};

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  total: number;
  status: string;
  created_at: string;
  delivery_address?: string;
  payment_method?: string;
  order_items: OrderItem[];
};

type ShopNotification = {
  id: string;
  order_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
};
type DriverContact = { order_id: string; full_name: string; phone: string | null };

const TONE_CLASS = {
  new: styles.statusNew,
  progress: styles.statusProgress,
  way: styles.statusWay,
  done: styles.statusDone,
  cancelled: styles.statusCancelled,
};

const PAYMENT_METHODS = [
  "Cash on Delivery",
  "GCash",
  "Maya",
  "Pickup and pay at store",
];

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${TONE_CLASS[statusTone(status)]}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function CustomerShop() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [driverContacts, setDriverContacts] = useState<DriverContact[]>([]);
  const [notifications, setNotifications] = useState<ShopNotification[]>([]);
  const [notificationsReady, setNotificationsReady] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [deliveryChatId, setDeliveryChatId] = useState<string | null>(null);
  const [messageSection, setMessageSection] = useState<"store" | "driver">("store");
  const [allDeliveryUnread, setDeliveryUnread] = useState<{ order_id: string; unread_count: number }[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLocation, setDeliveryLocation] = useState<Coordinates | null>(
    null,
  );
  const [storeLocation, setStoreLocation] = useState<Coordinates | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);

  const refreshDriverContacts = useCallback(async () => {
    const { data, error } = await createClient().rpc("customer_delivery_contacts");
    if (!error) setDriverContacts((data as DriverContact[]) ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const { data, error } = await createClient().rpc("delivery_message_unread_counts");
      if (active && !error) setDeliveryUnread((data ?? []).map((row: { order_id: string; unread_count: number | string }) => ({ order_id: row.order_id, unread_count: Number(row.unread_count) })));
    }
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("delivery-messages-read", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("delivery-messages-read", refresh); };
  }, []);

  const loadShop = useCallback(async () => {
    const supabase = createClient();
    const [productResult, orderResult, notificationResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,description,category,price,stock,image_url")
        .eq("active", true)
        .order("name"),
      supabase
        .from("orders")
        .select(
          "id,total,status,created_at,delivery_address,payment_method,order_items(product_name,quantity,unit_price)",
        )
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("notifications")
        .select("id,order_id,title,message,read,created_at")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setErrorMessage("");
    if (productResult.error) {
      setErrorMessage(productResult.error.message);
      setLoading(false);
      return;
    }

    // The shop still works before the admin database update is applied: fall
    // back to the original order columns if delivery details are missing.
    let orderRows: unknown = orderResult.data;
    let orderError = orderResult.error;
    if (orderError) {
      const fallback = await supabase
        .from("orders")
        .select(
          "id,total,status,created_at,order_items(product_name,quantity,unit_price)",
        )
        .order("created_at", { ascending: false })
        .limit(10);
      orderRows = fallback.data;
      orderError = fallback.error;
    }

    if (orderError) {
      setErrorMessage(orderError.message);
      setLoading(false);
      return;
    }

    setProducts((productResult.data as unknown as Product[]) ?? []);
    setOrders((orderRows as unknown as Order[]) ?? []);

    if (notificationResult.error) {
      setNotifications([]);
      setNotificationsReady(false);
    } else {
      setNotifications(
        (notificationResult.data as unknown as ShopNotification[]) ?? [],
      );
      setNotificationsReady(true);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Initial client-side fetch; all state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadShop();
    void refreshDriverContacts();
  }, [loadShop, refreshDriverContacts]);

  useEffect(() => {
    const refreshStock = async () => {
      const { data, error } = await createClient()
        .from("products")
        .select("id,name,description,category,price,stock,image_url")
        .eq("active", true)
        .order("name");
      if (!error) setProducts((data as Product[]) ?? []);
    };
    const refreshOrders = async () => {
      const { data, error } = await createClient().from("orders")
        .select("id,total,status,created_at,delivery_address,payment_method,order_items(product_name,quantity,unit_price)")
        .order("created_at", { ascending: false }).limit(10);
      if (!error) setOrders((data as unknown as Order[]) ?? []);
    };
    const timer = window.setInterval(() => { void refreshStock(); void refreshOrders(); void refreshDriverContacts(); }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshDriverContacts]);

  useEffect(() => {
    if (!checkoutOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setCheckoutOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [checkoutOpen, submitting]);

  const cartCount = useMemo(
    () => Object.values(cart).reduce((total, count) => total + count, 0),
    [cart],
  );

  const cartTotal = useMemo(
    () =>
      products.reduce(
        (total, product) =>
          total + Number(product.price) * (cart[product.id] ?? 0),
        0,
      ),
    [cart, products],
  );
  const deliveryRule = paymentMethod !== "Pickup and pay at store" && deliveryLocation && storeLocation
    ? deliveryMinimum(deliveryLocation[0], deliveryLocation[1], storeLocation[0], storeLocation[1]) : null;

  const cartLines = useMemo(
    () =>
      products
        .filter((product) => (cart[product.id] ?? 0) > 0)
        .map((product) => ({
          ...product,
          quantity: cart[product.id] ?? 0,
          lineTotal: Number(product.price) * (cart[product.id] ?? 0),
        })),
    [cart, products],
  );

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications],
  );
  const deliveryUnread = allDeliveryUnread.filter((item) =>
    orders.some((order) => order.id === item.order_id && !["completed", "cancelled"].includes(order.status)),
  );
  const deliveryUnreadTotal = deliveryUnread.reduce((total, item) => total + item.unread_count, 0);

  const changeQuantity = (product: Product, amount: number) => {
    setCart((current) => {
      const existing = current[product.id] ?? 0;
      const quantity =
        amount > 0
          ? Math.min(product.stock, existing + amount)
          : Math.max(0, existing + amount);
      const next = { ...current };
      if (quantity === 0) delete next[product.id];
      else next[product.id] = quantity;
      return next;
    });
  };

  const openCheckout = async () => {
    if (cartCount === 0) {
      setErrorMessage("Add a product to your cart before placing an order.");
      return;
    }
    setMessage("");
    setErrorMessage("");
    setReviewing(false);
    const storeResult = await createClient().from("store_settings").select("latitude,longitude").eq("id", true).maybeSingle();
    if (storeResult.error || !storeResult.data) {
      setStoreLocation(null);
    } else {
      setStoreLocation([storeResult.data.latitude, storeResult.data.longitude]);
    }
    if (!deliveryAddress && !deliveryLocation) {
      const client = createClient();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user) {
        const { data } = await client
          .from("profiles")
          .select("delivery_address,delivery_lat,delivery_lng")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data) {
          setDeliveryAddress(data.delivery_address || "");
          if (data.delivery_lat != null && data.delivery_lng != null)
            setDeliveryLocation([data.delivery_lat, data.delivery_lng]);
          setLocationConfirmed(false);
        }
      }
    }
    setCartOpen(false);
    setCheckoutOpen(true);
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const items = Object.entries(cart).map(([product_id, quantity]) => ({
      product_id,
      quantity,
    }));
    if (items.length === 0) {
      setErrorMessage("Add a product to your cart before placing an order.");
      return;
    }
    if (
      cartLines.length !== items.length ||
      cartLines.some((line) => line.quantity > line.stock)
    ) {
      setErrorMessage(
        "Some cart items are unavailable or exceed current stock. Update your cart before checking out.",
      );
      return;
    }

    const isPickup = paymentMethod === "Pickup and pay at store";
    if (!isPickup && !storeLocation) {
      setErrorMessage("The store location could not be loaded. Please retry checkout or contact the store.");
      return;
    }
    if (
      !isPickup &&
      (!deliveryAddress.trim() || !deliveryLocation || !locationConfirmed)
    ) {
      setErrorMessage(
        "Enter your delivery address, place a pin on the map, and confirm the location.",
      );
      return;
    }
    if (!isPickup && deliveryRule && cartTotal < deliveryRule.minimum) {
      setErrorMessage(`This delivery requires a minimum order of ${formatPeso(deliveryRule.minimum)}. Add ${formatPeso(deliveryRule.minimum - cartTotal)} more to your cart.`);
      return;
    }

    if (!reviewing) {
      setErrorMessage("");
      setReviewing(true);
      return;
    }

    setSubmitting(true);
    setMessage("");
    setErrorMessage("");
    const supabase = createClient();
    const result = await supabase.rpc("place_order_with_location", {
      items,
      p_delivery_address: deliveryAddress.trim(),
      p_payment_method: paymentMethod,
      p_delivery_lat: isPickup ? null : deliveryLocation?.[0],
      p_delivery_lng: isPickup ? null : deliveryLocation?.[1],
    });

    if (result.error) {
      setErrorMessage(
        result.error.code === "PGRST202"
          ? "Checkout setup is incomplete. Ask the store to run supabase/customer-location.sql in Supabase."
          : result.error.message,
      );
      setSubmitting(false);
      return;
    }

    setCart({});
    setCheckoutOpen(false);
    setReviewing(false);
    setDeliveryAddress("");
    setDeliveryLocation(null);
    setLocationConfirmed(false);
    setPaymentMethod(PAYMENT_METHODS[0]);
    if (typeof result.data === "string" && result.data) setReceiptId(result.data);
    setMessage("Order placed! Track its status below and watch for updates.");
    await loadShop();
    setSubmitting(false);
  };

  const markAllRead = async () => {
    setMarkingAllRead(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false);

    if (!error) {
      setNotifications((current) =>
        current.map((notification) => ({ ...notification, read: true })),
      );
    }
    setMarkingAllRead(false);
  };

  const markRead = async (notification: ShopNotification) => {
    if (notification.read) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", notification.id);

    if (!error) {
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item,
        ),
      );
    }
  };

  const signOut = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    router.replace("/");
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <a className={styles.brand} href="/shop">
          <Image src="/sukimart-logo.png" alt="" width={48} height={37} className={styles.brandLogo} />
          Sukimart
        </a>
        <div className={styles.headerActions}>
          <div className={styles.notificationWrap}>
            <button
              type="button"
              className={styles.bellButton}
              onClick={() => setNotificationsOpen((open) => !open)}
              aria-label={`Notifications${
                unreadCount + deliveryUnreadTotal > 0 ? ` (${unreadCount + deliveryUnreadTotal} unread)` : ""
              }`}
              aria-expanded={notificationsOpen}
            >
              <Bell size={18} />
              {unreadCount + deliveryUnreadTotal > 0 && (
                <span className={styles.unreadDot}>
                  {unreadCount + deliveryUnreadTotal > 9 ? "9+" : unreadCount + deliveryUnreadTotal}
                </span>
              )}
            </button>

            {notificationsOpen && (
              <>
                <button
                  type="button"
                  className={styles.notificationScrim}
                  aria-label="Close notifications"
                  onClick={() => setNotificationsOpen(false)}
                />
                <div
                  className={styles.notificationPanel}
                  role="dialog"
                  aria-label="Notifications"
                >
                  <div className={styles.notificationHeader}>
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => void markAllRead()}
                        disabled={markingAllRead}
                      >
                        {markingAllRead ? "Saving…" : "Mark all read"}
                      </button>
                    )}
                  </div>
                  <div className={styles.notificationList}>
                    {deliveryUnread.map((item) => (
                      <button key={item.order_id} type="button" className={`${styles.notificationItem} ${styles.notificationUnread}`}
                        onClick={() => { setNotificationsOpen(false); setDeliveryChatId(item.order_id); setMessageSection("driver"); setChatOpen(true); }}>
                        <span className={styles.notificationTitle}>Message from your delivery driver</span>
                        <span className={styles.notificationMessage}>Order {formatOrderCode(item.order_id)} · {item.unread_count} unread {item.unread_count === 1 ? "message" : "messages"}. Tap to open.</span>
                      </button>
                    ))}
                    {notifications.length === 0 && deliveryUnread.length === 0 ? (
                      <p className={styles.notificationEmpty}>
                        {notificationsReady
                          ? "No notifications yet. Order updates will appear here."
                          : "Order notifications will appear after the store database update is applied."}
                      </p>
                    ) : (
                      notifications.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={`${styles.notificationItem} ${
                            notification.read ? "" : styles.notificationUnread
                          }`}
                          onClick={() => void markRead(notification)}
                        >
                          <span className={styles.notificationTitle}>
                            {notification.title}
                          </span>
                          <span className={styles.notificationMessage}>
                            {notification.message}
                          </span>
                          <span className={styles.notificationTime}>
                            {formatDateTime(notification.created_at)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => { setMessageSection("store"); setDeliveryChatId(null); setChatOpen(true); }}
          >
            Messages
            <UnreadBadge />
            {deliveryUnreadTotal > 0 && <span className={styles.messageCount} aria-label={`${deliveryUnreadTotal} unread driver messages`}>{deliveryUnreadTotal > 9 ? "9+" : deliveryUnreadTotal}</span>}
          </button>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => setCartOpen(true)}
          >
            Cart ({cartCount})
          </button>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={() => setAccountOpen(true)}
          >
            My account
          </button>
          <button
            type="button"
            className={styles.signOutButton}
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className={styles.content}>
        <section className={styles.welcome}>
          <div>
            <p className={styles.eyebrow}>YOUR NEIGHBORHOOD STORE</p>
            <h1>Everyday favorites, ready for you.</h1>
            <p>
              Choose from available stock and place an order with your store.
            </p>
          </div>
          <div className={styles.cartSummary}>
            <span>Your cart</span>
            <strong>
              {cartCount} item{cartCount === 1 ? "" : "s"}
            </strong>
            <strong>{formatPeso(cartTotal)}</strong>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              disabled={submitting}
            >
              View cart
            </button>
            <button type="button" onClick={openCheckout} disabled={submitting}>
              Checkout
            </button>
          </div>
        </section>

        {message && (
          <p className={styles.success} role="status">
            {message}
          </p>
        )}
        {errorMessage && (
          <p className={styles.error} role="alert">
            {errorMessage}
          </p>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <h2>Available products</h2>
            <span>
              {products.filter((product) => product.stock > 0).length} in stock
            </span>
          </div>
          <p className={styles.checkoutHint}>
            Displayed availability accounts for your cart. Items are not
            reserved until your order is placed.
          </p>
          {loading ? (
            <p className={styles.empty}>Loading products…</p>
          ) : products.length === 0 ? (
            <p className={styles.empty}>
              There are no products in stock right now. Please check again
              later.
            </p>
          ) : (
            <div className={styles.productGrid}>
              {products.map((product) => (
                <article className={styles.productCard} key={product.id}>
                  <div className={styles.productMedia}>
                    <ProductImage
                      src={resolveProductImage(product)}
                      alt={product.name}
                      className={styles.productImage}
                    />
                    <span className={styles.category}>{product.category}</span>
                  </div>
                  <div className={styles.productBody}>
                    <h3>{product.name}</h3>
                    <span
                      className={`${styles.stockCount} ${product.stock <= (cart[product.id] ?? 0) ? styles.stockEmpty : ""}`}
                    >
                      {product.stock === 0
                        ? "Out of stock · 0 available"
                        : `Available after your cart: ${Math.max(0, product.stock - (cart[product.id] ?? 0))}`}
                    </span>
                    {product.description && <p>{product.description}</p>}
                    <div className={styles.productFooter}>
                      <strong>{formatPeso(product.price)}</strong>
                      <div className={styles.quantity}>
                        <button
                          type="button"
                          aria-label={`Remove one ${product.name} from cart`}
                          onClick={() => changeQuantity(product, -1)}
                          disabled={!cart[product.id]}
                        >
                          −
                        </button>
                        <span>{cart[product.id] ?? 0}</span>
                        <button
                          type="button"
                          aria-label={`Add one ${product.name} to cart`}
                          onClick={() => changeQuantity(product, 1)}
                          disabled={(cart[product.id] ?? 0) >= product.stock}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <div className={styles.headingGroup}>
              <h2>Your recent orders</h2>
              {orders[0] && (
                <span className={styles.latestOrder}>
                  Latest: <StatusPill status={orders[0].status} />
                </span>
              )}
            </div>
            <span>Last 10 orders</span>
          </div>
          {orders.length === 0 ? (
            <p className={styles.empty}>
              Your orders will appear here after you place one.
            </p>
          ) : (
            <div className={styles.orders}>
              {orders.map((order) => (
                <article className={styles.order} key={order.id}>
                  <div className={styles.orderHeading}>
                    <div>
                      <strong>Order {formatOrderCode(order.id)}</strong>
                      <span>{formatDateTime(order.created_at)}</span>
                    </div>
                    <div className={styles.orderTotal}>
                      <StatusPill status={order.status} />
                      <strong>{formatPeso(order.total)}</strong>
                    </div>
                  </div>
                  <ul>
                    {order.order_items.map((item, index) => (
                      <li key={`${order.id}-${index}`}>
                        {item.quantity} × {item.product_name} —{" "}
                        {formatPeso(Number(item.unit_price) * item.quantity)}
                      </li>
                    ))}
                  </ul>
                  <div className={styles.orderMeta}>
                    <span>
                      <Wallet size={12} />{" "}
                      {order.payment_method || "Cash on Delivery"}
                    </span>
                    <span>
                      <MapPin size={12} />{" "}
                      {order.delivery_address || "Pickup at store"}
                    </span>
                  </div>
                  {driverContacts.filter((contact) => contact.order_id === order.id).map((contact) => (
                    <p key={contact.order_id}>
                      <strong>Delivery driver:</strong> {contact.full_name || "Delivery driver"}
                      {contact.phone && <> · <a href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}>{contact.phone}</a></>}
                    </p>
                  ))}
                  <button type="button" className={styles.receiptLink} onClick={() => setTrackingId(order.id)}>Track order{deliveryUnread.some((item) => item.order_id === order.id) ? " · New driver message" : ""}</button>{" "}
                  <button type="button" className={styles.receiptLink} onClick={() => setReceiptId(order.id)}>View receipt</button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {receiptId && <OrderReceipt orderId={receiptId} onClose={() => setReceiptId(null)} />}
      {trackingId && <OrderTracker orderId={trackingId} onClose={() => setTrackingId(null)} onMessageDriver={() => { setDeliveryChatId(trackingId); setMessageSection("driver"); setChatOpen(true); setTrackingId(null); }} />}
      {chatOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChatOpen(false);
          }}
        >
          <div
            className={styles.chatModal}
            role="dialog"
            aria-modal="true"
            aria-label="Messages"
          >
            <div className={styles.messageNav}>
              <div className={styles.messageNavHeader}><strong>Messages</strong><button type="button" onClick={() => setChatOpen(false)} aria-label="Close messages">×</button></div>
              <div className={styles.messageTabs}>
                <button type="button" aria-pressed={messageSection === "store"} onClick={() => setMessageSection("store")}>Store owner</button>
                <button type="button" aria-pressed={messageSection === "driver"} onClick={() => {
                  setMessageSection("driver");
                  if (!deliveryChatId) {
                    const activeOrder = orders.find((order) => !["completed", "cancelled"].includes(order.status) && driverContacts.some((driver) => driver.order_id === order.id));
                    setDeliveryChatId(activeOrder?.id ?? null);
                  }
                }}>Delivery driver{deliveryUnreadTotal > 0 ? ` (${deliveryUnreadTotal})` : ""}</button>
              </div>
            </div>
            {messageSection === "store" ? <Chat admin={false} onClose={() => setChatOpen(false)} /> : <>
              <div className={styles.driverConversations}>
                {deliveryChatId ? <>
                  <strong>{driverContacts.find((driver) => driver.order_id === deliveryChatId)?.full_name || "Assigned delivery driver"}</strong>
                  <span>Order {formatOrderCode(deliveryChatId)}</span>
                </> : <>
                  <strong>Delivery driver</strong>
                  <p>Messages are available after a driver accepts your active order. For a specific order, use Message driver in its tracker.</p>
                </>}
              </div>
              {deliveryChatId && <DeliveryChat key={deliveryChatId} orderId={deliveryChatId} onClose={() => setDeliveryChatId(null)} />}
            </>}
          </div>
        </div>
      )}
      {cartOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <section
            className={styles.checkoutModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 id="cart-title">Your cart</h2>
                <p>Review or change your items before checkout.</p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Close cart"
                onClick={() => setCartOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className={styles.checkoutBody}>
              {cartCount === 0 ? (
                <p>Your cart is empty.</p>
              ) : (
                Object.entries(cart).map(([id, quantity]) => {
                  const product = products.find((item) => item.id === id);
                  if (!product)
                    return (
                      <div className={styles.cartLine} key={id}>
                        <span>This product is no longer available.</span>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) => {
                              const next = { ...current };
                              delete next[id];
                              return next;
                            })
                          }
                        >
                          Remove
                        </button>
                      </div>
                    );
                  return (
                    <div className={styles.cartLine} key={id}>
                      <ProductImage
                        src={resolveProductImage(product)}
                        alt={product.name}
                        className={styles.cartLineImage}
                      />
                      <div className={styles.cartLineDetails}>
                        <strong>{product.name}</strong>
                        <small>
                          {formatPeso(product.price)} each ·{" "}
                          {formatPeso(Number(product.price) * quantity)}
                        </small>
                        {quantity > product.stock && (
                          <small className={styles.locationError}>
                            Only {product.stock} available. Reduce the quantity.
                          </small>
                        )}
                        <div className={styles.cartControls}>
                          <button
                            type="button"
                            aria-label={`Remove one ${product.name}`}
                            onClick={() => changeQuantity(product, -1)}
                          >
                            −
                          </button>
                          <span>{quantity}</span>
                          <button
                            type="button"
                            aria-label={`Add one ${product.name}`}
                            disabled={quantity >= product.stock}
                            onClick={() => changeQuantity(product, 1)}
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setCart((current) => {
                                const next = { ...current };
                                delete next[id];
                                return next;
                              })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div className={styles.checkoutTotal}>
                <span>Total</span>
                <strong>{formatPeso(cartTotal)}</strong>
              </div>
              {paymentMethod !== "Pickup and pay at store" && (
                <p role="status">
                  {deliveryRule ? <>
                    Delivery distance: {deliveryRule.distance.toFixed(1)} km in a straight line.{" "}
                    {deliveryRule.minimum === 0 ? "No minimum order for this location." :
                      <>Minimum order: <strong>{formatPeso(deliveryRule.minimum)}</strong>.
                        {cartTotal < deliveryRule.minimum && <> Add {formatPeso(deliveryRule.minimum - cartTotal)} more to your cart.</>}
                      </>}
                  </> : storeLocation ? "Choose a delivery location to see the minimum order." : "Store location unavailable. Please retry checkout or contact the store."}
                </p>
              )}
              {errorMessage && (
                <p role="alert" className={styles.locationError}>
                  {errorMessage}
                </p>
              )}
            </div>
            <div className={styles.checkoutFooter}>
              <button
                type="button"
                className={`${styles.checkoutButton} ${styles.checkoutSecondary}`}
                onClick={() => setCartOpen(false)}
              >
                Continue shopping
              </button>
              <button
                type="button"
                className={styles.checkoutButton}
                onClick={openCheckout}
                disabled={cartCount === 0}
              >
                Checkout
              </button>
            </div>
          </section>
        </div>
      )}
      {accountOpen && (
        <AccountEditor
          onClose={() => setAccountOpen(false)}
          onSaved={(address, location) => {
            setDeliveryAddress(address);
            setDeliveryLocation(location);
            setLocationConfirmed(false);
            setAccountOpen(false);
            setErrorMessage("");
            setMessage(
              "Account and delivery pin saved. Confirm them at checkout so the assigned delivery person can see the location.",
            );
          }}
        />
      )}
      {checkoutOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setCheckoutOpen(false);
            }
          }}
        >
          <form className={styles.checkoutModal} onSubmit={placeOrder}>
            <div className={styles.modalHeader}>
              <div>
                <h2>
                  {reviewing ? "Review your order" : "Delivery and payment"}
                </h2>
                <p>
                  {reviewing
                    ? "Please double-check your items and details before placing your order."
                    : "Tell us where to deliver and how you will pay."}
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Close checkout"
                onClick={() => setCheckoutOpen(false)}
                disabled={submitting}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.checkoutBody}>
              <ul className={styles.checkoutSummary}>
                {cartLines.map((line) => (
                  <li key={line.id}>
                    <span>
                      {line.quantity} × {line.name}{" "}
                      <small>({formatPeso(line.price)} each)</small>
                    </span>
                    <strong>{formatPeso(line.lineTotal)}</strong>
                  </li>
                ))}
              </ul>

              <div className={styles.checkoutTotal}>
                <span>Order total</span>
                <strong>{formatPeso(cartTotal)}</strong>
              </div>

              {!reviewing && (
                <>
                  <label className={styles.field}>
                    <span>Payment method</span>
                    <select
                      value={paymentMethod}
                      onChange={(event) => setPaymentMethod(event.target.value)}
                    >
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </label>
                  {paymentMethod !== "Pickup and pay at store" && (
                    <>
                      <label className={styles.field}>
                        <span>Complete delivery address</span>
                        <textarea
                          value={deliveryAddress}
                          onChange={(event) => {
                            setDeliveryAddress(event.target.value);
                            setLocationConfirmed(false);
                          }}
                          placeholder="Store name, house number, street, barangay, city, province"
                          required
                        />
                      </label>
                      <LocationPicker
                        value={deliveryLocation}
                        onChange={(location) => {
                          setDeliveryLocation(location);
                          setLocationConfirmed(false);
                        }}
                      />
                      <label className={styles.locationConfirm}>
                        <input
                          type="checkbox"
                          checked={locationConfirmed}
                          onChange={(event) =>
                            setLocationConfirmed(event.target.checked)
                          }
                          disabled={!deliveryLocation}
                        />{" "}
                        I confirm the address and map pin are the correct
                        delivery location.
                      </label>
                    </>
                  )}
                </>
              )}
              {reviewing && (
                <div className={styles.reviewDetails}>
                  <p>
                    <strong>Payment:</strong> {paymentMethod}
                  </p>
                  <p>
                    <strong>Delivery:</strong>{" "}
                    {paymentMethod === "Pickup and pay at store"
                      ? "Pickup at store"
                      : deliveryAddress}
                  </p>
                  {paymentMethod !== "Pickup and pay at store" &&
                    deliveryLocation && (
                      <p>
                        <strong>Confirmed map pin:</strong>{" "}
                        {deliveryLocation[0].toFixed(6)},{" "}
                        {deliveryLocation[1].toFixed(6)}
                      </p>
                    )}
                </div>
              )}
              {errorMessage && (
                <p role="alert" className={styles.locationError}>
                  {errorMessage}
                </p>
              )}
            </div>

            <div className={styles.checkoutFooter}>
              <button
                type="button"
                className={`${styles.checkoutButton} ${styles.checkoutSecondary}`}
                onClick={() =>
                  reviewing ? setReviewing(false) : setCheckoutOpen(false)
                }
                disabled={submitting}
              >
                {reviewing ? "Edit details" : "Keep shopping"}
              </button>
              <button
                type="submit"
                className={styles.checkoutButton}
                disabled={submitting}
              >
                {submitting
                  ? "Placing order…"
                  : reviewing
                    ? `Confirm & place order · ${formatPeso(cartTotal)}`
                    : "Review order"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
