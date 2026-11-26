import AdminDashboard from "./dashboard";

// The parent layout authenticates at request time, so this page may block too.
export const instant = false;

export default function AdminPage() {
  return <AdminDashboard />;
}
