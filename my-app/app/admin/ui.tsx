"use client";

import { useEffect, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { statusLabel, statusTone } from "@/utils/order-status";
import styles from "./admin.module.css";

const TONE_CLASS = {
  new: styles.toneNew,
  progress: styles.toneProgress,
  way: styles.toneWay,
  done: styles.toneDone,
  cancelled: styles.toneCancelled,
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.badge} ${TONE_CLASS[statusTone(status)]}`}>
      {statusLabel(status)}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeader}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageDescription}>{description}</p>
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: "success" | "error";
  children: ReactNode;
}) {
  return (
    <p
      className={`${styles.alert} ${
        tone === "success" ? styles.alertSuccess : styles.alertError
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className={styles.loadingBlock}>
      <span
        className={`${styles.spinner} ${styles.spinnerDark}`}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.empty}>
      {icon}
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function Modal({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`${styles.modal} ${wide ? styles.modalWide : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>{title}</h2>
            {subtitle && <p className={styles.modalSubtitle}>{subtitle}</p>}
          </div>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
        {footer && <div className={styles.modalFooter}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onClose}
            disabled={busy}
          >
            Keep it
          </button>
          <button
            type="button"
            className={`${styles.button} ${
              tone === "danger" ? styles.dangerButton : styles.primaryButton
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <span className={styles.spinner} aria-hidden="true" />}
            {busy ? "Saving…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className={styles.confirmBox}>
        <span
          className={`${styles.confirmIcon} ${
            tone === "primary" ? styles.confirmIconInfo : ""
          }`}
        >
          <AlertTriangle size={20} />
        </span>
        <p className={styles.confirmText}>{message}</p>
      </div>
    </Modal>
  );
}
