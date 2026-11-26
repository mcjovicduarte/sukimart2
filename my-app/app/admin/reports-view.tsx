"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Package,
  RefreshCw,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatDate, formatOrderCode, formatPeso } from "@/utils/format";
import { ORDER_STATUSES, statusLabel, statusTone } from "@/utils/order-status";
import { Alert, EmptyState, LoadingBlock, PageHeader } from "./ui";
import styles from "./admin.module.css";

type Order = {
  id: string;
  customer_id: string;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type OrderItem = {
  order_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
};

type Profile = {
  user_id: string;
  full_name: string;
  email: string;
};

const STATUS_COLORS: Record<string, string> = {
  new: "#0ea5e9",
  preparing: "#f59e0b",
  on_the_way: "#8b5cf6",
  completed: "#5c899d",
  cancelled: "#ef4444",
};

const TONE_CLASS = {
  new: styles.toneNew,
  progress: styles.toneProgress,
  way: styles.toneWay,
  done: styles.toneDone,
  cancelled: styles.toneCancelled,
};

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function shortPeso(value: number) {
  return `₱${Math.round(value).toLocaleString("en-PH")}`;
}

export default function ReportsView() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [orderResult, itemResult, profileResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,customer_id,total,status,created_at,updated_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("order_items")
        .select("order_id,product_name,quantity,unit_price"),
      supabase.from("profiles").select("user_id,full_name,email"),
    ]);

    setErrorMessage("");
    if (orderResult.error) {
      setErrorMessage(
        `${orderResult.error.message} — run supabase/admin-dashboard.sql in the Supabase SQL Editor if you have not already.`,
      );
      setLoading(false);
      return;
    }
    if (itemResult.error) {
      setErrorMessage(itemResult.error.message);
      setLoading(false);
      return;
    }

    setOrders((orderResult.data as unknown as Order[]) ?? []);
    setOrderItems((itemResult.data as unknown as OrderItem[]) ?? []);
    if (!profileResult.error) {
      setProfiles((profileResult.data as unknown as Profile[]) ?? []);
    }
    setLoading(false);
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

  const report = useMemo(() => {
    const completed = orders.filter((order) => order.status === "completed");
    const completedIds = new Set(completed.map((order) => order.id));
    const sales = completed.reduce(
      (total, order) => total + Number(order.total),
      0,
    );
    const completedItems = orderItems.filter((item) =>
      completedIds.has(item.order_id),
    );
    const itemsSold = completedItems.reduce(
      (total, item) => total + item.quantity,
      0,
    );

    const active = orders.filter((order) =>
      ["new", "preparing", "on_the_way"].includes(order.status),
    );
    const activeValue = active.reduce(
      (total, order) => total + Number(order.total),
      0,
    );

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthCompleted = completed.filter(
      (order) => new Date(order.updated_at) >= monthStart,
    );
    const monthSales = monthCompleted.reduce(
      (total, order) => total + Number(order.total),
      0,
    );

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: dayKey(date),
        label: new Intl.DateTimeFormat("en-PH", {
          weekday: "short",
          day: "numeric",
        }).format(date),
        value: 0,
      };
    });
    const dayMap = new Map(days.map((day) => [day.key, day]));
    completed.forEach((order) => {
      const key = dayKey(new Date(order.updated_at));
      const day = dayMap.get(key);
      if (day) day.value += Number(order.total);
    });
    const chartMax = Math.max(...days.map((day) => day.value), 1);

    const productTotals = new Map<
      string,
      { name: string; quantity: number; revenue: number }
    >();
    completedItems.forEach((item) => {
      const current = productTotals.get(item.product_name) ?? {
        name: item.product_name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += Number(item.unit_price) * item.quantity;
      productTotals.set(item.product_name, current);
    });
    const topProducts = Array.from(productTotals.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    const statusCounts = ORDER_STATUSES.map((status) => ({
      status,
      count: orders.filter((order) => order.status === status).length,
    }));

    const recentCompleted = [...completed]
      .sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      )
      .slice(0, 6);

    return {
      sales,
      completedCount: completed.length,
      averageOrder: completed.length > 0 ? sales / completed.length : 0,
      itemsSold,
      activeCount: active.length,
      activeValue,
      monthSales,
      monthCount: monthCompleted.length,
      cancelledCount: orders.filter((order) => order.status === "cancelled")
        .length,
      totalOrders: orders.length,
      days,
      chartMax,
      topProducts,
      statusCounts,
      recentCompleted,
    };
  }, [orderItems, orders]);

  return (
    <>
      <PageHeader
        eyebrow="Reports and sales"
        title="Store performance"
        description="Sales, best sellers, and order volume pulled straight from the database."
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

      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

      {loading ? (
        <section className={styles.panel}>
          <LoadingBlock label="Crunching your sales numbers…" />
        </section>
      ) : (
        <>
          <section className={styles.reportGrid} aria-label="Sales summary">
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Total sales</span>
              <strong className={styles.bigNumber}>
                {formatPeso(report.sales)}
              </strong>
              <span className={styles.statHint}>From completed orders</span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Completed orders</span>
              <strong className={styles.bigNumber}>
                {report.completedCount}
              </strong>
              <span className={styles.statHint}>
                {report.totalOrders} orders placed in total
              </span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Average order value</span>
              <strong className={styles.bigNumber}>
                {formatPeso(report.averageOrder)}
              </strong>
              <span className={styles.statHint}>Across completed orders</span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Items sold</span>
              <strong className={styles.bigNumber}>{report.itemsSold}</strong>
              <span className={styles.statHint}>
                Pieces in delivered orders
              </span>
            </article>
          </section>

          <section
            className={styles.reportGrid}
            aria-label="More sales metrics"
          >
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Sales this month</span>
              <strong className={styles.bigNumber}>
                {formatPeso(report.monthSales)}
              </strong>
              <span className={styles.statHint}>
                {report.monthCount} completed order
                {report.monthCount === 1 ? "" : "s"} since the 1st
              </span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Active orders</span>
              <strong className={styles.bigNumber}>{report.activeCount}</strong>
              <span className={styles.statHint}>
                {formatPeso(report.activeValue)} in progress
              </span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Cancelled orders</span>
              <strong className={styles.bigNumber}>
                {report.cancelledCount}
              </strong>
              <span className={styles.statHint}>Not included in sales</span>
            </article>
            <article className={styles.reportCard}>
              <span className={styles.reportLabel}>Top product</span>
              <strong className={styles.bigNumber} style={{ fontSize: 18 }}>
                {report.topProducts[0]?.name ?? "No sales yet"}
              </strong>
              <span className={styles.statHint}>
                {report.topProducts[0]
                  ? `${report.topProducts[0].quantity} sold · ${formatPeso(
                      report.topProducts[0].revenue,
                    )}`
                  : "Delivered orders will rank products here"}
              </span>
            </article>
          </section>

          <div className={styles.splitGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Last 7 days</h2>
                  <p className={styles.panelSubtitle}>
                    Completed sales by delivery day.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.toneDone}`}>
                  <TrendingUp size={11} />{" "}
                  {formatPeso(
                    report.days.reduce((total, day) => total + day.value, 0),
                  )}
                </span>
              </div>

              <div className={styles.barChart}>
                {report.days.map((day) => (
                  <div key={day.key} className={styles.barRow}>
                    <span className={styles.barLabel}>{day.label}</span>
                    <span className={styles.barTrack}>
                      <span
                        className={styles.barFill}
                        style={{
                          width: `${Math.max(
                            (day.value / report.chartMax) * 100,
                            day.value > 0 ? 4 : 0,
                          )}%`,
                        }}
                      />
                    </span>
                    <span className={styles.barValue}>
                      {day.value > 0 ? shortPeso(day.value) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Order status</h2>
                  <p className={styles.panelSubtitle}>
                    Where every order stands right now.
                  </p>
                </div>
              </div>

              {report.totalOrders === 0 ? (
                <EmptyState
                  icon={<ClipboardList size={26} />}
                  title="No orders yet"
                  description="Status counts appear once customers start ordering."
                />
              ) : (
                <div className={styles.barChart}>
                  {report.statusCounts.map((entry) => (
                    <div key={entry.status} className={styles.barRow}>
                      <span className={styles.barLabel}>
                        {statusLabel(entry.status)}
                      </span>
                      <span className={styles.barTrack}>
                        <span
                          className={styles.barFill}
                          style={{
                            width: `${
                              (entry.count / Math.max(report.totalOrders, 1)) *
                              100
                            }%`,
                            background:
                              STATUS_COLORS[entry.status] ?? "#5c899d",
                          }}
                        />
                      </span>
                      <span className={styles.barValue}>{entry.count}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.inlineBadges} style={{ marginTop: 16 }}>
                {report.statusCounts.map((entry) => (
                  <span
                    key={`badge-${entry.status}`}
                    className={`${styles.badge} ${TONE_CLASS[statusTone(entry.status)]}`}
                  >
                    {entry.count} {statusLabel(entry.status)}
                  </span>
                ))}
              </div>
            </section>
          </div>

          <div className={styles.splitGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Best-selling products</h2>
                  <p className={styles.panelSubtitle}>
                    Ranked by revenue from completed orders.
                  </p>
                </div>
                <span className={`${styles.badge} ${styles.toneMuted}`}>
                  <Package size={11} /> {report.itemsSold} items sold
                </span>
              </div>

              {report.topProducts.length === 0 ? (
                <EmptyState
                  icon={<Package size={26} />}
                  title="No product sales yet"
                  description="Once orders are delivered, your best sellers will appear here."
                />
              ) : (
                <ul className={styles.topList}>
                  {report.topProducts.map((product, index) => (
                    <li key={product.name} className={styles.topItem}>
                      <span className={styles.topRank}>{index + 1}</span>
                      <div>
                        <div className={styles.topName}>{product.name}</div>
                        <div className={styles.topMeta}>
                          {product.quantity} sold
                        </div>
                      </div>
                      <span className={styles.topValue}>
                        {formatPeso(product.revenue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Recent deliveries</h2>
                  <p className={styles.panelSubtitle}>
                    The latest completed orders.
                  </p>
                </div>
              </div>

              {report.recentCompleted.length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 size={26} />}
                  title="Nothing delivered yet"
                  description="Completed orders will show up here with their totals."
                />
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Total</th>
                        <th>Delivered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.recentCompleted.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <span className={styles.code}>
                              {formatOrderCode(order.id)}
                            </span>
                          </td>
                          <td>
                            {profileMap.get(order.customer_id)?.full_name ||
                              "Customer"}
                          </td>
                          <td>
                            <strong>{formatPeso(order.total)}</strong>
                          </td>
                          <td className={styles.muted}>
                            {formatDate(order.updated_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <p className={styles.hint}>
            <BarChart3 size={12} /> Sales only count orders marked as completed.
            Numbers update as soon as an order status changes.
          </p>
        </>
      )}
    </>
  );
}
