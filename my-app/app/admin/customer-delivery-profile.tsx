"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

type Details = {
  phone: string;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
};
export default function CustomerDeliveryProfile({
  userId,
}: {
  userId: string;
}) {
  const [details, setDetails] = useState<Details | null>(null);
  useEffect(() => {
    let active = true;
    void createClient()
      .from("profiles")
      .select("phone,delivery_address,delivery_lat,delivery_lng")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setDetails(data);
      });
    return () => {
      active = false;
    };
  }, [userId]);
  if (!details) return null;
  const coordinates =
    details.delivery_lat != null && details.delivery_lng != null
      ? `${details.delivery_lat},${details.delivery_lng}`
      : "";
  return (
    <div style={{ margin: "16px 0" }}>
      <strong>Saved delivery details</strong>
      <p>{details.delivery_address || "No saved address"}</p>
      <p>{details.phone || "No contact number"}</p>
      {coordinates && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`}
          target="_blank"
          rel="noreferrer"
        >
          View saved location on Google Maps
        </a>
      )}
      <p>Orders retain the address and pin confirmed at checkout.</p>
    </div>
  );
}
