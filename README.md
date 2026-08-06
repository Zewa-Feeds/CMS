# Zewa Feeds — CMS

Internal admin panel for the Zewa Feeds e-commerce site. Built to the
**CMS Specification v2.0** (`Zewa_Feeds_CMS_Specification_v2.docx`), with the
visual language ported from the `zewa-feeds-cms.html` reference.

---

## Running it

This app needs **Node 18.18+** (the repo's default `node` is 16, which Next.js rejects).

```bash
cd CMS
nvm use 22            # or any Node >= 18.18
npm install
npm run dev           # http://localhost:3001
```

`npm run build && npm run start` for a production build. Port 3001 keeps it clear
of the storefront on 3000.

### Signing in

Auth is currently **mocked** — there's no backend yet (see *Wiring up the API*).

| Field | Value |
|---|---|
| Email | `aditi@zewafeeds.com` (Admin) · `rahul@zewafeeds.com` (Ops) · `priya@zewafeeds.com` (Editor) |
| Password | `zewa1234` |
| 2FA code | `123456` |

The **role badge in the top bar** switches the active role at runtime so you can
demo the whole RBAC matrix without signing out.

---

## What's built

Every module in the v2.0 spec, at the routes the spec names (§16.2):

| Route | Module | Spec |
|---|---|---|
| `/login` | Email + password → mandatory 2FA | §14 |
| `/` | Dashboard — 3 counters + activity feed | §4 |
| `/profile` | My Profile — identity, 2FA, backup codes, active sessions | §14.3, §14.4 |
| `/products` | Product list, filters, stock quick-update | §5.1, §5.3 |
| `/products/new`, `/products/[slug]/edit` | 5-tab editor, Draft → Preview → Publish | §5.2 |
| `/orders` | Order list, filters, CSV export (Admin) | §6.1 |
| `/orders/[id]` | Detail, guided lifecycle, invoice, refund (Admin) | §6.2–6.5 |
| `/customers`, `/customers/[id]` | List, profile, order history, ban/unban | §7 |
| `/content/articles` (+ `new`, `[slug]/edit`) | Blog list and Tiptap editor | §8.1 |
| `/content/banners` | Spotlight manager — reorder, toggle active | §8.2 |
| `/content/homepage` | Homepage sections + announcement bar | §8.3 |
| `/reviews` | Pending / Approved / Rejected queue, bulk approve | §9 |
| `/coupons` (+ `new`, `[id]/edit`) | Coupon CRUD | §10 |
| `/users` (+ `new`, `[id]/edit`) | CMS user management (Admin only) | §11 |
| `/audit-log` | Append-only log; Ops sees own entries only | §12 |
| `/settings` | Shipping · Tax · Announcement · Maintenance | §13 |

### The order lifecycle

Orders move forward one step at a time. Each step **requires the field that step
produces** before it can be entered, and **sends its own email** on completion —
so an order can't reach Shipped without an invoice, or Delivered without tracking.

```
Pending ──accept──▶ Processing ──ship──▶ Shipped ──deliver──▶ Delivered
                    invoice no.          carrier +            (delivery date,
                    (required)           tracking no.          optional)
                                         (required)
   └──────────────── Cancel (reason required) ────────────────┘
```

| Step | Gate | Email sent |
|---|---|---|
| Accept & invoice | Invoice number | "Your Zewa Feeds order is confirmed" + PDF |
| Mark shipped | Carrier + tracking number (URL optional) | "Your order has shipped" |
| Mark delivered | — (delivery date optional) | "Your order was delivered" |
| Cancel | Reason | "Your order was cancelled" |

The detail page shows a **timeline** of where the order is and a **Customer
Emails** card listing exactly what was sent and when. Only the legal next steps
are offered as buttons, so statuses can't be skipped. Emailing is on by default
with a preview of the subject and recipient, and can be unticked per step.

The lifecycle lives in [`lib/orderFlow.js`](lib/orderFlow.js) — add a step or
change a required field there and the modal, buttons, and timeline all follow.

### Rich text

Content fields use a Tiptap editor ([`components/ui/RichText.jsx`](components/ui/RichText.jsx))
with headings, bold/italic/strikethrough, bullet and numbered lists, quotes,
dividers, links, and clear-formatting. It stores sanitised HTML — there is no
raw-HTML input, so staff can't paste markup that breaks the storefront.

Two modes: full, and `compact` (inline emphasis and lists only) for shorter
fields where headings would be wrong.

| Field | Mode |
|---|---|
| Article body | Full |
| Article excerpt | Compact, 180-char limit |
| Product → Full Description | Full |
| Product → Feeding Guide notes | Full |
| Homepage section subtexts | Compact |
| Settings → Maintenance message | Full |

Deliberately left as plain text: **SEO titles and descriptions** (meta tags must
be plain — markup would corrupt them), **short descriptions** with hard character
limits, **internal notes** on orders, and the **PIN blacklist** (comma-separated data).

### Behaviours worth knowing

- **RBAC is enforced on every module.** Editors are denied Orders, Customers,
  Coupons, Reviews, Users, Audit Log, and Settings; they get Products read-only.
  Nav items hide themselves for roles that can't use them.
- **Nothing goes live on save alone.** Products, articles, and the homepage all
  use Save Draft → Preview → Publish.
- **Destructive actions confirm.** Deleting a product or CMS user requires typing
  the exact name/email. Refunds require a reason.
- **Every mutation writes an audit entry** with actor, role, module, record, and IP.
- **List filters live in the URL**, so `/orders?status=Pending` and the dashboard's
  low-stock counter work as real links — shareable, bookmarkable, and correct on
  client-side navigation.
- **Change Password enforces the §14.2 policy** with a live checklist; submit stays
  disabled until every rule passes and the confirmation matches.
- **Stock quick-update** edits every SKU in a family in one modal, with a live
  family total — it's the most common daily ops action (§5.3).

---

## Stack

Per spec §16.1:

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind, tokens ported 1:1 from spec §17.2 |
| Components | Hand-built primitives in the shadcn/ui idiom (CVA + `tailwind-merge`) |
| Rich text | Tiptap |
| Server state | TanStack Query (provider wired; queries land with the API) |
| Client state | Zustand — `useAuth` (persisted) and `useData` |
| Icons | lucide-react |

Components are written directly rather than pulled via the shadcn CLI so they
match the reference HTML exactly — same primitives (`Button`, `Card`, `Field`,
`Modal`, `Table`, `Pill`, `Tabs`, `Toast`), same `cn()` convention, fully yours to edit.

### Layout

```
app/
  login/page.jsx          public
  (app)/                  everything behind the auth gate
    layout.jsx            → <Shell> (sidebar + topbar)
    page.jsx              dashboard
    products/ orders/ customers/ content/ coupons/ reviews/ users/ audit-log/ settings/
components/
  ui/                     design-system primitives
  shell/                  Sidebar, Topbar, Shell, RoleGate
  products/ content/ coupons/ users/    module components
lib/
  store.js                useAuth + useData (all actions live here)
  seed.js                 mock data
  rbac.js                 roles + permission matrix
  nav.js                  sidebar model
  utils.js                cn, inr, slugify, stockStatus
```

---

## Wiring up the API

The CMS is deliberately isolated from the data source: **every read and write
goes through `lib/store.js`.** To connect the real backend, replace the bodies of
those actions with API calls — no page or component needs to change.

1. **Auth** — `useAuth.login` / `verify2fa` currently compare against seed users.
   Swap for `POST /api/v1/auth/login`, store the JWT, and keep the same
   `{ ok, error }` return shape.
2. **Data** — replace `useData`'s seeded arrays with TanStack Query hooks
   (the `QueryClientProvider` is already in `app/providers.jsx`), and turn each
   action into a mutation.
3. **Route protection** — add `middleware.js` to verify the JWT server-side.
   The current gate is client-side only, which is fine for mock auth but is
   **not sufficient for production**.
4. **Integrations still to wire:** Cloudinary (image upload UI is stubbed),
   pdf-lib/Puppeteer (invoice PDF), Razorpay (refunds), ZeptoMail (both the
   §15 staff alerts and the customer emails at each lifecycle step).

   For the order emails specifically: `useData.sendOrderEmail` currently just
   records the send against the order. Point it at ZeptoMail and the whole
   lifecycle is live — the subjects and triggers are already defined per step
   in `lib/orderFlow.js`.

---

## Known gaps

- Mock auth and mock data — see above. Data resets on reload (except the auth
  session, which persists to `localStorage`).
- Image upload and PDF generation are UI stubs pending Cloudinary/pdf-lib.
- Preview buttons toast instead of opening the storefront; they need the
  storefront's draft-render route.
- Storefront rendering of the rich-text HTML is on the frontend side — the
  storefront needs to render these fields as HTML (not escaped text) for the
  formatting to show up for customers.
- Coupon expiry isn't auto-computed from the end date (spec §10.2); status is
  currently manual.
- On `/profile`, the session list is seeded demo data and "Re-enrol 2FA" /
  "Download backup codes" are stubs — they need the real auth endpoints
  (§14.3, §14.4). Changing your password validates the full policy client-side
  but checks against the mock credential.
