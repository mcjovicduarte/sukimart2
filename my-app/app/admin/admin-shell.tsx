"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Users,
  Truck,
  MapPin,
  X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { initials } from "@/utils/format";
import styles from "./admin.module.css";
import UnreadBadge from "../chat/unread";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/products", label: "Product Management", icon: Package },
  { href: "/admin/orders", label: "Order Management", icon: ClipboardList },
  { href: "/admin/completed", label: "Completed Orders", icon: CheckCircle2 },
  { href: "/admin/customers", label: "Customer Management", icon: Users },
  { href: "/admin/drivers", label: "Delivery Drivers", icon: Truck },
  { href: "/admin/store-location", label: "Store Location", icon: MapPin },
  { href: "/admin/messages", label: "Messages", icon: MessageCircle },
  { href: "/admin/reports", label: "Reports and Sales", icon: BarChart3 },
];

export default function AdminShell({
  children,
  adminName,
  adminEmail,
}: {
  children: React.ReactNode;
  adminName: string;
  adminEmail: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      setSigningOut(false);
      return;
    }
    router.replace("/");
  };

  return (
    <div className={styles.shell}>
      <aside
        className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ""}`}
        aria-label="Admin navigation"
      >
        <div className={styles.brandRow}>
          <Link
            href="/admin"
            className={styles.brand}
            onClick={() => setMenuOpen(false)}
          >
            <span className={styles.brandIcon}>
              <Image
                src="/sukimart-logo.png"
                alt=""
                width={42}
                height={36}
                className={styles.logoImage}
              />
            </span>
            <span>
              Suki<span className={styles.brandAccent}>mart</span>
            </span>
          </Link>
          <button
            type="button"
            className={styles.closeMenu}
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={17} />
          </button>
        </div>

        <p className={styles.sidebarLabel}>Admin workspace</p>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`${styles.navLink} ${
                  active ? styles.navLinkActive : ""
                }`}
                aria-current={active ? "page" : undefined}
              >
                <item.icon size={17} strokeWidth={2} />
                <span>{item.label}</span>
                {item.href === "/admin/messages" && <UnreadBadge />}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/admin/account" className={styles.adminCard} onClick={() => setMenuOpen(false)} aria-label="Open my account profile">
            <span className={styles.avatar}>{initials(adminName)}</span>
            <div>
              <strong>{adminName}</strong>
              <small>{adminEmail}</small>
            </div>
          </Link>

          <button
            type="button"
            className={styles.logoutButton}
            onClick={() => void signOut()}
            disabled={signingOut}
          >
            <LogOut size={16} />
            {signingOut ? "Signing out…" : "Logout"}
          </button>
        </div>
      </aside>

      {menuOpen && (
        <button
          type="button"
          className={styles.scrim}
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <div className={styles.main}>
        <header className={styles.mobileBar}>
          <button
            type="button"
            className={styles.menuButton}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
          <Link href="/admin" className={styles.mobileBrand}>
            <Image
              src="/sukimart-logo.png"
              alt=""
              width={36}
              height={28}
              className={styles.logoImage}
            />{" "}
            Sukimart Admin
          </Link>
          <span className={styles.viewShop}>Store manager</span>
        </header>

        <div className={styles.pageContent}>{children}</div>
      </div>
    </div>
  );
}
