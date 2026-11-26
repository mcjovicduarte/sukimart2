"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import styles from "./chat.module.css";

export default function UnreadBadge() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data, error } = await createClient().rpc("chat_unread_counts");
      if (active && !error)
        setCount(
          (data || []).reduce(
            (sum: number, row: { unread_count: number | string }) =>
              sum + Number(row.unread_count),
            0,
          ),
        );
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    window.addEventListener("sukimart-chat-read", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("sukimart-chat-read", refresh);
    };
  }, []);
  return count > 0 ? (
    <span className={styles.unread} aria-label={`${count} unread messages`}>
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
