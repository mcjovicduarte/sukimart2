// Keep the tiers and formula in sync with supabase/store-location.sql.
const EARTH_RADIUS_KM = 6371;

export function deliveryMinimum(lat: number, lng: number, storeLat: number, storeLng: number) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat - storeLat) * rad / 2) ** 2 +
    Math.cos(storeLat * rad) * Math.cos(lat * rad) *
    Math.sin((lng - storeLng) * rad / 2) ** 2;
  const distance = 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, a)));
  const minimum = distance <= 3 ? 0 : distance <= 5 ? 200 : distance <= 10 ? 500 : 1000;
  return { distance, minimum };
}
