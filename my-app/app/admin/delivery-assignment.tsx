"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function DeliveryAssignment({ orderId }: { orderId: string }) {
  const [drivers, setDrivers] = useState<
    { user_id: string; full_name: string; email: string }[]
  >([]);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const client = createClient();
    void Promise.all([
      client
        .from("profiles")
        .select("user_id,full_name,email")
        .eq("role", "delivery"),
      client
        .from("orders")
        .select("delivery_man_id")
        .eq("id", orderId)
        .single(),
    ]).then(([p, o]) => {
      if (o.error) {
        setMessage(
          "Delivery assignment requires the delivery database migration.",
        );
        return;
      }
      setDrivers(p.data || []);
      setValue(o.data?.delivery_man_id || "");
    });
  }, [orderId]);
  return (
    <div style={{ marginBottom: 20 }}>
      <label>
        Delivery person{" "}
        <select
          value={value}
          onChange={async (e) => {
            const next = e.target.value;
            const { error } = await createClient().rpc("assign_delivery", {
              p_order_id: orderId,
              p_driver_id: next || null,
            });
            if (error) setMessage(error.message);
            else {
              setValue(next);
              setMessage("Delivery assignment saved.");
            }
          }}
        >
          <option value="">Unassigned</option>
          {drivers.map((d) => (
            <option key={d.user_id} value={d.user_id}>
              {d.full_name || d.email}
            </option>
          ))}
        </select>
      </label>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
