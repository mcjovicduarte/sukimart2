export const FALLBACK_PRODUCT_IMAGE = "/products/fallback.svg";

/**
 * Local artwork that ships with the store. The admin form uses this list as a
 * one-click image picker, so a product can get a picture without hunting for a
 * URL first.
 */
export const PRODUCT_IMAGE_LIBRARY = [
  { label: "555 Hot Sardines", src: "/products/555 Tuna.jpg" },
  { label: "Century Tuna Flakes in Oil", src: "/products/Century Tuna.jpg" },
  { label: "SkyFlakes", src: "/products/Skyflakes.jpg" },
  { label: "Piattos Cheese", src: "/products/Piattos.jpg" },
  { label: "C2 Apple Green Tea", src: "/products/C2.jpg" },
  { label: "Kopiko Black 3-in-1", src: "/products/Kopiko.jpg" },
  { label: "Bear Brand Powdered Milk", src: "/products/Bear Brand.jpg" },
  { label: "Silver Swan Soy Sauce", src: "/products/Silver Swan Soy.jpg" },
  { label: "Datu Puti Vinegar", src: "/products/Datu Puti.jpg" },
  { label: "Tide Bar", src: "/products/Tide Bar.jpg" },
  { label: "Safeguard Soap", src: "/products/Safeguard.jpg" },
  { label: "Eggs (tray)", src: "/products/Egg.jpg" },
  { label: "Pancit Canton Kalamansi", src: "/products/Pancit Canton.jpg" },
] as const;

// Replace known starter artwork while preserving custom image URLs. The two
// requested product photos below show Kalamansi and Hot variants respectively.
const STARTER_PHOTOS: Record<
  string,
  { previous: string; replacement: string }
> = {
  "lucky me pancit canton original": {
    previous: "/products/noodles.jpg",
    replacement: "/products/Pancit Canton.jpg",
  },
  "555 sardines in tomato sauce": {
    previous: "/products/sardines.jpg",
    replacement: "/products/555 Tuna.jpg",
  },
  "century tuna flakes in oil": {
    previous: "/products/tuna.jpg",
    replacement: "/products/Century Tuna.jpg",
  },
  "skyflakes crackers": {
    previous: "/products/crackers.jpg",
    replacement: "/products/Skyflakes.jpg",
  },
  "piattos cheese": {
    previous: "/products/chips.jpg",
    replacement: "/products/Piattos.jpg",
  },
  "c2 green tea apple": {
    previous: "/products/tea.jpg",
    replacement: "/products/C2.jpg",
  },
  "kopiko black 3-in-1": {
    previous: "/products/coffee.jpg",
    replacement: "/products/Kopiko.jpg",
  },
  "bear brand powdered milk 300g": {
    previous: "/products/milk.jpg",
    replacement: "/products/Bear Brand.jpg",
  },
  "silver swan soy sauce 385ml": {
    previous: "/products/soy.jpg",
    replacement: "/products/Silver Swan Soy.jpg",
  },
  "datu puti vinegar 385ml": {
    previous: "/products/vinegar.jpg",
    replacement: "/products/Datu Puti.jpg",
  },
  "tide bar 130g": {
    previous: "/products/detergent.jpg",
    replacement: "/products/Tide Bar.jpg",
  },
  "safeguard soap 60g": {
    previous: "/products/soap.jpg",
    replacement: "/products/Safeguard.jpg",
  },
  "egg (per piece)": {
    previous: "/products/eggs.jpg",
    replacement: "/products/Egg.jpg",
  },
};

const REMOVED_IMAGES = new Set([
  "/products/noodles.jpg", "/products/sardines.jpg", "/products/tuna.jpg",
  "/products/crackers.jpg", "/products/chips.jpg", "/products/tea.jpg",
  "/products/coffee.jpg", "/products/milk.jpg", "/products/soy.jpg",
  "/products/vinegar.jpg", "/products/detergent.jpg", "/products/soap.jpg",
  "/products/eggs.jpg", "/products/bread.jpg",
]);

const RENAMED_IMAGES: Record<string, string> = {
  "/products/download.jpg": "/products/C2.jpg",
  "/products/download (2).jpg": "/products/Kopiko.jpg",
  "/products/download (3).jpg": "/products/Pancit Canton.jpg",
};

const NAME_IMAGES: Array<[RegExp, string]> = [
  [/pancit.*canton.*kalamansi/i, "/products/Pancit Canton.jpg"],
  [/555.*(?:hot|spicy).*sardin/i, "/products/555 Tuna.jpg"],
  [/century.*tuna.*(?:flakes.*oil|oil)/i, "/products/Century Tuna.jpg"],
  [/sky\s*flakes/i, "/products/Skyflakes.jpg"],
  [/piattos.*cheese/i, "/products/Piattos.jpg"],
  [/\bc2\b.*(?:apple|green tea)/i, "/products/C2.jpg"],
  [/kopiko.*black.*3.?in.?1/i, "/products/Kopiko.jpg"],
  [/bear\s*brand.*(?:powder|milk)/i, "/products/Bear Brand.jpg"],
  [/silver\s*swan.*(?:soy|toyo)/i, "/products/Silver Swan Soy.jpg"],
  [/datu\s*puti.*(?:vinegar|suka)/i, "/products/Datu Puti.jpg"],
  [/tide.*bar/i, "/products/Tide Bar.jpg"],
  [/safeguard.*soap/i, "/products/Safeguard.jpg"],
  [/^(?:egg|eggs|itlog)(?:\s|\(|$)/i, "/products/Egg.jpg"],
];

type ProductImageInput = {
  name: string;
  category?: string | null;
  image_url?: string | null;
};

/**
 * Picks the best available picture for a product:
 * Preserve custom URLs, remap old starter files, then use only matching photos.
 * Unmatched products use a placeholder instead of a misleading brand or flavor.
 */
export function resolveProductImage({
  name,
  image_url,
}: ProductImageInput): string {
  const saved = image_url?.trim();
  // Box pricing changes the display name, not the product's image identity.
  const productName = name.trim().replace(/\s*\(per box\)\s*$/i, "").trim();
  const starterPhoto = STARTER_PHOTOS[productName.toLowerCase()];
  if (starterPhoto && (!saved || saved === FALLBACK_PRODUCT_IMAGE || saved === starterPhoto.previous))
    return starterPhoto.replacement;
  if (saved && RENAMED_IMAGES[saved]) return RENAMED_IMAGES[saved];
  if (saved && saved !== FALLBACK_PRODUCT_IMAGE && !REMOVED_IMAGES.has(saved)) return saved;

  for (const [pattern, src] of NAME_IMAGES) {
    if (pattern.test(productName)) return src;
  }

  return FALLBACK_PRODUCT_IMAGE;
}
