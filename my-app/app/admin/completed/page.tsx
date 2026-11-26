import OrdersManager from "../orders-manager";

export default function AdminCompletedOrdersPage() {
  return <OrdersManager lockedStatus="completed" />;
}
