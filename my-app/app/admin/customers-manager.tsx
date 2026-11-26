"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  RefreshCw,
  Search,
  ShoppingBag,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import {
  countLabel,
  formatDate,
  formatDateTime,
  formatOrderCode,
  formatPeso,
  initials,
} from "@/utils/format";
import {
  Alert,
  EmptyState,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
} from "./ui";
import styles from "./admin.module.css";
import CustomerDeliveryProfile from "./customer-delivery-profile";

type Profile = {
  user_id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
};

type Order = {
  id: string;
  customer_id: string;
  total: number;
  status: string;
  created_at: string;
};

type CustomerRow = Profile & {
  orders: Order[];
  orderCount: number;
  completedCount: number;
  spent: number;
  lastOrder: string | null;
};

type CustomerFilter = "all" | "with-orders" | "no-orders";
type SortMode = "newest" | "orders" | "spend";

export default function CustomersManager() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [viewing, setViewing] = useState<CustomerRow | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [profileResult, orderResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id,full_name,email,role,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("id,customer_id,total,status,created_at")
        .order("created_at", { ascending: false }),
    ]);

    setErrorMessage("");
    if (profileResult.error) {
      setErrorMessage(
        `${profileResult.error.message} — run supabase/admin-dashboard.sql if the email column is missing.`,
      );
      setLoading(false);
      return;
    }
    if (orderResult.error) {
      setErrorMessage(orderResult.error.message);
      setLoading(false);
      return;
    }

    setProfiles((profileResult.data as unknown as Profile[]) ?? []);
    setOrders((orderResult.data as unknown as Order[]) ?? []);
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

  const customers = useMemo<CustomerRow[]>(() => {
    const ordersByCustomer = new Map<string, Order[]>();
    orders.forEach((order) => {
      const list = ordersByCustomer.get(order.customer_id) ?? [];
      list.push(order);
      ordersByCustomer.set(order.customer_id, list);
    });

    return profiles
      .filter((profile) => profile.role === "customer")
      .map((profile) => {
        const customerOrders = ordersByCustomer.get(profile.user_id) ?? [];
        const completed = customerOrders.filter(
          (order) => order.status === "completed",
        );
        return {
          ...profile,
          orders: customerOrders,
          orderCount: customerOrders.length,
          completedCount: completed.length,
          spent: completed.reduce(
            (total, order) => total + Number(order.total),
            0,
          ),
          lastOrder: customerOrders[0]?.created_at ?? null,
        };
      });
  }, [orders, profiles]);

  const summary = useMemo(
    () => ({
      total: customers.length,
      withOrders: customers.filter((customer) => customer.orderCount > 0)
        .length,
      repeat: customers.filter((customer) => customer.orderCount > 1).length,
      spend: customers.reduce((total, customer) => total + customer.spent, 0),
    }),
    [customers],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = customers.filter((customer) => {
      const matchesSearch =
        query === "" ||
        customer.full_name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query);
      const matchesFilter =
        filter === "all" ||
        (filter === "with-orders" && customer.orderCount > 0) ||
        (filter === "no-orders" && customer.orderCount === 0);
      return matchesSearch && matchesFilter;
    });

    return [...rows].sort((a, b) => {
      if (sort === "orders") return b.orderCount - a.orderCount;
      if (sort === "spend") return b.spent - a.spent;
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [customers, filter, search, sort]);

  return (
    <>
      <PageHeader
        eyebrow="Customer management"
        title="Your customers"
        description="See who shops at Sukimart, what they order, and how much they spend."
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

      <section className={styles.statGrid} aria-label="Customer summary">
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Total customers</span>
            <span className={`${styles.statIcon} ${styles.toneIconGreen}`}>
              <Users size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.total}</strong>
          <span className={styles.statHint}>Registered shopper accounts</span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Have ordered</span>
            <span className={`${styles.statIcon} ${styles.toneIconBlue}`}>
              <ShoppingBag size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.withOrders}</strong>
          <span className={styles.statHint}>
            Customers with at least one order
          </span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Repeat customers</span>
            <span className={`${styles.statIcon} ${styles.toneIconViolet}`}>
              <UserPlus size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>{summary.repeat}</strong>
          <span className={styles.statHint}>More than one order placed</span>
        </article>
        <article className={styles.statCard}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Customer spend</span>
            <span className={`${styles.statIcon} ${styles.toneIconRose}`}>
              <Wallet size={16} />
            </span>
          </div>
          <strong className={styles.statValue}>
            {formatPeso(summary.spend)}
          </strong>
          <span className={styles.statHint}>From completed orders</span>
        </article>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchField}>
            <Search size={15} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by customer name or email"
              aria-label="Search customers"
            />
          </label>

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as CustomerFilter)
            }
            aria-label="Filter customers"
          >
            <option value="all">All customers</option>
            <option value="with-orders">With orders</option>
            <option value="no-orders">No orders yet</option>
          </select>

          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
            aria-label="Sort customers"
          >
            <option value="newest">Newest first</option>
            <option value="orders">Most orders</option>
            <option value="spend">Highest spend</option>
          </select>

          <span className={styles.toolbarCount}>
            {filtered.length} of {countLabel(customers.length, "customer")}
          </span>
        </div>

        {loading ? (
          <LoadingBlock label="Loading customers…" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={28} />}
            title={
              customers.length === 0 ? "No customers yet" : "No customers match"
            }
            description={
              customers.length === 0
                ? "Customers appear here after they create an account on the register page."
                : "Try another search term or clear the filters."
            }
          />
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Joined</th>
                  <th>Orders</th>
                  <th>Completed</th>
                  <th>Total spent</th>
                  <th>Last order</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((customer) => (
                  <tr key={customer.user_id}>
                    <td>
                      <div className={styles.customerCell}>
                        <span className={styles.avatarSmall}>
                          {initials(customer.full_name, "CU")}
                        </span>
                        <div>
                          <strong>
                            {customer.full_name || "Sukimart customer"}
                          </strong>
                          <small>{customer.email || "No email on file"}</small>
                        </div>
                      </div>
                    </td>
                    <td className={styles.muted}>
                      {formatDate(customer.created_at)}
                    </td>
                    <td>{customer.orderCount}</td>
                    <td>{customer.completedCount}</td>
                    <td>
                      <strong>{formatPeso(customer.spent)}</strong>
                    </td>
                    <td className={styles.muted}>
                      {customer.lastOrder
                        ? formatDateTime(customer.lastOrder)
                        : "No orders yet"}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.ghostButton} ${styles.smallButton}`}
                          onClick={() => setViewing(customer)}
                        >
                          View customer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={viewing?.full_name || "Customer profile"}
        subtitle={viewing?.email || "No email on file"}
        wide
        footer={
          <button
            type="button"
            className={`${styles.button} ${styles.primaryButton}`}
            onClick={() => setViewing(null)}
          >
            Done
          </button>
        }
      >
        {viewing && (
          <>
            <CustomerDeliveryProfile userId={viewing.user_id} />
            <div className={styles.customerProfile}>
              <span className={styles.avatarLarge}>
                {initials(viewing.full_name, "CU")}
              </span>
              <div>
                <strong>{viewing.full_name || "Sukimart customer"}</strong>
                <span>
                  <Mail size={12} /> {viewing.email || "No email on file"}
                </span>
                <span>Joined {formatDate(viewing.created_at)}</span>
              </div>
            </div>

            <div className={styles.statGrid} style={{ marginTop: 16 }}>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>Orders placed</span>
                <strong className={styles.statValue}>
                  {viewing.orderCount}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>Completed</span>
                <strong className={styles.statValue}>
                  {viewing.completedCount}
                </strong>
              </article>
              <article className={styles.statCard}>
                <span className={styles.statLabel}>Total spent</span>
                <strong className={styles.statValue}>
                  {formatPeso(viewing.spent)}
                </strong>
              </article>
            </div>

            <div className={styles.panelHeader} style={{ marginTop: 20 }}>
              <div>
                <h3 className={styles.panelTitle}>Order history</h3>
                <p className={styles.panelSubtitle}>
                  Every order this customer has placed.
                </p>
              </div>
            </div>

            {viewing.orders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag size={24} />}
                title="No orders yet"
                description="This customer has not placed an order in the shop."
              />
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Placed</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewing.orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <span className={styles.code}>
                            {formatOrderCode(order.id)}
                          </span>
                        </td>
                        <td className={styles.muted}>
                          {formatDateTime(order.created_at)}
                        </td>
                        <td>
                          <StatusBadge status={order.status} />
                        </td>
                        <td>
                          <strong>{formatPeso(order.total)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
