# Sukimart

A responsive Filipino sari-sari store shopping experience built with Next.js, React, TypeScript, Tailwind CSS, and Lucide React.

## Run locally

Install dependencies from this directory:

```bash
npm install
```

Then start the development server either from this directory or from the project root:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

- `/` — Sukimart sign-in page
- `/register` — account creation form
- `/forgot-password` — password reset form
- `/shop` — customer storefront, cart, checkout, order status, and notifications
- `/admin` — admin dashboard overview
- `/admin/products` — product and stock management
- `/admin/orders` — order workflow, status updates, and history
- `/admin/completed` — delivered orders
- `/admin/customers` — customer accounts and order history
- `/admin/drivers` — create and manage delivery driver accounts
- `/admin/account` — edit the signed-in administrator's name and contact number
- `/delivery/login` — delivery driver sign-in
- `/admin/reports` — sales, best sellers, and order volume

Authentication uses Supabase Auth for email/password sign-in, account creation, password resets, and Google sign-in. Admins are sent to `/admin`; customers are sent to `/shop`.

## Supabase setup

The local `.env.local` contains the Supabase project URL and publishable key. It is ignored by Git. For a different environment, copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Run these files in the Supabase SQL Editor, in order.

1. [`supabase/setup.sql`](./supabase/setup.sql) — base tables, customer profiles, products, orders, row-level security, and the order placement function. New signups get the `customer` role automatically.
2. [`supabase/admin-dashboard.sql`](./supabase/admin-dashboard.sql) — required for the admin dashboard. Adds delivery/payment fields, the status workflow, categories, status history, customer notifications, admin policies, and the `update_order_status` function. Safe to run more than once.
3. [`supabase/product-images.sql`](./supabase/product-images.sql) — optional; fills product images that are still empty with the bundled Sukimart photos.
4. [`supabase/fix-profiles.sql`](./supabase/fix-profiles.sql) — only if an account shows "Supabase role setup is missing". Backfills missing profile rows and re-creates the signup trigger. Safe to run more than once.
5. [`supabase/delivery.sql`](./supabase/delivery.sql) — required for delivery driver accounts and assignments.
6. [`supabase/driver-contact.sql`](./supabase/driver-contact.sql) — adds the shared profile phone field used for driver contact numbers (safe if `customer-profile.sql` was already run).
7. [`supabase/delivery-profile.sql`](./supabase/delivery-profile.sql) — allows delivery drivers to securely update their own contact number.
8. [`supabase/customer-driver-contact.sql`](./supabase/customer-driver-contact.sql) — allows drivers to edit their profile and customers to see their accepted driver's name and contact number.
9. [`supabase/automatic-driver-assignment.sql`](./supabase/automatic-driver-assignment.sql) — automatically assigns delivery orders to drivers with no active order. Apply this after `delivery.sql` and do not reapply the old demo `auto-assign-delivery.sql`.
10. [`supabase/driver-live-location.sql`](./supabase/driver-live-location.sql) — enables opt-in driver GPS sharing with the customer during an active delivery.
11. [`supabase/delivery-minimum.sql`](./supabase/delivery-minimum.sql) — enforces distance-based minimum order values. Apply after `customer-location.sql` and do not reapply that file afterwards without reapplying this one.
12. [`supabase/store-location.sql`](./supabase/store-location.sql) — lets admins set the active store location and uses it for delivery minimums. Apply last; reapplying earlier checkout migrations can overwrite it.
13. [`supabase/delivery-messages.sql`](./supabase/delivery-messages.sql) — enables private order-specific messages between the customer and assigned delivery driver after acceptance.
14. [`supabase/accepted-driver-location.sql`](./supabase/accepted-driver-location.sql) — allows location sharing from acceptance until delivery completes. Run after `driver-live-location.sql`.
15. [`supabase/delivery-message-notifications.sql`](./supabase/delivery-message-notifications.sql) — adds unread delivery-message notifications. Run after `delivery-messages.sql`.
16. [`supabase/admin-profile.sql`](./supabase/admin-profile.sql) — allows administrators to update their own name and contact number.
17. [`supabase/store-chat-contact.sql`](./supabase/store-chat-contact.sql) — exposes one store contact number to signed-in customers for the store chat call button.

To convert the existing catalog to box pricing, run [`supabase/products-per-box.sql`](./supabase/products-per-box.sql) once. It appends “(per box)” to existing product names and adds ₱120 to each existing price; rerunning it does not add the amount again. Stock quantities are not converted, so review them in Product Management. New products must be entered with their own box name and box price.

### Create delivery driver accounts

Set `SUPABASE_SERVICE_ROLE_KEY` in the server's environment (see `.env.example`) and restart the server. Keep this key secret and never prefix it with `NEXT_PUBLIC_`. After applying the delivery migrations, sign in as an administrator and open **Delivery Drivers** to create or remove driver accounts. Drivers edit their own details. Drivers with assigned orders cannot be removed, preserving order history. Share credentials securely; drivers sign in at `/delivery/login`.

After applying `supabase/customer-driver-contact.sql`, drivers can update their name and contact number under **Account/Profile**. Customers see those details on their order after the driver accepts it.

With automatic assignment, the oldest waiting delivery is assigned to a driver with no unfinished assigned order. If all drivers are busy, orders wait until a driver becomes available or a new driver account is created. Drivers must accept their assigned order before dispatch. Pickup orders are excluded. Availability is based on active orders, not online status; all driver accounts are considered available when idle.

After accepting an order, the driver is prompted to allow browser GPS access; they can stop sharing at any time. The customer sees the store pin until a recent driver location is shared. Sharing requires the driver dashboard to remain open and stops being visible after delivery or after two minutes without an update. Browser location access generally requires HTTPS (or localhost).

Once a driver accepts an order, the customer can open **Track order → Message driver**, and the driver can use **Message customer** on the assigned order. Calls use the other person's saved phone number and open the device's phone app; a call button is shown only when a number is available. The database restricts order messages to that order's customer and assigned driver.

Delivery minimums use straight-line distance from the active store location: up to 3 km has no minimum; over 3–5 km requires ₱200; over 5–10 km requires ₱500; over 10 km requires ₱1,000. Pickup has no minimum. Admins can change the single active branch pin under **Store Location**; it applies to all customers and future checkouts. The initial pin is 8.1720049, 124.2496712. Checkout checks the pin and the database independently checks the final product total. If the tiers change, update both `utils/delivery-minimum.ts` and `supabase/store-location.sql`.

### Create your admin account

**Option A — one command (creates the account and promotes it):**

1. In the Supabase dashboard, open **Project Settings → API keys** and copy the **secret** (service role) key.
2. Add it to `.env.local` (never commit this file):
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=your-secret-key
   ```
3. Run:
   ```bash
   npm run create-admin -- --email you@example.com --name "Your Name"
   ```
   It prompts for a password (or pass `--password`). If the email already exists, it just promotes that account and optionally resets the password.
4. Sign in with that email and password. You will land on `/admin`.

The service role key is used only on the server or by the local script; it is never sent to the browser.

**Option B — SQL Editor:**

1. Open the app and use **Create Account** to register the account you want to use as the administrator. Confirm the email if confirmation is enabled.
2. Open [`supabase/make-admin.sql`](./supabase/make-admin.sql), replace `you@example.com` with that account's email, and paste the file into the Supabase SQL Editor.
3. Run it. The script promotes the account to the `admin` role.
4. Sign out and sign back in. You will land on `/admin`.

Public registration never offers an admin role. Every account is a customer by default; only someone with Supabase project access can promote an administrator.

### How the order workflow works

Orders start as `new`. The admin can move them to `preparing`, then `on_the_way`, then `completed`, or cancel them while they are still new or being prepared. The database rejects invalid jumps, saves every change to `order_status_history`, stamps `updated_at`, and writes a customer notification. Customers see the latest status and unread notification count in `/shop`.

Do not put a Supabase secret/service-role key in `NEXT_PUBLIC_*` variables or browser code. The app uses the publishable key and database row-level security. If a secret key was shared outside trusted settings, rotate it in Supabase before deploying.

In the Supabase dashboard, add your application URL and `/auth/callback` to the authentication redirect URLs. To use Google sign-in, enable Google in the Supabase authentication providers and configure its OAuth credentials.

## Checks

```bash
npm run lint
npm run build
```
