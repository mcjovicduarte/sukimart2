"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { formatDateTime, formatOrderCode, formatPeso } from "@/utils/format";
import styles from "./customer-shop.module.css";

type ReceiptOrder = {
  id: string;
  created_at: string;
  total: number;
  delivery_address: string;
  payment_method: string;
  order_items: { product_name: string; quantity: number; unit_price: number }[];
};

export default function OrderReceipt({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data, error: queryError } = await createClient().from("orders")
          .select("id,created_at,total,delivery_address,payment_method,order_items(product_name,quantity,unit_price)")
          .eq("id", orderId).single();
        if (!active) return;
        if (queryError || !data) {
          setError("The receipt could not be loaded. Your order was already placed; please retry or open it from Recent Orders.");
        } else {
          setOrder(data as unknown as ReceiptOrder);
          setError("");
        }
      } catch {
        if (active) setError("The receipt could not be loaded. Your order was already placed; check your connection and retry.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [orderId, attempt]);

  const download = useCallback(() => {
    if (!order) return;
    const lines = ["              SUKIMART", "          ORDER RECEIPT", "----------------------------------------", `Order: ${formatOrderCode(order.id)}`, `Order ID: ${order.id}`,
      `Date: ${formatDateTime(order.created_at)}`, `Payment method: ${order.payment_method || "Not specified"}`,
      `Delivery address: ${order.delivery_address || "Pickup at store"}`, "----------------------------------------", "ITEMS",
      ...order.order_items.flatMap(item => [item.product_name, `  ${item.quantity} x ${formatPeso(item.unit_price)}    ${formatPeso(Number(item.unit_price) * item.quantity)}`]),
      "----------------------------------------", `TOTAL: ${formatPeso(order.total)}`, "----------------------------------------", "Thank you for shopping at SukiMart!", "This is an order receipt, not proof of payment.", ""];
    const url = URL.createObjectURL(new Blob(["\uFEFF", lines.join("\r\n")], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `SukiMart-receipt-${order.id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [order]);

  return <div className={styles.modalOverlay} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={styles.checkoutModal} role="dialog" aria-modal="true" aria-labelledby="receipt-title">
      <div className={styles.modalHeader}><div><h2 id="receipt-title">Your receipt</h2><p>A summary of your SukiMart order.</p></div><button type="button" className={styles.modalClose} aria-label="Close receipt" onClick={onClose}><X size={16} /></button></div>
      <div className={styles.checkoutBody}>
        {loading && <p role="status">Loading your receipt…</p>}
        {error && <><p className={styles.locationError} role="alert">{error}</p><button type="button" className={styles.locationButton} onClick={() => { setLoading(true); setError(""); setAttempt(value => value + 1); }}>Try again</button></>}
        {order && <article className={styles.receiptPaper} aria-label="Order receipt details">
          <header className={styles.receiptBrand}><Image src="/sukimart-logo.png" width={92} height={66} alt="SukiMart" /><strong>SukiMart</strong><span>YOUR NEIGHBORHOOD STORE</span><h3>ORDER RECEIPT</h3></header>
          <div className={styles.receiptDetails}><div><span>Order</span><strong>{formatOrderCode(order.id)}</strong></div><div><span>Date</span><strong>{formatDateTime(order.created_at)}</strong></div><div><span>Payment</span><strong>{order.payment_method || "Not specified"}</strong></div><div><span>Delivery address</span><strong>{order.delivery_address || "Pickup at store"}</strong></div><div><span>Order ID</span><strong className={styles.receiptId}>{order.id}</strong></div></div>
          <div className={styles.receiptItems}><div className={styles.receiptItemsHeading}><span>ITEM</span><span>AMOUNT</span></div>{order.order_items.map((item, index) => <div className={styles.receiptItem} key={`${item.product_name}-${index}`}><div><strong>{item.product_name}</strong><small>{item.quantity} × {formatPeso(item.unit_price)}</small></div><strong>{formatPeso(Number(item.unit_price) * item.quantity)}</strong></div>)}</div>
          <div className={styles.receiptTotal}><span>TOTAL</span><strong>{formatPeso(order.total)}</strong></div>
          <footer className={styles.receiptThankYou}><strong>Thank you for shopping with us!</strong><span>This is an order receipt, not proof of payment.</span></footer>
        </article>}
      </div>
      <div className={styles.checkoutFooter}><button type="button" className={`${styles.checkoutButton} ${styles.checkoutSecondary}`} onClick={onClose}>Close</button><button type="button" className={styles.checkoutButton} disabled={!order} onClick={download}>Download receipt (.txt)</button></div>
    </section>
  </div>;
}
