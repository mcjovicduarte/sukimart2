"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import styles from "./customer-shop.module.css";

export type Coordinates = [number, number];

export default function LocationPicker({
  value,
  onChange,
}: {
  value: Coordinates | null;
  onChange: (value: Coordinates) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const onChangeRef = useRef(onChange);
  const [message, setMessage] = useState("");
  const [mapVersion, setMapVersion] = useState(0);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let cancelled = false;
    let instance: LeafletMap | null = null;
    void import("leaflet")
      .then((L) => {
        if (cancelled || !element.current) return;
        instance = L.map(element.current, {
          maxBounds: [
            [4.3, 118.5],
            [10.4, 127],
          ],
          maxBoundsViscosity: 1,
          minZoom: 6,
          zoomAnimation: false,
          fadeAnimation: false,
          markerZoomAnimation: false,
        }).setView([7.9, 124.8], 7, { animate: false });
        map.current = instance;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(instance);
        instance.on("click", (e) =>
          onChangeRef.current([e.latlng.lat, e.latlng.lng]),
        );
        setMapVersion((version) => version + 1);
      })
      .catch(() => {
        if (!cancelled) setMessage(
          "The map could not load. Check your internet connection and reopen checkout.",
        );
      });
    return () => {
      cancelled = true;
      if (instance) {
        instance.stop();
        instance.off();
        instance.remove();
        if (map.current === instance) map.current = null;
      }
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !map.current) return;
      marker.current?.remove();
      marker.current = null;
      if (value) {
        marker.current = L.circleMarker(value, {
          radius: 10,
          color: "#ce5129",
          fillOpacity: 0.9,
        })
          .addTo(map.current)
          .bindPopup("Your delivery location");
        map.current.setView(value, Math.max(map.current.getZoom(), 15), { animate: false });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [value, mapVersion]);
  const locate = () => {
    if (!window.isSecureContext)
      return setMessage(
        "Location requires HTTPS or localhost. You can tap the map instead.",
      );
    if (!navigator.geolocation)
      return setMessage(
        "Location services are unavailable. Tap the map instead.",
      );
    setMessage("Finding your location. Allow location access when prompted.");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (
          latitude < 4.3 ||
          latitude > 10.4 ||
          longitude < 118.5 ||
          longitude > 127
        )
          return setMessage(
            "Your device location is outside the Mindanao map area. Tap your delivery location on the map instead.",
          );
        onChange([latitude, longitude]);
        setMessage(
          `Device location found (estimated accuracy ${Math.round(position.coords.accuracy)} m). Check and adjust the pin before confirming.`,
        );
      },
      (error) =>
        setMessage(
          error.code === error.PERMISSION_DENIED
            ? "Location access was denied. Allow it in your browser and device settings, or tap the map instead."
            : "Could not find your location. Turn on device location or tap the map instead.",
        ),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  return (
    <div className={styles.locationPicker}>
      <p>
        Tap your store or delivery location on the map. Zoom in to place it
        accurately.
      </p>
      <button type="button" className={styles.locationButton} onClick={locate}>
        Use my current location
      </button>
      {message && <p role="status">{message}</p>}
      <div
        ref={element}
        className={styles.locationMap}
        aria-label="Map to select delivery location"
      />
      {value ? (
        <small>
          Selected location: {value[0].toFixed(6)}, {value[1].toFixed(6)}
        </small>
      ) : (
        <small>No location selected yet.</small>
      )}
    </div>
  );
}
