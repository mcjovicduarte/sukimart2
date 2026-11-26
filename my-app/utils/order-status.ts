export type OrderStatus =
  | "new"
  | "preparing"
  | "on_the_way"
  | "completed"
  | "cancelled";

export type StatusTone = "new" | "progress" | "way" | "done" | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "preparing",
  "on_the_way",
  "completed",
  "cancelled",
];

const LABELS: Record<string, string> = {
  new: "New order",
  preparing: "Preparing",
  on_the_way: "On the way",
  completed: "Completed",
  cancelled: "Cancelled",
  // Legacy values from the first version of the schema.
  pending: "New order",
  processing: "Preparing",
};

const TONES: Record<string, StatusTone> = {
  new: "new",
  preparing: "progress",
  on_the_way: "way",
  completed: "done",
  cancelled: "cancelled",
  pending: "new",
  processing: "progress",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, " ");
}

export function statusTone(status: string): StatusTone {
  return TONES[status] ?? "new";
}

export type OrderAction = {
  status: OrderStatus;
  label: string;
  tone: "primary" | "danger";
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel: string;
};

/**
 * The only status moves the admin UI offers. The database enforces the same
 * rules in update_order_status(), so a stale tab cannot skip a step.
 */
export function orderActions(status: string): OrderAction[] {
  switch (status) {
    case "new":
      return [
        {
          status: "preparing",
          label: "Start preparing",
          tone: "primary",
          confirmTitle: "Start preparing this order?",
          confirmMessage:
            "The customer will be notified that their order is being prepared.",
          confirmLabel: "Start preparing",
        },
        {
          status: "cancelled",
          label: "Cancel order",
          tone: "danger",
          confirmTitle: "Cancel this order?",
          confirmMessage:
            "The customer will be notified that the order was cancelled. This cannot be undone.",
          confirmLabel: "Cancel order",
        },
      ];
    case "preparing":
      return [
        {
          status: "on_the_way",
          label: "Out for delivery",
          tone: "primary",
          confirmTitle: "Send this order out for delivery?",
          confirmMessage:
            "The customer will be notified. Delivery orders will appear in the assigned delivery person's dashboard, or in the default delivery account if no one is assigned.",
          confirmLabel: "Out for delivery",
        },
        {
          status: "cancelled",
          label: "Cancel order",
          tone: "danger",
          confirmTitle: "Cancel this order?",
          confirmMessage:
            "The customer will be notified that the order was cancelled. This cannot be undone.",
          confirmLabel: "Cancel order",
        },
      ];
    case "on_the_way":
      return [
        {
          status: "completed",
          label: "Mark as delivered",
          tone: "primary",
          confirmTitle: "Mark this order as delivered?",
          confirmMessage:
            "The order will move to Completed and the customer will receive a delivery confirmation.",
          confirmLabel: "Mark delivered",
        },
      ];
    default:
      return [];
  }
}
