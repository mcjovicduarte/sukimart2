"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  Eye,
  RefreshCw,
  Search,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  countLabel,
  formatDateTime,
  formatOrderCode,
  formatPeso,
} from "@/utils/format";
import {
  ORDER_STATUSES,
  orderActions,
  statusLabel,
  type OrderAction,
} from "@/utils/order-status";
import {
  Alert,
  ConfirmDialog,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
} from "./ui";
import styles from "./admin.module.css";

type OrderItem = {
  product_name: string;
  quantity: number;
  unit_price: number;
};

type Order = {
  id: string;
  customer_id: string;
  delivery_man_id: string | null;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  delivery_address: string;
  payment_method: string;
  order_items: OrderItem[];
};

type Profile = {
  user_id: string;
  full_name: string;
  email: string;
};

type HistoryEntry = {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
};

type StatusFilter = "all" | (typeof ORDER_STATUSES)[number];

const TAB_LABELS: Record<StatusFilter, string> = {
  all: "All orders",
  new: "New",
  preparing: "Preparing",
  on_the_way: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function OrdersManager({
  lockedStatus,
}: {
  lockedStatus?: "completed";
}) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusFilter>("all");

  const [selected, setSelected] = useState<Order | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  const [pendingAction, setPendingAction] = useState<{
    order: Order;
    action: OrderAction;
  } | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [orderResult, profileResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          "id,customer_id,delivery_man_id,total,status,created_at,updated_at,delivery_address,payment_method,order_items(product_name,quantity,unit_price)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,full_name,email"),
    ]);

    setErrorMessage("");
    if (orderResult.error) {
      setErrorMessage(
        `${orderResult.error.message} — run supabase/admin-dashboard.sql in the Supabase SQL Editor if you have not already.`,
      );
      setLoading(false);
      return null;
    }

    const rows = (orderResult.data as unknown as Order[]) ?? [];
    setOrders(rows);
    if (!profileResult.error) {
      setProfiles((profileResult.data as unknown as Profile[]) ?? []);
    }
    setLoading(false);
    return rows;
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    // Initial client-side fetch; all state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const profileMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((profile) => map.set(profile.user_id, profile));
    return map;
  }, [profiles]);

  const customerFor = useCallback(
    (order: Order) => profileMap.get(order.customer_id),
    [profileMap],
  );

  const scopedOrders = useMemo(
    () =>
      lockedStatus
        ? orders.filter((order) => order.status === lockedStatus)
        : orders,
    [lockedStatus, orders],
  );

  const counts = useMemo(() => {
    const next: Record<string, number> = { all: scopedOrders.length };
    ORDER_STATUSES.forEach((status) => {
      next[status] = scopedOrders.filter(
        (order) => order.status === status,
      ).length;
    });
    return next;
  }, [scopedOrders]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const statusFilter: StatusFilter = lockedStatus ?? tab;

    return scopedOrders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      if (!matchesStatus) return false;
      if (query === "") return true;

      const customer = customerFor(order);
      const matchesCustomer =
        customer?.full_name.toLowerCase().includes(query) ||
        customer?.email.toLowerCase().includes(query);
      const matchesItems = order.order_items.some((item) =>
        item.product_name.toLowerCase().includes(query),
      );
      const matchesCode = formatOrderCode(order.id)
        .toLowerCase()
        .includes(query);

      return Boolean(matchesCustomer || matchesItems || matchesCode);
    });
  }, [customerFor, lockedStatus, scopedOrders, search, tab]);

  const completedRevenue = useMemo(
    () =>
      scopedOrders
        .filter((order) => order.status === "completed")
        .reduce((total, order) => total + Number(order.total), 0),
    [scopedOrders],
  );

  const loadHistory = useCallback(async (orderId: string) => {
    setHistoryLoading(true);
    setHistoryError("");
    const supabase = createClient();
    const { data, error } = await supabase
      .from("order_status_history")
      .select("id,status,note,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (error) {
      setHistory([]);
      setHistoryError(
        "Status history is unavailable. Run supabase/admin-dashboard.sql to enable it.",
      );
    } else {
      setHistory((data as unknown as HistoryEntry[]) ?? []);
    }
    setHistoryLoading(false);
  }, []);

  const openDetails = (order: Order) => {
    setSelected(order);
    setHistory([]);
    void loadHistory(order.id);
  };

  const applyStatus = async () => {
    if (!pendingAction) return;
    const { order, action } = pendingAction;
    setUpdating(true);
    setMessage("");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.rpc("update_order_status", {
      p_order_id: order.id,
      p_status: action.status,
    });

    if (error) {
      setErrorMessage(error.message);
      setUpdating(false);
      setPendingAction(null);
      return;
    }

    setMessage(
      `Order ${formatOrderCode(order.id)} is now ${statusLabel(
        action.status,
      ).toLowerCase()}. The customer has been notified.`,
    );
    setUpdating(false);
    setPendingAction(null);

    const rows = await load();
    if (selected?.id === order.id) {
      const refreshed = rows?.find((row) => row.id === order.id);
      if (refreshed) setSelected(refreshed);
      await loadHistory(order.id);
    }
  };

  const tabs: StatusFilter[] = lockedStatus
    ? []
    : ["all", "new", "preparing", "on_the_way", "completed", "cancelled"];

  return (
    <>
      <PageHeader
        eyebrow={lockedStatus ? "Completed orders" : "Order management"}
        title={lockedStatus ? "Delivered orders" : "Orders"}
        description={
          lockedStatus
            ? "Every order that has been delivered, with its final total and timeline."
            : "Track incoming orders, move them through the workflow, and keep customers updated."
        }
        actions={
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={() => void refresh()}
            disabled={refreshing}
          >
            <RefreshCw size={14} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {message && <Alert tone="success">{message}</Alert>}
      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

      {lockedStatus && !loading && (
        <section
          className={styles.statGrid}
          aria-label="Completed order summary"
        >
          <article className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Completed orders</span>
              <span className={`${styles.statIcon} ${styles.toneIconGreen}`}>
                <CheckCircle2 size={16} />
              </span>
            </div>
            <strong className={styles.statValue}>{scopedOrders.length}</strong>
            <span className={styles.statHint}>Delivered to customers</span>
          </article>
          <article className={styles.statCard}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Completed sales</span>
              <span className={`${styles.statIcon} ${styles.toneIconRose}`}>
                <Wallet size={16} />
              </span>
            </div>
            <strong className={styles.statValue}>
              {formatPeso(completedRevenue)}
            </strong>
            <span className={styles.statHint}>
              Revenue from delivered orders
            </span>
          </article>
        </section>
      )}

      <section className={styles.panel}>
        {tabs.length > 0 && (
          <div
            className={styles.tabs}
            role="tablist"
            aria-label="Filter orders by status"
          >
            {tabs.map((status) => (
              <button
                key={status}
                type="button"
                role="tab"
                aria-selected={tab === status}
                className={`${styles.tab} ${
                  tab === status ? styles.tabActive : ""
                }`}
                onClick={() => setTab(status)}
              >
                {TAB_LABELS[status]}
                <span className={styles.tabCount}>{counts[status] ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by order code, customer, or product"
              aria-label="Search orders"
            />
          </label>
          <span className={styles.toolbarCount}>
            {filtered.length} of {countLabel(scopedOrders.length, "order")}
          </span>
        </div>

        {loading ? (
          <LoadingBlock label="Loading orders…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={28} />}
            title={
              scopedOrders.length === 0
                ? lockedStatus
                  ? "No completed orders yet"
                  : "No orders yet"
                : "No orders match"
            }
            description={
              scopedOrders.length === 0
                ? lockedStatus
                  ? "Orders appear here automatically once you mark them as delivered."
                  : "New orders from the customer shop will appear here."
                : "Try another search term or choose a different status tab."
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Products</th>
                  <th>Total</th>
                  <th>Delivery</th>
                  <th>Delivery driver</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => {
                  const customer = customerFor(order);
                  const actions = orderActions(order.status);
                  const primary = actions.find(
                    (action) => action.tone === "primary",
                  );
                  const itemCount = order.order_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  );

                  return (
                    <tr key={order.id}>
                      <td>
                        <span className={styles.code}>
                          {formatOrderCode(order.id)}
                        </span>
                        <div className={styles.muted}>
                          {itemCount} item{itemCount === 1 ? "" : "s"}
                        </div>
                      </td>
                      <td>
                        <div className={styles.customerCell}>
                          <span className={styles.avatarSmall}>
                            {(customer?.full_name || "C")
                              .trim()
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <strong>{customer?.full_name || "Customer"}</strong>
                            <small>
                              {customer?.email || "No email on file"}
                            </small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className={styles.itemsSummary}>
                          {order.order_items.slice(0, 3).map((item, index) => (
                            <span key={`${order.id}-${index}`}>
                              {item.quantity} × {item.product_name}
                            </span>
                          ))}
                          {order.order_items.length > 3 && (
                            <span>+ {order.order_items.length - 3} more</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{formatPeso(order.total)}</strong>
                      </td>
                      <td>
                        <div className={styles.itemsSummary}>
                          <span>{order.payment_method}</span>
                          <span>
                            {order.delivery_address || "Pickup at store"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {order.status === "on_the_way" && order.payment_method !== "Pickup and pay at store"
                          ? order.delivery_man_id
                            ? profileMap.get(order.delivery_man_id)?.full_name || "Driver details unavailable"
                            : "No driver assigned"
                          : "—"}
                      </td>
                      <td className={styles.muted}>
                        {formatDateTime(order.created_at)}
                      </td>
                      <td>
                        <StatusBadge status={order.status} />
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          {primary && (
                            <button
                              type="button"
                              className={`${styles.button} ${styles.primaryButton} ${styles.smallButton}`}
                              onClick={() =>
                                setPendingAction({ order, action: primary })
                              }
                            >
                              {primary.label}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                            onClick={() => openDetails(order)}
                          >
                            <Eye size={13} />
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={
          selected ? `Order ${formatOrderCode(selected.id)}` : "Order details"
        }
        subtitle={selected ? formatDateTime(selected.created_at) : undefined}
        wide
        footer={
          selected ? (
            <>
              <button
                type="button"
                className={`${styles.button} ${styles.secondaryButton}`}
                onClick={() => setSelected(null)}
              >
                Close
              </button>
              {orderActions(selected.status).map((action) => (
                <button
                  key={action.status}
                  type="button"
                  className={`${styles.button} ${
                    action.tone === "danger"
                      ? styles.dangerButton
                      : styles.primaryButton
                  }`}
                  onClick={() => setPendingAction({ order: selected, action })}
                >
                  {action.label}
                </button>
              ))}
            </>
          ) : undefined
        }
      >
        {selected && (
          <>
            <p className={styles.muted}>Delivery orders are automatically assigned to an available driver, one active order per driver.</p>
            <div className={styles.detailGrid}>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Customer</span>
                <span className={styles.detailValue}>
                  {customerFor(selected)?.full_name || "Customer"}
                </span>
                <span className={styles.muted}>
                  {customerFor(selected)?.email || "No email on file"}
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Current status</span>
                <span className={styles.detailValue}>
                  <StatusBadge status={selected.status} />
                </span>
              </div>
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Payment method</span>
                <span className={styles.detailValue}>
                  {selected.payment_method || "Cash on Delivery"}
                </span>
              </div>
              {selected.status === "on_the_way" && selected.payment_method !== "Pickup and pay at store" && (
                <div className={styles.detailBlock}>
                  <span className={styles.detailLabel}>Delivery driver</span>
                  <span className={styles.detailValue}>
                    {selected.delivery_man_id
                      ? profileMap.get(selected.delivery_man_id)?.full_name || "Driver details unavailable"
                      : "No driver assigned"}
                  </span>
                </div>
              )}
              <div className={styles.detailBlock}>
                <span className={styles.detailLabel}>Order total</span>
                <span className={styles.detailValue}>
                  {formatPeso(selected.total)}
                </span>
              </div>
              <div className={`${styles.detailBlock} ${styles.detailWide}`}>
                <span className={styles.detailLabel}>Delivery address</span>
                <span className={styles.detailValue}>
                  {selected.delivery_address || "Pickup at store"}
                </span>
              </div>
            </div>

            <div className={styles.panelHeader} style={{ marginTop: 18 }}>
              <div>
                <h3 className={styles.panelTitle}>Ordered products</h3>
                <p className={styles.panelSubtitle}>
                  {selected.order_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  )}{" "}
                  item
                  {selected.order_items.reduce(
                    (total, item) => total + item.quantity,
                    0,
                  ) === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>

            <ul className={styles.orderItems}>
              {selected.order_items.map((item, index) => (
                <li
                  key={`${selected.id}-detail-${index}`}
                  className={styles.orderItemRow}
                >
                  <span>
                    {item.quantity} × {item.product_name}
                  </span>
                  <strong>
                    {formatPeso(Number(item.unit_price) * item.quantity)}
                  </strong>
                </li>
              ))}
            </ul>

            <div className={styles.panelHeader} style={{ marginTop: 18 }}>
              <div>
                <h3 className={styles.panelTitle}>Status timeline</h3>
                <p className={styles.panelSubtitle}>
                  Every update is saved with its date and time.
                </p>
              </div>
            </div>

            {historyLoading ? (
              <LoadingBlock label="Loading status history…" />
            ) : historyError ? (
              <Alert tone="error">{historyError}</Alert>
            ) : history.length === 0 ? (
              <p className={styles.muted}>
                No status changes have been recorded for this order yet.
              </p>
            ) : (
              <ul className={styles.timeline}>
                {history.map((entry) => (
                  <li key={entry.id} className={styles.timelineItem}>
                    <span className={styles.timelineDot} aria-hidden="true" />
                    <div className={styles.timelineContent}>
                      <span className={styles.timelineStatus}>
                        <StatusBadge status={entry.status} />
                      </span>
                      <span className={styles.timelineTime}>
                        {formatDateTime(entry.created_at)}
                        {entry.note ? ` — ${entry.note}` : ""}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <p className={styles.hint} style={{ marginTop: 16 }}>
              <Bell size={12} /> Each status update automatically notifies the
              customer and is saved to the order history.
            </p>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.action.confirmTitle ?? ""}
        message={pendingAction?.action.confirmMessage ?? ""}
        confirmLabel={pendingAction?.action.confirmLabel ?? "Confirm"}
        tone={pendingAction?.action.tone ?? "primary"}
        busy={updating}
        onConfirm={() => void applyStatus()}
        onClose={() => {
          if (!updating) setPendingAction(null);
        }}
      />
    </>
  );
}
