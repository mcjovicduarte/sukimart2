"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatDateTime, formatOrderCode, formatPeso } from "@/utils/format";
import { resolveProductImage } from "@/utils/product-images";
import ProductImage from "../product-image";
import { Alert, EmptyState, LoadingBlock, PageHeader, StatusBadge } from "./ui";
import styles from "./admin.module.css";

type OrderItem = { product_name: string; quantity: number };

type Order = {
  id: string;
  customer_id: string;
  total: number;
  status: string;
  created_at: string;
  delivery_address: string;
  payment_method: string;
  order_items: OrderItem[];
};

type Profile = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
};

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  image_url: string | null;
  active: boolean;
};

const ICON_TONES = {
  green: styles.toneIconGreen,
  amber: styles.toneIconAmber,
  blue: styles.toneIconBlue,
  violet: styles.toneIconViolet,
  rose: styles.toneIconRose,
  slate: styles.toneIconSlate,
} as const;

function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ReactNode;
  tone: keyof typeof ICON_TONES;
}) {
  return (
    <article className={styles.statCard}>
      <div className={styles.statTop}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statIcon} ${ICON_TONES[tone]}`}>{icon}</span>
      </div>
      <strong className={styles.statValue}>{value}</strong>
      <span className={styles.statHint}>{hint}</span>
    </article>
  );
}

export default function AdminDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [productResult, orderResult, profileResult] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,category,price,stock,image_url,active"),
      supabase
        .from("orders")
        .select(
          "id,customer_id,total,status,created_at,delivery_address,payment_method,order_items(product_name,quantity)",
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id,full_name,email,role"),
    ]);

    setErrorMessage("");
    if (productResult.error) {
      setErrorMessage(productResult.error.message);
    } else {
      setProducts((productResult.data as Product[]) ?? []);
    }

    if (orderResult.error) {
      setErrorMessage(
        `${orderResult.error.message} — run supabase/admin-dashboard.sql if you have not already.`,
      );
    } else {
      setOrders((orderResult.data as unknown as Order[]) ?? []);
    }

    if (!profileResult.error) {
      const rows = (profileResult.data as unknown as Profile[]) ?? [];
      setProfiles(rows);
      setCustomerCount(rows.filter((row) => row.role === "customer").length);
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

  const stats = useMemo(() => {
    const count = (status: string) =>
      orders.filter((order) => order.status === status).length;
    const sales = orders
      .filter((order) => order.status === "completed")
      .reduce((total, order) => total + Number(order.total), 0);

    return {
      totalOrders: orders.length,
      newOrders: count("new"),
      preparing: count("preparing"),
      onTheWay: count("on_the_way"),
      completed: count("completed"),
      cancelled: count("cancelled"),
      sales,
    };
  }, [orders]);

  const lowStock = useMemo(
    () =>
      products
        .filter((product) => product.stock <= 5)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
    [products],
  );

  const customerMap = useMemo(() => {
    const map = new Map<string, Profile>();
    profiles.forEach((profile) => map.set(profile.user_id, profile));
    return map;
  }, [profiles]);

  const recentOrders = orders.slice(0, 8);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Store dashboard"
        description="A live snapshot of stock, orders, and sales at Sukimart."
        actions={
          <>
            <button
              type="button"
              className={`${styles.button} ${styles.secondaryButton}`}
              onClick={() => void refresh()}
              disabled={refreshing}
            >
              <RefreshCw size={14} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <Link
              href="/admin/orders"
              className={`${styles.button} ${styles.primaryButton}`}
            >
              Manage orders
              <ArrowRight size={14} />
            </Link>
          </>
        }
      />

      {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

      {loading ? (
        <section className={styles.panel}>
          <LoadingBlock label="Loading your dashboard…" />
        </section>
      ) : (
        <>
          <section className={styles.statGrid} aria-label="Store summary">
            <StatCard
              label="Total products"
              value={products.length}
              hint={`${products.filter((product) => product.active).length} visible in shop`}
              icon={<Package size={16} />}
              tone="green"
            />
            <StatCard
              label="Total orders"
              value={stats.totalOrders}
              hint={`${stats.cancelled} cancelled`}
              icon={<ClipboardList size={16} />}
              tone="slate"
            />
            <StatCard
              label="New orders"
              value={stats.newOrders}
              hint="Waiting to be prepared"
              icon={<Bell size={16} />}
              tone="blue"
            />
            <StatCard
              label="Preparing"
              value={stats.preparing}
              hint="Being packed now"
              icon={<ChefHat size={16} />}
              tone="amber"
            />
            <StatCard
              label="On the way"
              value={stats.onTheWay}
              hint="Out for delivery"
              icon={<Truck size={16} />}
              tone="violet"
            />
            <StatCard
              label="Completed"
              value={stats.completed}
              hint="Delivered orders"
              icon={<CheckCircle2 size={16} />}
              tone="green"
            />
            <StatCard
              label="Total sales"
              value={formatPeso(stats.sales)}
              hint="From completed orders"
              icon={<Wallet size={16} />}
              tone="rose"
            />
            <StatCard
              label="Customers"
              value={customerCount}
              hint="Registered shoppers"
              icon={<Users size={16} />}
              tone="slate"
            />
          </section>

          <div className={styles.splitGrid}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Recent orders</h2>
                  <p className={styles.panelSubtitle}>
                    The latest orders placed in your store.
                  </p>
                </div>
                <Link href="/admin/orders" className={styles.panelLink}>
                  View all
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag size={26} />}
                  title="No orders yet"
                  description="Orders placed in the customer shop will appear here with their status and total."
                />
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Customer</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Placed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id}>
                          <td>
                            <span className={styles.code}>
                              {formatOrderCode(order.id)}
                            </span>
                          </td>
                          <td>
                            {customerMap.get(order.customer_id)?.full_name ||
                              "Customer"}
                          </td>
                          <td>
                            {order.order_items.reduce(
                              (total, item) => total + item.quantity,
                              0,
                            )}
                          </td>
                          <td>{formatPeso(order.total)}</td>
                          <td>
                            <StatusBadge status={order.status} />
                          </td>
                          <td className={styles.muted}>
                            {formatDateTime(order.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>Low stock</h2>
                  <p className={styles.panelSubtitle}>
                    Products with five pieces or fewer.
                  </p>
                </div>
                <Link href="/admin/products" className={styles.panelLink}>
                  Restock
                </Link>
              </div>

              {lowStock.length === 0 ? (
                <EmptyState
                  icon={<Package size={26} />}
                  title="Stock looks healthy"
                  description="No product is running low right now."
                />
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <tbody>
                      {lowStock.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <div className={styles.productCell}>
                              <ProductImage
                                src={resolveProductImage(product)}
                                alt={product.name}
                                className={styles.thumb}
                              />
                              <div className={styles.productCellText}>
                                <strong>{product.name}</strong>
                                <small>{product.category}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`${styles.stock} ${
                                product.stock === 0
                                  ? styles.stockOut
                                  : styles.stockLow
                              }`}
                            >
                              {product.stock === 0
                                ? "Out of stock"
                                : `${product.stock} left`}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {stats.newOrders > 0 && (
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <h2 className={styles.panelTitle}>
                    {stats.newOrders} new order
                    {stats.newOrders === 1 ? "" : "s"} need attention
                  </h2>
                  <p className={styles.panelSubtitle}>
                    Start preparing them so customers know their order is
                    moving.
                  </p>
                </div>
                <Link
                  href="/admin/orders"
                  className={`${styles.button} ${styles.primaryButton} ${styles.smallButton}`}
                >
                  Open orders
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      {!loading && errorMessage && (
        <p className={styles.muted}>
          <AlertTriangle size={13} /> Some numbers may be incomplete until the
          database setup finishes.
        </p>
      )}
    </>
  );
}
