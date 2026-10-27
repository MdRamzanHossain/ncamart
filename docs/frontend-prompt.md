# NCAMart — Frontend-First Build Prompts

**Version:** 1.0  
**Date:** 2026-10-27  
**Built from:** [PRD.md](./PRD.md) v1.4 · [architechture.md](./architechture.md) v1.1 · [api-spec.md](./api-spec.md) v2.0 · [prompt.md](./prompt.md) v1.0 · [openapi.json](./openapi.json)  
**Scope:** Complete Next.js 15 Full-Stack UI — Customer Storefront, Pre-Order Clearance Engine, Public Holographic Seal Verification (`/verify`), Customer Self-Service Portal, Showroom Counter POS, Field-Runner Mobile PWA, and Admin/Operations Backoffice.

---

## How to use this file (ব্যবহারের নিয়ম)

> **বাংলা নির্দেশনা:**  
> এই ফাইলটি NCAMart-এর সম্পূর্ণ ফ্রন্টএন্ড ধাপে ধাপে ডেভেলপ করার মাস্টার প্রম্পট গাইড। প্রতিটি নতুন AI সেশন শুরু করার সময় প্রথমে **F00 (Master Frontend Context)** প্রম্পটটি দিতে হবে, এরপর ক্রমানুসারে **F01, F02 … F38** একটির পর একটি প্রম্পট কার্যকর করতে হবে।  
> একটি প্রম্পটের "Done when" চেকলিস্টের সব শর্ত (`pnpm lint && pnpm typecheck && pnpm test`) পুরোপুরি পাস না হওয়া পর্যন্ত পরবর্তী প্রম্পটে যাওয়া যাবে না। প্রতিটি প্রম্পট সম্পন্ন হওয়ার পর গিটহাবে কমিট ও পুশ করতে হবে এবং `docs/PROGRESS.md` আপডেট করতে হবে।

1. Start every new AI frontend session with **F00**.
2. Run the prompts **in strict sequential order**. Each prompt explicitly declares its `Depends on` dependencies.
3. Every UI element MUST be **interactive, accessible, and animated** with modern micro-interactions (physics-based transitions, hover states, tactile feedback, loading skeletons).
4. Connect every interface directly to the existing 266+ backend REST endpoints (`/api/v1/*`) and Server-Sent Events (SSE).
5. Verify compliance using `pnpm lint && pnpm typecheck && pnpm test` before committing.

---

### Prompt Map

| Stage | Prompts | Focus Area & Deliverables |
| :--- | :--- | :--- |
| **0 — Foundation & Design System** | **F00–F03** | Master Context, Design Tokens, Theme Engine (Dark/Light), UI Primitives, SWR/Query API Client & SSE Layer |
| **1 — Storefront Shell & Navigation**| **F04–F06** | Main Layout, Trust Topbar, Responsive Mega-Menu, `Cmd+K` Instant Search Modal, Mobile Bottom Nav |
| **2 — Home & Discovery Engine** | **F07–F09** | 3D Hero Carousel, Dual-Tier Toggle Switch (Authentic vs. Budget Smart), Flash Deals with Live Countdown, Nawabpur Market Map |
| **3 — Catalog, Compare & PDP** | **F10–F13** | Faceted Filter Listing, Sticky Comparison Matrix, Interactive Product Detail Page (PDP), 3D Holographic Seal Card |
| **4 — Cart, Locking & Checkout** | **F14–F17** | Slide-Over Cart Drawer with 15-Min Redis Lock Timer, Multi-Step Checkout, Dynamic COD Eligibility Meter, Confetti Confirmation |
| **5 — Pre-Order Clearance Engine** | **F18–F19** | Pre-Order Showcase, Milestone Journey Tracker (10–20% Deposit), Balance Payment & Forfeiture Warning Modal |
| **6 — Holographic Seal Verification** | **F20–F21** | Public `/verify` Portal with 3D Holographic Tilt Card, QR Camera Scanner, Chain of Custody & Packaging Video Viewer |
| **7 — Customer Portal & Warranty** | **F22–F24** | Customer Account Shell, Real-Time Delivery Tracker with Interactive Timeline, Drag-and-Drop Unboxing Video RMA Claim Form |
| **8 — Engagement & Reviews** | **F25–F26** | Verified-Buyer Review Submission with Star Rating, Attribute Sliders & Photo Upload, Wishlist & Stock Alert Toggle |
| **9 — Showroom POS & Walk-In** | **F27–F28** | Touch-Screen Quick Billing POS, Hardware Barcode Scanner Listener, Cash Drawer Reconciler, Pickup PIN Modal |
| **10 — Field-Runner Mobile PWA** | **F29–F30** | Offline-First Runner Task Dashboard, Spot-Price Negotiation Input, Stall Camera Receipt Scanner & Float Balance |
| **11 — Admin Operations Backoffice** | **F31–F34** | Admin Shell, Real-Time Revenue Charts, Catalog Media Uploader, Order Kanban, Godown Thermal Seal Print Station |
| **12 — Ledger, Finance & Compliance** | **F35–F36** | Double-Entry T-Account Explorer, Trial Balance Validator, Courier Settlement Matching, Audit & PII Anonymization |
| **13 — Accessibility & Final Polish**| **F37–F38** | WCAG 2.1 AA Accessibility, Keyboard Navigation, Lighthouse Performance (95+), E2E Smoke Flows |

---

## F00 — Master Frontend Context & Design Philosophy (Paste at start of session)

```text
You are a Principal Frontend Engineer and Design Architect building the complete user experience
for NCAMart (ncamart.com) — a high-trust, dual-tier tech accessories platform anchored in Nawabpur,
Dhaka, Bangladesh.

EXISTING BACKEND ARCHITECTURE & DATA INVARIANTS:
- Next.js 15 App Router, React 19, TypeScript, PostgreSQL 16 (Drizzle ORM), Redis, Meilisearch.
- Integer Monetary Representation: Integer Paisa (1 BDT = 100 Paisa). Format as ৳XX,XXX.XX.
- Integer Basis Points: 1% = 100 bp.
- Session Authentication: HttpOnly cookie (nca_sid) and Bearer header support.
- Idempotency: Mutating calls accept Idempotency-Key (UUIDv7).
- Error Handling: RFC 7807 problem details envelope ({ error: { code, message, details } }).

DESIGN PHILOSOPHY & VISUAL IDENTITY:
1. "Radical Transparency & High-Tech Craftsmanship":
   - Color Palette: Deep Obsidian (#0B0F19), Rich Slate (#1E293B), Warm Neutral (#F8FAFC).
   - Dual-Tier Indicators:
     * 100% Authentic: Brushed Champagne Gold (#D97706 / #F59E0B) with subtle iridescent foil shimmer.
     * Budget Smart (Tested OEM): Cyber Neon Teal (#0D9488 / #14B8A6) with emerald energy accents.
2. Motion & Micro-Interactions:
   - Every button, card, input, and badge must feel tactile, alive, and responsive.
   - Spring-physics transitions for drawers, modals, accordions, and dropdowns.
   - Specular 3D hover tilt on holographic seal badges and product hero cards.
   - Optimistic UI updates with instant micro-spinners and reversible toasts.
3. Typography:
   - Headings: Clash Display / Outfit (Tech-industrial, confident, premium).
   - Body & Specs: Inter / JetBrains Mono for technical attributes, serials, and paisa currencies.
4. Mobile-First Responsiveness:
   - Seamless PWA viewport for customers and runners with 48px+ touch targets and bottom sheets.
   - Keyboard accessible (WCAG 2.1 AA) with visible focus rings and skip-to-content anchors.

RULES & BOUNDARIES:
- Vanilla CSS / Modern CSS Modules with strict design tokens (do NOT use Tailwind unless explicitly asked).
- Use Lucide icons or inline SVGs with smooth stroke transitions.
- Strictly adhere to PRD v1.4, architechture.md, and api-spec.md.
```

---

## F01 — Core Design System, CSS Tokens & Theme Engine

**Depends on:** F00 · **Docs:** PRD §1.1, architechture.md §18

```text
Build the foundation of NCAMart's visual design system and theming engine:
1. In `src/styles/tokens.css`, define comprehensive CSS custom properties:
   - Colors: Primary Brand Blue, Obsidian Dark, Slate Surfaces, Authentic Gold (#F59E0B),
     Budget Smart Teal (#14B8A6), Success Emerald, Warning Amber, Destructive Crimson.
   - Neutral Scale: 50 to 950 steps for Light, Dark, and High-Contrast OLED modes.
   - Spacing & Radius: 4px base scale (2xs to 4xl), radius-sm (4px) to radius-full (9999px).
   - Elevation & Shadows: Layered multi-stop box-shadows with subtle color tinting.
   - Glassmorphism Utilities: backdrop-filter blur (8px, 16px, 24px) with border-glow.
   - Motion Timing: --ease-spring, --ease-out-expo, --ease-in-out-smooth, --duration-fast (150ms),
     --duration-normal (250ms), --duration-slow (400ms).
2. In `src/styles/globals.css`:
   - Modern CSS reset, dynamic font rendering (smooth subpixel antialiasing), custom scrollbars.
   - Interactive focus styles: `:focus-visible` with high-contrast dual ring (2px offset).
   - `@media (prefers-reduced-motion)` overrides to instantly disable non-essential animations.
3. Theme Engine (`src/lib/theme/`):
   - Support `light`, `dark`, and `system` modes with seamless persistence in `localStorage`
     and an `nca_theme` cookie to prevent SSR flash of unstyled theme (FOUT).
   - Interactive Theme Toggle component with smooth icon morph animation (Sun -> Moon -> Laptop).

Done when:
- tokens.css and globals.css loaded in RootLayout (`src/app/layout.tsx`).
- Theme switcher switches between Dark, Light, and System modes with zero visual jitter.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F02 — Base UI Component Primitive Library

**Depends on:** F01 · **Docs:** PRD §1.1

```text
Create accessible, animated UI primitives with micro-interactions in `src/components/ui/`:
1. `Button`:
   - Variants: `primary`, `secondary`, `authentic-gold`, `budget-teal`, `outline`, `ghost`, `destructive`.
   - Sizes: `sm`, `md`, `lg`, `icon`.
   - Micro-interaction: Ripple effect on click, subtle 1.02x spring scale on hover, integrated
     loading spinner with text cross-fade.
2. `Input` & `Textarea`:
   - Floating label animation, error state shaking animation, clear button, password visibility toggle.
   - Numeric money input with instant `৳` formatting and paisa conversion helpers.
3. `Badge`:
   - Dual-tier authentic badge with iridescent gold gradient border and subtle breathing pulse.
   - Budget smart badge with cyber teal glow.
4. `Dialog` & `Drawer` (Bottom Sheet on mobile, side-slider on desktop):
   - Spring slide-in, background backdrop blur, escape-key and click-outside dismissal, focus trap.
5. `Tooltip` & `Toast`:
   - Accessible tooltips with spring reveal; Toast notification provider supporting RFC 7807 errors,
     undo buttons, and auto-dismiss progress indicators.
6. `SkeletonLoader`:
   - Shimmer wave animation matching card, table row, text, and avatar shapes.

Done when:
- Story/Demo test page at `/design-system` displays all primitives and states.
- All interactive components support keyboard navigation (Tab, Enter, Space, Escape).
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F03 — API Client, Global State & Real-Time SSE Layer

**Depends on:** F02 · **Docs:** architechture.md §16, api-spec.md §2

```text
Establish the client-side data fetching and real-time connectivity layer:
1. `src/lib/api/client.ts`:
   - Type-safe fetch wrapper with base URL handling, automatic `nca_sid` cookie attachment,
     and Bearer token fallback.
   - Auto-attaches `Idempotency-Key: crypto.randomUUID()` on mutating methods (POST/PUT/PATCH/DELETE).
   - Intercepts RFC 7807 error envelopes and translates them to bilingual toast notifications
     (Bangla/English).
2. Global Authentication & Session Context (`src/context/AuthContext.tsx`):
   - Tracks current customer/staff actor, active permissions, cart count, and notifications.
   - Auto-refreshes session via `/api/v1/auth/me` or `/api/v1/admin/staff/me`.
3. Real-Time Server-Sent Events (SSE) Hook (`src/hooks/useRealtimeEvents.ts`):
   - Connects to `/api/v1/realtime/sse` with automatic reconnection, exponential backoff, and
     heartbeat monitoring.
   - Dispatches real-time events: stock changes, price overrides, runner milestones, delivery updates.

Done when:
- API client handles 200 responses and surfaces structured 4xx/5xx RFC 7807 errors gracefully.
- SSE hook reconnects seamlessly after connection drops.
- Unit tests pass with mock fetch responses.
```

---

## F04 — Storefront Shell, Topbar & Mega-Navigation

**Depends on:** F02, F03 · **Docs:** PRD §3.1, §3.18

```text
Build the global storefront layout and responsive navigation header:
1. Trust Topbar:
   - Displays Nawabpur Complex Physical Showroom address ("Shop 42, Nawabpur Complex, Sundarban Square").
   - Live Trust Metrics ticker: "100% Destructive Holographic Seals Applied" · "Official Distributor Warranty".
   - Language Switcher (বাংলা / English) and Currency Indicator ("BDT ৳").
2. Main Navigation Bar:
   - NCAMart Logo with animated holographic hover effect.
   - Mega-Menu dropdown with categorized tech items:
     * Engineering & Soldering Tools, High-Power Chargers & GaN Adapters, Smart Wearables,
       Industrial Utility Cables, CCTV & Surveillance.
   - Visual category badges showing Authentic count vs. Budget Smart OEM options.
   - Quick Action Icons: Search (`Cmd+K`), Wishlist with counter badge, Cart with animated item count,
     User Account avatar/dropdown.
3. Micro-Announcements Bar:
   - Real-time marquee banner for daily cut-off SLA ("Orders placed before 2:00 PM ship today inside Dhaka").

Done when:
- Mega-menu opens with smooth spring reveal and full keyboard arrow-key navigation.
- Sticky header compresses gracefully on scroll with frosted glass backdrop blur.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F05 — Global `Cmd+K` Instant Search & Discovery Modal

**Depends on:** F04 · **Docs:** PRD §3.16, architechture.md §8

```text
Implement an instantaneous spotlight search modal powered by Meilisearch:
1. Keyboard Shortcut Listener:
   - Triggered by `Cmd+K` (Mac), `Ctrl+K` (Windows), or clicking the search bar in the header.
2. Search Experience (`src/components/search/SearchModal.tsx`):
   - Debounced query input (150ms) querying `/api/v1/products?q=...`.
   - Dual-tier visual separation: Search results clearly group items by "100% Authentic" (Gold badge)
     and "Budget Smart Tested OEM" (Teal badge).
   - Matched keyword highlighting in titles, brand names, and SKU specifications.
   - Price display in BDT ৳ with strikethrough MRP discount indicators.
   - Stock status tag ("In Stock Dhaka", "Pre-Order Available", "Low Stock: 2 units").
3. Recent Searches & Trending SKUs:
   - Persists past searches in `localStorage` with quick-delete buttons.
   - Displays trending tech accessories in Nawabpur (e.g. "65W GaN Charger", "T12 Soldering Iron").
4. Keyboard Navigation:
   - Up/Down arrow keys highlight items; `Enter` navigates to PDP; `Escape` closes the modal.

Done when:
- Search modal opens within < 50ms with zero layout shift.
- Keyboard navigation (arrows + enter) selects products seamlessly.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F06 — Mobile App Shell & Bottom Navigation Bar

**Depends on:** F04 · **Docs:** PRD §3.18, architechture.md §2

```text
Build a native-app-like mobile browsing experience for PWA and mobile web users:
1. Mobile Header:
   - Compact logo, quick search button, and hamburger menu triggering a slide-over navigation drawer.
2. Bottom Navigation Bar (`src/components/layout/MobileBottomNav.tsx`):
   - Fixed bottom dock with haptic/ripple feedback:
     * Home, Categories, Verify (`/verify` with glowing holographic seal icon), Wishlist, Cart.
   - Active state indicator with spring-animated sliding pill.
   - Floating badge over Cart icon showing live item count.
3. Pull-to-Refresh:
   - Smooth rubber-band pull animation triggering route refresh on product feeds and catalog pages.
4. Mobile Slide-Over Navigation Drawer:
   - Category tree, dual-tier selector, customer account shortcuts, and WhatsApp support direct link.

Done when:
- Bottom bar stays fixed above mobile browser address bars (using `env(safe-area-inset-bottom)`).
- Touch interactions respond with < 100ms latency.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F07 — Interactive Homepage & Dynamic Hero Portal Experience

**Depends on:** F04, F05 · **Docs:** PRD §1.1, §3.1 · **Design Reference:** `docs/One Store, Endless Possibilities.jpg`

```text
Create the flagship NCAMart storefront homepage (`src/app/page.tsx`), faithfully implementing
the visual architecture and section hierarchy demonstrated in `docs/One Store, Endless Possibilities.jpg`:

1. Futuristic Hero Portal & Cyber-Physical Shopping Stage:
   - Visual Centerpiece: Interactive glowing 3D hologram portal ring with floating category preview
     cards (Engineering Tools, GaN Chargers, Soldering Stations, Audio DACs) reacting with 3D parallax
     to mouse cursor movement.
   - Compelling Typography:
     * Display Headline: "Your World Of Tech Shopping Starts Here."
     * Subtitle: "Explore 100% authentic gear, tested OEM alternatives, and shop smarter with
       tamper-evident holographic seals directly from Nawabpur Complex."
   - Primary Call-to-Action: Coral/Sunset Orange pill button ("Shop Now ->") with magnetic hover
     attraction and smooth click ripple.
   - 4-Pillar Trust Micro-Bar (below hero headline):
     * 🛡️ "100% Sealed" (Destructive Holographic Seals on all genuine stock)
     * ⚡ "24h Drop-and-Pack" (Same-day dispatch across Dhaka)
     * 🔄 "Doorstep RMA Swap" (Hassle-free replacement guarantee)
     * 🎧 "24/7 Nawabpur Support" (Direct WhatsApp & Phone hotline)

2. Circular Category Dock (Horizontal Pill Container):
   - Rounded container with circular glassmorphic icons and subtle hover bounce:
     [ Tools & Meters ] [ GaN & Power ] [ Cables & Bus ] [ Audio & DACs ] [ CCTV & Security ] [ Wearables ] [ More... ]
   - Hovering triggers a 1.08x spring scale, glowing ring, and category quick-preview tooltip.

3. Interactive Collections (4-Card Grid with Floating 3D Previews):
   - 4 gradient/pastel accent cards with floating hardware elements and circular arrow buttons (>):
     * Card 1 (Violet/Lavender): "Tech Essentials — Upgrade Your World"
     * Card 2 (Blush/Rose): "Bench & Soldering — 100% Distributor Authentic"
     * Card 3 (Warm Peach): "Nawabpur Sourced — Drop-and-Pack Stalls"
     * Card 4 (Periwinkle/Denim): "Pre-Order Direct — Niche Import Engineering Tools"
   - Clicking arrow button expands card with smooth layout morphing.

4. Dual-Tier Recommended For You Carousel:
   - Horizontal slider with interactive navigation arrows (< and >).
   - Product cards featuring:
     * Floating heart wishlist icon with spring pop animation.
     * High-res hardware thumbnail on clean soft gradient.
     * Dual-tier badge: Brushed Champagne Gold for Authentic vs. Cyber Teal for Budget Smart.
     * Title, BDT ৳ price with paisa formatting, rating stars (★ 4.8).

Done when:
- Homepage matches the layout composition in `docs/One Store, Endless Possibilities.jpg`.
- Hero portal ring and floating cards respond smoothly to mouse movements.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F08 — Triple-Grid Power Section: Trending, Campaign Banner & Flash Offers

**Depends on:** F07 · **Docs:** PRD §1.1, §3.1, §3.17 · **Design Reference:** `docs/One Store, Endless Possibilities.jpg`

```text
Build the high-energy triple-grid middle section from `docs/One Store, Endless Possibilities.jpg`:

1. Column 1: "Trending Now" Ranked Leaderboard:
   - Header with "See All" action link.
   - Ranked items list (#1, #2, #3):
     * Left number badge (1 in blue, 2 in slate, 3 in neutral).
     * Compact product image, title (e.g. "Mechanic T12 Solder Station", "Anker 737 GaN 140W"), rating stars.
     * Subtle hover background highlight with spring translate-x (+4px).

2. Column 2: "Featured Campaign Banner" (Center Highlight):
   - Wide dynamic hero banner (e.g. "Nawabpur Tech Clearance — Up to 50% Off Authentic Accessories").
   - Vibrant contrasting gradient backdrop with futuristic model/hardware visual.
   - Promotional pill button ("Shop The Sale ->") opening filtered campaign catalog.

3. Column 3: "Flash Offers" with Live 3-Box Countdown Clock:
   - High-contrast countdown timer with 3 dedicated digit boxes:
     [ 02 HRS ] : [ 45 MINS ] : [ 18 SECS ] updating every 1000ms.
   - Featured flash deal item with image thumbnail, title, strikethrough MRP, discounted BDT ৳ price,
     and bold discount badge ("33% OFF").
   - Interactive dots pagination for browsing multiple daily flash deals.

4. Rewards & Trust Strip (Full-width Dark Indigo / Violet Banner):
   - 4-column benefit highlights with custom micro-icons:
     * Col 1: "NCAMart Rewards — Earn points on every genuine order & unlock exclusive perks."
     * Col 2: "Distributor Verified — Handpicked genuine distributor stock with official warranty."
     * Col 3: "Holographic Seals — Destructive tamper-evident seals verified on /verify."
     * Col 4: "Refer & Earn — Invite fellow engineers and earn store credit wallet cash."

5. Customer Testimonials & Newsletter Footer:
   - "What Shoppers Say": 3 verified customer review cards with star ratings (★★★★★), review quote,
     and verified buyer badge.
   - "Stay in the Loop": Email input box with coral-pink "Subscribe" button and social links.
   - 4-Column Footer: Shop, Customer Care, About NCAMart, Get the App (PWA & Mobile).

Done when:
- Flash deal countdown timer ticks reliably without causing unwanted re-renders of parent components.
- Triple-grid layout responds smoothly: stacks vertically on mobile, expands to 3 columns on desktop.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F09 — Nawabpur Complex Interactive Market Map & Brand Hub

**Depends on:** F07 · **Docs:** PRD §1.1, §3.11

```text
Build the Nawabpur Local Origin & Brand Authenticity discovery section:
1. Interactive Market Map Section:
   - Stylized dark-mode interactive map visualizing Nawabpur Complex, Sundarban Square, and Stadium Market.
   - Animated pulse beacons showing NCAMart Central Godown, Quality Control Center, and Showroom.
   - Explains the "Drop-and-Pack" physical sourcing model: "How our field runners verify and pack wholesale tech in 24 hours."
2. Official Brand Authenticity Showcase:
   - Interactive carousel of authorized distributor brands (e.g., Anker, Baseus, Ugreen, Fluke, Mechanic, Sunshine).
   - Clicking a brand filters products and displays distributor certificate credentials.

Done when:
- Map elements interact on hover with tooltip cards explaining godown and runner hub locations.
- Brand carousel scrolls smoothly with infinite loop animation.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F10 — Catalog Listing Page & Dynamic Faceted Filters

**Depends on:** F08 · **Docs:** PRD §3.1, §3.15, §3.16

```text
Build the master catalog browsing page (`src/app/products/page.tsx`):
1. Faceted Filter Sidebar (Desktop sticky sidebar, mobile slide-over bottom sheet):
   - Tier Selector: [x] 100% Authentic [x] Budget Smart (Tested OEM).
   - Price Range Slider: Dual-handle slider with instant BDT ৳ min/max input bindings.
   - Category Hierarchy: Multi-level accordion with active category counts.
   - Brand Checkboxes with live search input inside filter list.
   - Technical Spec Filters: Dynamic filters based on category (e.g., Wattage: 30W/65W/100W; Ports: Type-C/USB-A).
   - In-Stock Toggle: "Ready for 24h Dhaka Dispatch".
2. Catalog Header & Sorting:
   - Active filter pills with 1-click removal and "Clear All Filters" button.
   - Result count ("Showing 48 of 238 items").
   - Sort dropdown: "Popularity", "Price: Low to High", "Price: High to Low", "Newest Arrivals", "Fastest Delivery".
3. Product Grid & Infinite Scroll / Pagination:
   - Smooth layout grid (2 columns mobile, 3–4 columns desktop).
   - Skeleton loading cards while fetching new page chunks from `/api/v1/products`.

Done when:
- Changing any filter updates URL search params (`?tier=authentic&brand=anker&minPrice=1000`) without full page reloads.
- Back and forward browser navigation restores exact filter states.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F11 — Side-by-Side Spec Comparison Matrix

**Depends on:** F10 · **Docs:** PRD §1.1, §3.1.2

```text
Build the interactive Side-by-Side Comparison Matrix tool (`/compare`):
1. Sticky Floating Comparison Tray:
   - Appears at the bottom of the screen whenever 2 to 4 items are checked for comparison.
   - Shows item thumbnails with remove button and "Compare Now (X)" button.
2. Full Comparison Page (`src/app/compare/page.tsx`):
   - Sticky top product headers (Image, Name, Price, Tier badge, "Add to Cart" CTA) that stay pinned on scroll.
   - "Highlight Differences" Toggle: Dim identical specs, vividly highlight contrasting metrics
     (e.g., Authentic 65W GaN vs Budget Smart 65W Silicon, Warranty 18 Months vs 6 Months).
   - Detailed Comparison Rows grouped by:
     * Performance & Output, Build Quality & Housing, Safety Protections, Warranty & Seal Type, Price per Watt / Value Ratio.
3. Mobile Viewport:
   - Horizontal swipe-lock columns with synchronized vertical scrolling.

Done when:
- Tray toggles smoothly on/off when checking items across the catalog.
- "Highlight Differences" instantly styles divergent spec cells.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F12 — Product Detail Page (PDP) & Interactive Media Gallery

**Depends on:** F08, F10 · **Docs:** PRD §3.1, §3.4, §3.15

```text
Build the comprehensive Product Detail Page (`src/app/products/[slug]/page.tsx`):
1. Interactive Media Gallery:
   - Multi-image zoom with mouse-position magnifying lens on desktop and pinch-to-zoom on mobile.
   - Thumbnail carousel with video preview indicator (unboxing and QC demonstration clips).
2. Product Identity & SKU Variant Selector:
   - Dynamic Breadcrumbs: Home > Category > Brand > Product.
   - Title, Rating stars with jump-to-reviews link, SKU code.
   - Dual-tier prominent badge with expandable "Why this tier?" trust explainer modal.
   - Variant Selectors (Color, Storage/Ports, Voltage) updating URL and price dynamically.
3. Pricing & Stock Availability:
   - BDT ৳ Price display, VAT-inclusive note ("Prices include applicable VAT/Mushak").
   - Stock Indicator:
     * "In Stock — Packed & Shipped from Nawabpur in 24h" (Green).
     * "Low Stock: Only X left" (Orange pulsating dot).
     * "Pre-Order: Direct Import with 15% Deposit" (Blue).
4. Interactive Courier SLA & Delivery Estimator:
   - Customer selects Division and District; instant calculated delivery time and fee displayed
     (e.g., "Dhaka: ৳60 — Delivered within 24 Hours").

Done when:
- Switching SKU variants smoothly updates gallery, price, and stock status.
- Breadcrumbs and OpenGraph meta tags render complete SEO metadata.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F13 — 3D Interactive Holographic Seal Card & Warranty Explainer

**Depends on:** F12 · **Docs:** PRD §1.1, §3.2, §3.10

```text
Build the signature Holographic Seal interactive card embedded on every Product Detail Page:
1. 3D Holographic Card Component (`src/components/trust/HolographicSealPreview.tsx`):
   - Interactive 3D tilt card responding to mouse movement (desktop) and device gyroscope (mobile).
   - Dynamic iridescent foil gradient overlay with specular glare moving in opposite direction of tilt.
   - Displays Crockford Base32 Seal preview ID (e.g., `NC-9X4K-2M7B`).
   - Destructive VOID pattern simulation preview when toggled ("Tamper-evident holographic foil tears on removal").
2. Warranty & Chain of Custody Explainer:
   - Step-by-step trust visual:
     1. Staged at Nawabpur Godown -> 2. In-House QC Tested -> 3. Holographic Seal Applied -> 4. Tracked via `/verify`.
   - Clear distinction between "Official Distributor Warranty" vs. "NCAMart Replacement Guarantee".
3. Direct Verification CTA:
   - Button: "Have a sealed product? Verify Seal ID now ->" linking to `/verify`.

Done when:
- Seal card tilts smoothly with 60fps hardware-accelerated CSS transforms.
- Fallback flat styling renders cleanly if WebGL/3D transforms are unsupported.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F14 — Slide-Over Cart Drawer with 15-Minute Reservation Timer

**Depends on:** F02, F12 · **Docs:** PRD §3.5, §3.11, architechture.md §4

```text
Build the high-conversion slide-over Cart Drawer (`src/components/cart/CartDrawer.tsx`):
1. Slide-Over Drawer Shell:
   - Opens smoothly from right side upon clicking cart icon or adding a product.
   - Displays item count, free-shipping progress rail ("Add ৳450 more for Free Dhaka Delivery").
2. 15-Minute Stock Reservation Countdown:
   - When items with tight inventory are added, display an animated countdown bar:
     "Stock reserved for 14:52 minutes. Complete checkout to secure your items."
   - Visual warning when timer reaches < 2 minutes (amber pulse).
3. Cart Item Row:
   - Product thumbnail, tier badge, SKU title, variant details.
   - Stepper quantity button (+ / -) with instant optimistic update and debounce.
   - Remove item button with undo toast notification.
4. Summary & Subtotal:
   - Subtotal in BDT ৳, estimated delivery fee, and prominent checkout CTA:
     "Proceed to Checkout ->" with lock icon.

Done when:
- Quantity changes update subtotal instantly with zero UI lag.
- Expired reservation cleanly triggers item refresh alert.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F15 — Multi-Step Checkout & Geographical Address Cascade

**Depends on:** F14 · **Docs:** PRD §3.6, §3.11, api-spec.md §3

```text
Build the distraction-free Multi-Step Checkout flow (`src/app/checkout/page.tsx`):
1. Step 1: Customer Identity & Phone OTP:
   - Clean mobile number input (+880 prefix).
   - If guest, sends 6-digit OTP via `/api/v1/auth/otp/send` with auto-focus digit inputs
     and 60-second resend cooldown timer.
   - Existing customer session automatically skips to Step 2.
2. Step 2: Shipping Address with Bangladesh Geo Cascade:
   - Division dropdown -> populates Districts -> populates Thanas dynamically from `/api/v1/geo/*`.
   - Street address, landmark notes, and alternate contact number.
   - "Deliver to Nawabpur Showroom for Free PIN Pickup" option toggle.
3. Step 3: Order Review:
   - Itemized list, price breakdown (Subtotal, VAT, Courier Fee, Store Credit discount, Coupon discount).
   - Interactive Coupon Code input with real-time validation feedback.

Done when:
- Address cascade dropdowns load instantly from seed data/API with zero blank states.
- Phone OTP inputs support paste and keyboard backspace flow.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F16 — Payment Selection & Dynamic COD Eligibility Meter

**Depends on:** F15 · **Docs:** PRD §3.6, §3.12, §3.14

```text
Implement payment gateway selection and COD eligibility rules on Checkout:
1. Payment Options Accordion:
   - Option A: Online Payment via SSLCommerz (bKash, Nagad, Rocket, Visa, Mastercard, AMEX).
   - Option B: Cash on Delivery (COD).
   - Option C: Store Credit Balance (if customer has active wallet credit, allows partial or full pay).
2. Dynamic Cash on Delivery (COD) Eligibility Meter:
   - Evaluates customer RTO history and order contents:
     * If first-time buyer: Display friendly advance delivery fee notice:
       "To confirm your COD order, a small advance delivery fee of ৳120 is required. Remaining balance payable at doorstep."
     * If customer has ≥ 2 RTOs in rolling 12 months: COD option is hidden/locked with polite explanation:
       "Cash on Delivery is unavailable for this account. Please choose bKash or Online Payment."
3. Place Order Submission:
   - Mutating request sent with `Idempotency-Key` UUIDv7.
   - Redirects to SSLCommerz gateway URL on online payment or directly to confirmation on COD.

Done when:
- COD option dynamically enables/disables based on customer profile rules.
- Double-clicking "Place Order" is completely prevented by client-side idempotency lock.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F17 — Order Confirmation & Interactive Celebration Screen

**Depends on:** F16 · **Docs:** PRD §3.6, §3.12

```text
Build the Order Success confirmation page (`src/app/checkout/success/[orderNumber]/page.tsx`):
1. Celebration Animation:
   - Particle confetti burst upon initial load.
   - Large checkmark with spring-bounce animation.
2. Order Summary Card:
   - Order Number (e.g. `NCA-2026-84920`), timestamp, selected payment method.
   - Payment status badge ("PAID" in green, "COD PENDING" in amber).
   - Download Official Mushak 6.3 Tax Invoice PDF button.
3. Next Steps & Tracking Pathway:
   - Visual timeline: Order Placed -> Godown QC Inspection & Seal Application -> Courier Handover.
   - "Track Order in Real-Time" CTA button linking to order tracker.
   - SMS confirmation alert banner: "Confirmation SMS sent to +88017XXXXXXXX."

Done when:
- Page loads order details directly from `/api/v1/orders/[orderNumber]`.
- Direct invoice download triggers PDF stream properly.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F18 — Pre-Order Showcase & Clearance Milestone Tracker

**Depends on:** F08, F12 · **Docs:** PRD §3.4, §3.12

```text
Build the dedicated Pre-Order Clearance showcase and PDP experience:
1. Pre-Order Hub Page (`src/app/pre-orders/page.tsx`):
   - Hero banner: "Direct Import of Specialized Engineering Gear & High-End Tech Tools."
   - Showcase cards with progressive deposit badges (10% or 20% advance required).
   - Target Quota Progress Bar: "8 of 10 units reserved to trigger batch air-freight import."
2. Pre-Order PDP Variant:
   - Clear progressive deposit calculator:
     * "Total Item Price: ৳14,500"
     * "Advance Deposit to Reserve (15%): ৳2,175"
     * "Remaining Balance Payable on Arrival: ৳12,325"
   - Estimated Customs Clearance & Arrival Date range (e.g., "Nov 12 – Nov 18, 2026").
   - Explicit Policy Banner: "100% Refund if import delayed beyond SLA. Deposit forfeiture terms apply if balance unpaid."

Done when:
- Deposit calculation updates automatically based on SKU tiered deposit percentage.
- Milestone clearance bar animates smoothly from 0% to current percentage.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F19 — Customer Pre-Order Balance Settlement & Forfeiture Warning

**Depends on:** F18, F16 · **Docs:** PRD §3.4, §3.10, §3.12

```text
Build the customer balance payment interface when pre-ordered items arrive at Nawabpur Godown:
1. Balance Due Alert Card (`/account/pre-orders/[orderNumber]`):
   - Status: "Arrived at Nawabpur Godown — QC Passed & Sealed".
   - Breakdown: Total Price, Advance Deposit Already Paid, Remaining Balance Due.
2. Countdown to Forfeiture Warning Banner:
   - Visual countdown timer (7-day window from godown arrival):
     "Please settle the remaining balance within 4 days 12 hours to avoid reservation forfeiture."
   - Explains policy: "Unclaimed units after 7 days are released to general catalog; deposit credited to store credit minus 10% restocking fee."
3. Pay Balance CTA:
   - Opens checkout modal to settle remaining balance via SSLCommerz (bKash/Cards) or select COD
     (if balance ≤ ৳5,000 cap per PRD §3.4.2).

Done when:
- Countdown timer accurately reflects the 7-day forfeiture window.
- Balance payment triggers receipt generation and transitions order state to `PACKED`.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F20 — Public `/verify` Holographic Seal Verification Portal

**Depends on:** F02, F13 · **Docs:** PRD §3.2, §3.18, architechture.md §7

```text
Build the public-facing Seal Verification Portal (`src/app/verify/page.tsx`):
1. Mobile-First Verification Viewport:
   - Clean, high-trust hero: "NCAMart Holographic Seal & Serial Verification Engine".
   - Prominent Search Box with Crockford Base32 Input Mask:
     * Auto-formats input as `NC-XXXX-XXXX` with auto-uppercase and invalid character rejection
       (excludes I, L, O, U to eliminate customer confusion).
2. Integrated Camera QR Code Scanner (`src/components/verify/QrScannerModal.tsx`):
   - One-tap button: "Scan QR Code on Holographic Seal".
   - Uses device camera stream with animated laser scanning overlay.
   - Automatically parses `https://ncamart.com/verify?seal=NC-9X4K-2M7B` and executes instant lookup.
3. Interactive 3D Seal Demonstration:
   - Shows where to find the 8-character Crockford Seal ID on the physical destructive parcel seal.

Done when:
- Input mask prevents typing invalid characters (e.g., typing 'i' or 'o' converts or rejects cleanly).
- Camera QR scanner starts with user permission and shuts down stream upon modal close.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F21 — Seal Verification Result & Anti-Counterfeit Safeguard

**Depends on:** F20 · **Docs:** PRD §3.2, §3.18, api-spec.md §5

```text
Build the Verification Result presentation page (`src/app/verify/[sealId]/page.tsx`):
1. Genuine Verification State (`status === "VERIFIED"`):
   - Glowing Green Holographic Seal Stamp with animated checkmark.
   - Product Details: Product Name, Authentic Distributor Tier, Serial Number, Batch Code.
   - Packaging Proof: Embedded 10-second unboxing/packing video snippet recorded at Nawabpur Godown.
   - Date & Time Seal Applied by QC Inspector.
   - Official Distributor Warranty Coverage Period (with live countdown of remaining warranty days).
2. Voided / Damaged Seal State (`status === "VOID"`):
   - Red Warning Stamp: "SEAL RECORDED AS VOIDED / TAMPERED".
   - Displays reason (e.g., "Damaged in transit", "Failed initial inspection").
3. Anti-Clone Safeguard (PRD §3.2.3):
   - If excessive lookups occur across different IPs, the public result continues to show genuine product specs
     WITHOUT displaying an alarming public warning, while internal security logs trigger a clone investigation.

Done when:
- Result page renders genuine, void, and not-found states with distinct visual treatments.
- Video snippet player loads smoothly on both mobile and desktop.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F22 — Customer Account Portal & Store Credit Wallet

**Depends on:** F03, F14 · **Docs:** PRD §3.9, §3.14

```text
Build the Customer Self-Service Account Portal (`src/app/account/`):
1. Account Shell & Navigation:
   - Sidebar/Bottom nav: Orders, Pre-Orders, Warranties & Claims, Store Credit Wallet, Addresses, Profile.
2. Customer Profile & Security:
   - Name, verified phone number (+880), email address.
   - Active device sessions list with "Sign Out Other Devices" action.
3. Store Credit Wallet (`src/app/account/wallet/page.tsx`):
   - Large credit balance card in BDT ৳.
   - Ledger Transaction History: Date, Reference (Refund for RMA #X, Pre-order Adjustment), Amount (+/-), Balance.
   - Withdraw Store Credit Request Form (Bank account / bKash transfer per PRD §3.14).
4. Address Book:
   - Saved delivery addresses with "Default" badge and modal for adding/editing with Bangladesh geo cascade.

Done when:
- Wallet displays live store credit balance fetched from `/api/v1/customer/store-credit`.
- Address book CRUD operations perform with optimistic UI updates.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F23 — Real-Time Order History & Live Delivery Tracker

**Depends on:** F22, F03 · **Docs:** PRD §3.11, §3.12, architechture.md §16

```text
Build the Customer Order History and Live Courier Tracker (`src/app/account/orders/[orderNumber]/page.tsx`):
1. Order Listing:
   - Status filters: [ All ] [ Processing ] [ Dispatched ] [ Delivered ] [ Cancelled ].
   - Summary cards with order thumbnail, date, total paisa, and action buttons ("Track", "View Invoice").
2. Real-Time Delivery Tracker:
   - Interactive Progress Rail:
     1. Order Confirmed -> 2. Sourced by Runner -> 3. QC Tested & Sealed -> 4. Handed to Courier -> 5. Out for Delivery -> 6. Delivered.
   - Current stage pulses with animated glow.
   - Courier Details Card: Courier Partner (Pathao / Steadfast / RedX), Consignment Tracking Number,
     Courier Contact Hotline.
3. Live SSE Connection:
   - Uses `useRealtimeEvents` to listen for delivery status transitions without requiring page reloads.
4. One-Click Showroom Pickup PIN Modal (if order selected Showroom Pickup):
   - Displays 6-digit Pickup PIN and QR code for scanning at Nawabpur Showroom Counter.

Done when:
- Progress bar accurately reflects order state machine status.
- Showroom pickup PIN displays securely with expiration timer.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F24 — Warranty Portal & Drag-and-Drop Video RMA Claim Form

**Depends on:** F22 · **Docs:** PRD §3.10, §3.18, architechture.md §13

```text
Build the Customer Warranty & RMA Claim submission interface (`src/app/account/warranty/`):
1. Active Warranties List:
   - Displays delivered products with remaining warranty days (calculated from delivery date per PRD §3.10).
   - Warranty type badge: "Official Distributor 18-Month" vs "NCAMart 6-Month Replacement".
   - "Claim Warranty / Report Defect" button.
2. RMA Claim Submission Wizard (`src/components/rma/RmaClaimWizard.tsx`):
   - Step 1: Defect Description & Checklist (Dead on Arrival, Overheating, Port Loose, No Power).
   - Step 2: Proof Upload with Drag-and-Drop:
     * Photo of physical product showing the Holographic Seal intact.
     * Short Unboxing / Fault Demonstration Video (Max 50MB, formats: MP4, MOV, WebM).
     * Direct upload via presigned S3/R2 URL with progress percentage bar.
   - Step 3: Preferred Resolution: [ Replacement Unit ] [ Store Credit Refund ].
3. SLA Assurance Banner:
   - "NCAMart RMA Guarantee: Claims reviewed within 1 business hour. Dhaka doorstep swap within 72 hours."

Done when:
- Video upload displays progress bar and generates video preview thumbnail before submission.
- Form blocks submission if video or seal photo is missing.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F25 — Verified-Buyer Reviews & Rating Submission Modal

**Depends on:** F22 · **Docs:** PRD §3.16, api-spec.md §12

```text
Build the Verified-Buyer Review submission and display engine:
1. Review Submission Modal (`src/components/reviews/ReviewModal.tsx`):
   - Restricted strictly to customers with a `DELIVERED` order containing the specific SKU.
   - 5-Star interactive hover rating with descriptive labels (1 = Poor, 5 = Flawless Authentic).
   - Technical Attribute Sliders:
     * Build Quality (1–5), Accuracy of Advertised Specs (1–5), Value for Money (1–5).
   - Customer Photo Upload with image compression and preview.
   - Text review with minimum 15 characters and helpful placeholder prompts.
2. Product Page Review Breakdown:
   - Average score, total reviews count, star breakdown histogram bars.
   - Verified Buyer badge on each customer review.
   - Helpful / Upvote button with optimistic counter increments.

Done when:
- Unverified users cannot open review submission modal.
- Submitting review updates PDP rating histogram instantly.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F26 — Customer Wishlist & Price-Drop Notification Alert

**Depends on:** F08, F22 · **Docs:** PRD §3.16, §3.17

```text
Build the Customer Wishlist and Automated Stock/Price Alert interface (`src/app/account/wishlist/`):
1. Wishlist Grid:
   - Responsive grid of saved tech accessories with current stock status.
   - "Move All to Cart" one-click action.
2. Price-Drop & Stock Alert Toggles:
   - Switch: "Notify me via SMS/WhatsApp when this item drops in price."
   - Switch: "Notify me when Pre-Order batch opens."
3. Interactive Heart Button:
   - Embedded on every product card with spring heart-pop animation and instant toast feedback.

Done when:
- Toggling heart icon updates wishlist count in navbar instantly.
- Moving items from wishlist to cart removes them smoothly from wishlist view.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F27 — Showroom Counter POS Touch-Screen Billing Console

**Depends on:** F02, F03 · **Docs:** PRD §3.10, §3.11, §3.18

```text
Build the high-speed touch-screen POS interface for the Nawabpur Showroom Counter (`src/app/pos/`):
1. Layout Architecture:
   - High-contrast, touch-optimized split layout (Left: Product quick-grid & barcode input; Right: Cart & Tender).
   - Restricted to staff with `SHOWROOM_AGENT` or `SUPER_ADMIN` roles.
2. Hardware Barcode Scanner Listener:
   - Global keystroke listener capturing barcode scanner input (rapid keystrokes terminating in Enter).
   - Automatically adds scanned SKU to active POS cart in < 50ms with audio confirmation beep.
3. Fast Customer Search / Walk-in Mode:
   - Quick input for customer phone number to attach loyalty points, or one-click "Walk-in Guest".
4. Cash & Digital Tender Panel:
   - Payment method tabs: [ Cash ] [ bKash POS QR ] [ Card POS Terminal ] [ Store Credit ].
   - Cash Tendered Calculator: Quick cash buttons (৳500, ৳1,000, ৳2,000) with instant Change Due display.

Done when:
- Barcode scanner simulation adds SKU without stealing focus from active fields.
- Change Due calculation computes accurately in real time.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F28 — Showroom Pickup PIN Verification & Thermal Receipt Preview

**Depends on:** F27 · **Docs:** PRD §3.10, §3.13

```text
Build the Showroom Customer Pickup fulfillment and Thermal Receipt generator:
1. Pickup PIN Verification Dialog (`src/components/pos/PickupPinModal.tsx`):
   - Showroom agent enters 6-digit customer PIN or scans QR code from customer mobile screen.
   - Validates via `/api/v1/pos/pickup/verify`.
   - Displays parcel details, seal ID verification stamp, and customer name.
   - "Mark as Handed Over" button with digital signature capture pad.
2. Thermal POS Receipt Preview (`src/components/pos/ThermalReceiptPreview.tsx`):
   - Pixel-perfect 80mm thermal receipt layout with monospace typography:
     * NCAMart Nawabpur Showroom Header, VAT Registration / Mushak 6.3 Number.
     * Itemized table with integer paisa formatting, Total BDT, Tender Details, Cashier Name.
     * QR code linking to `/verify?seal=...` for tamper-evident seal verification.
   - Native browser thermal printer trigger (`window.print()`) with clean CSS `@media print` styles.

Done when:
- Thermal receipt preview matches 80mm paper width without clipping or page overflowing.
- Successful PIN verification updates order status to `DELIVERED` immediately.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F29 — Field-Runner Mobile PWA Task Dashboard

**Depends on:** F02, F03 · **Docs:** PRD §3.3, §3.8, §3.18

```text
Build the mobile-optimized Field-Runner PWA dashboard (`src/app/runner/`):
1. Mobile PWA Viewport:
   - Designed for Android mobile web / PWA installed on runner devices.
   - Role-restricted to `FIELD_RUNNER` staff. PII-masked customer addresses (runner only sees wholesale stall locations).
2. Sourcing Tasks Queue (`src/app/runner/tasks/page.tsx`):
   - List of active drop-and-pack pickup tasks grouped by Nawabpur wholesale stalls/markets.
   - Task Card: SKU title, quantity needed, reference image, target wholesale price, stall contact.
   - Interactive Status Stepper: [ Accept Task ] -> [ At Stall ] -> [ Purchased ] -> [ Returned to Godown ].
3. Spot-Price Negotiation Input:
   - Runner enters actual spot price negotiated with wholesale merchant.
   - If spot price exceeds SKU maximum threshold, displays "Supervisor Override Required" alert
     with one-tap supervisor approval request dispatch.

Done when:
- Runner task list works seamlessly on mobile screen viewports.
- Price override alert prevents purchase completion until approved.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F30 — Runner Camera Voucher Scanner & Float Balance Reconciler

**Depends on:** F29 · **Docs:** PRD §3.3, §3.13

```text
Build runner cash float management and physical receipt capture:
1. Cash Float Balance Bar:
   - Sticky header displaying runner's current cash float balance (e.g., "Cash in Hand: ৳12,450").
   - Updates in real-time as purchases are recorded.
2. Wholesale Stall Receipt Camera Scanner:
   - Mobile camera trigger to capture wholesale stall memo/invoice voucher.
   - Client-side image compression (< 1MB) with instant upload to godown intake pipeline.
3. Godown Intake Handover:
   - Once runner returns to central godown, one-tap "Handover Batch" generates handover QR code
     for Godown QC Agent to scan and intake items into physical inventory.

Done when:
- Camera capture works on mobile web browsers with file input fallback.
- Float balance updates dynamically after each recorded purchase.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F31 — Admin Backoffice Shell, RBAC Navigation & Metrics

**Depends on:** F02, F03 · **Docs:** PRD §3.9, §3.17, architechture.md §17

```text
Build the Admin Backoffice Dashboard shell (`src/app/admin/`):
1. Dashboard Shell & RBAC-Aware Navigation:
   - Left sidebar with collapsible sections:
     * Overview, Catalog & SKUs, Orders & Fulfillment, Godown & QC, Runner Sourcing,
       Financial Ledger, Customer Service & RMA, Staff & Roles, System Health.
   - Granular RBAC masking: Menu items automatically hide if the authenticated staff member
     lacks the required role (e.g., Runners and QC agents cannot see Finance or Staff menus).
2. Executive Analytics Overview (`src/app/admin/page.tsx`):
   - KPI Stat Cards: Gross Revenue (BDT ৳), Daily Drop-and-Pack Orders, Active Pre-Orders,
     RTO Rate (%), Open RMA Claims.
   - Interactive Revenue & Order Volume Area Charts with date range picker (Today, 7D, 30D, MTD).
   - Live Activity Feed: Real-time ticker showing new orders, runner purchases, and seal verifications.

Done when:
- Staff with different roles see strictly their permitted navigation items.
- Analytics charts render smoothly with responsive SVG/Canvas.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F32 — Admin Catalog Governance & Multi-Media Manager

**Depends on:** F31 · **Docs:** PRD §3.15, api-spec.md §4

```text
Build the Catalog & SKU Management backoffice suite (`src/app/admin/catalog/`):
1. Product & SKU Listing:
   - Searchable, filterable data table with pagination, column sorting, and bulk actions.
   - Quick filters: [ Draft ] [ Review Required ] [ Active Authentic ] [ Active Budget Smart ] [ Archived ].
2. Product Editor Wizard (`src/app/admin/catalog/products/[id]/page.tsx`):
   - Tier Selector with strict spec requirements (Authentic distributor info vs. OEM specs).
   - Multi-Media Drag & Drop Uploader:
     * High-res product images, unboxing video clips, distributor certificate documents.
     * Drag-to-reorder thumbnail sequence.
   - Dynamic Specification Fields: Renders custom input attributes based on selected Category
     (e.g., Wattage, Cable Length, Chipset, Battery Chemistry).
   - Pricing & Margin Calculator: Live margin preview based on wholesale baseline cost vs retail BDT.

Done when:
- Uploading images displays real-time progress and allows reordering via drag-and-drop.
- Saving product validates all mandatory tier-specific fields before publishing.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F33 — Admin Order Management Kanban & Dispatch Pipeline

**Depends on:** F31 · **Docs:** PRD §3.11, §3.12, §3.13

```text
Build the operational Order Fulfillment management pipeline (`src/app/admin/orders/`):
1. Order Pipeline Kanban Board:
   - Columns: [ PENDING_CONFIRMATION ] [ SOURCING_RUNNER ] [ AT_GODOWN_QC ] [ PACKED ] [ WITH_COURIER ] [ DELIVERED ].
   - Drag-and-drop order cards across valid state machine transitions.
   - Order Card highlights: Order Number, Customer Name, Division, Paisa Total, Payment Badge, SLA Timer
     (turns red if order pending > 4 hours).
2. Dispatch & Courier Manifest Console:
   - Select multiple packed orders and generate bulk Courier Dispatch Manifest (Pathao / Steadfast).
   - One-click consignment booking generating tracking numbers and printing shipping labels.

Done when:
- Dragging an order card calls backend status transition API and updates state optimistically.
- Invalid state transitions (e.g., jumping from PENDING to DELIVERED) are prevented with visual error shake.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F34 — Godown QC Station & Thermal Seal Printing Console

**Depends on:** F31, F28 · **Docs:** PRD §3.2, §3.10, architechture.md §7

```text
Build the Godown Quality Control and Holographic Seal printing console (`src/app/admin/qc/`):
1. Godown Intake & Inspection Queue:
   - Godown agent scans runner voucher or order number to load item for inspection.
   - Visual QC Inspection Checklist: Housing, Cable Integrity, Voltage/Wattage Test, Packaging.
   - Defect Logging Modal: Mark as Defective -> triggers runner return to wholesale stall.
2. Thermal Seal Print Station (`PRINT_SEALS` Action):
   - For approved orders, triggers generation of cryptographically randomized Crockford Base32 Seal ID.
   - Preview of Destructive Holographic Seal label (includes Seal ID, QR code, Serial Number, Date).
   - Native thermal printer output formatted for standard 50mm x 25mm holographic adhesive label rolls.
3. Seal Void Protocol:
   - Void damaged labels with mandatory reason selection (`PRINTER_JAM`, `RIBBON_TEAR`, `STICKER_DAMAGED`).

Done when:
- Printing seals generates valid Base32 IDs and registers them via backend QC API.
- Void protocol accurately tracks voided serials in audit logs.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F35 — Double-Entry Financial Ledger Viewer & Settlements

**Depends on:** F31 · **Docs:** PRD §3.13, architechture.md §9

```text
Build the Finance Manager dashboard for double-entry ledger inspection (`src/app/admin/finance/`):
1. Double-Entry General Ledger Explorer:
   - Searchable table of journal entries: Entry Number, Timestamp, Source Event (Order #, Refund #, Settlement).
   - T-Account View: Shows balanced Debits and Credits with zero-discrepancy validation badge.
   - Account Filter: Cash on Hand, Bank (SSLCommerz), Courier Escrow, Accounts Receivable, Inventory, Revenue, Tax/VAT Payable.
2. Courier COD & Gateway Settlement Reconciler:
   - Courier Reconciliation Panel: Match incoming courier bank remittances against delivered COD parcels.
   - Flag unreconciled parcels older than 7 days with red warning indicator per PRD §3.13.
3. Financial Export:
   - Export official Mushak 6.3 VAT sales register and Trial Balance to CSV/Excel.

Done when:
- Ledger viewer displays strictly balanced Debits == Credits for every transaction.
- Settlement reconciliation highlights matching and mismatched parcel amounts cleanly.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F36 — Staff RBAC, Audit Logs & Data Privacy Console

**Depends on:** F31 · **Docs:** PRD §3.9, §3.18, architechture.md §17

```text
Build the Security, Access Control, and Compliance console (`src/app/admin/security/`):
1. Staff Roles & Permissions Manager:
   - List staff accounts with assigned roles (10 roles per PRD §3.9).
   - Role assignment modal with granular permission checkboxes.
   - Staff TOTP 2FA reset and temporary password generation with copy-to-clipboard.
2. Immutable Audit Log Viewer:
   - Searchable log stream: Timestamp, Actor, Action (PRICE_OVERRIDE, SEAL_VOID, REFUND_ISSUED), Target Resource, IP.
   - Diff Viewer showing before-and-after JSON changes.
3. Customer PII Anonymization & Data Retention:
   - GDPR/Privacy compliance tool: Anonymize customer personal data after retention period while preserving
     immutable financial ledger records per PRD §3.18.

Done when:
- Audit log renders expandable diff view of changed attributes.
- Role modifications take effect immediately upon next staff action.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F37 — Accessibility, Internationalization & Reduced Motion

**Depends on:** F01–F36 · **Docs:** PRD §3.18

```text
Perform a comprehensive accessibility, localization, and motion audit across all pages:
1. Keyboard Navigation & Screen Reader ARIA:
   - Full keyboard accessibility (Tab, Shift+Tab, Enter, Space, Escape, Arrow keys).
   - Meaningful `aria-label`, `aria-expanded`, `aria-live`, and `role` attributes on all dynamic widgets.
   - Skip to main content links on all public and admin pages.
2. Internationalization & Bilingual Polish:
   - English and বাংলা (Bengali) strings across all storefront flows.
   - Proper numeral formatting in Bengali (১, ২, ৩) and English (1, 2, 3) based on active locale.
3. Reduced Motion Support:
   - Verify all CSS transforms, spring physics, and confetti animations respect `@media (prefers-reduced-motion: reduce)`
     with instant opacity cross-fades instead of spatial movements.

Done when:
- Automated accessibility scan (axe / lighthouse) reports 0 critical violations.
- Navigating storefront solely with keyboard reaches all interactive elements smoothly.
- `pnpm lint && pnpm typecheck && pnpm test` pass.
```

---

## F38 — End-to-End Visual Testing, Lighthouse Audit & Production Polish

**Depends on:** F01–F37 · **Docs:** PRD §6, architechture.md §17

```text
Execute final verification, performance benchmarking, and production packaging:
1. Lighthouse Performance & Core Web Vitals Audit:
   - Performance ≥ 90 on mobile, ≥ 95 on desktop.
   - First Contentful Paint (FCP) < 1.2s.
   - Largest Contentful Paint (LCP) < 2.5s.
   - Cumulative Layout Shift (CLS) < 0.01.
2. End-to-End Critical User Journey Smoke Tests:
   - Journey 1: Customer opens home -> searches GaN charger -> filters Authentic -> adds to cart -> completes checkout.
   - Journey 2: Customer enters Seal ID on `/verify` -> inspects 3D holographic seal card and packaging video.
   - Journey 3: Showroom agent logs into POS -> scans barcode -> processes cash sale -> previews thermal receipt.
   - Journey 4: Field runner opens PWA -> accepts sourcing task -> records negotiated spot price -> uploads memo.
3. Production Bundle Optimization:
   - Verify image optimization, dynamic imports for heavy modals, and standalone build readiness.

Done when:
- Full test suite passes: `pnpm lint && pnpm typecheck && pnpm test`.
- All 38 frontend prompts documented and ready for systematic execution.
```

---

## Appendix A — Design System Tokens & Color Palette

| Token | Dark Mode Value | Light Mode Value | Purpose |
| :--- | :--- | :--- | :--- |
| `--bg-base` | `#0B0F19` (Deep Obsidian) | `#F8FAFC` (Pure Pearl) | App background |
| `--bg-surface` | `#111827` (Rich Slate) | `#FFFFFF` (Surface White) | Cards, panels, modals |
| `--bg-surface-elevated` | `#1F2937` (Elevated Slate) | `#F1F5F9` (Soft Gray) | Dropdowns, tooltips, hover cards |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | `rgba(0, 0, 0, 0.08)` | Section dividers |
| `--border-glow` | `rgba(255, 255, 255, 0.16)` | `rgba(0, 0, 0, 0.16)` | Card borders, interactive rings |
| `--text-primary` | `#F9FAFB` (High-contrast) | `#0F172A` (Deep Ink) | Headings, primary text |
| `--text-secondary` | `#9CA3AF` (Muted) | `#475569` (Slate) | Descriptions, labels |
| `--brand-authentic` | `#F59E0B` (Champagne Gold) | `#D97706` (Amber Gold) | 100% Authentic Badges, Seals |
| `--brand-budget` | `#14B8A6` (Cyber Teal) | `#0D9488` (Deep Teal) | Budget Smart Tested OEM Badges |
| `--accent-success` | `#10B981` (Emerald) | `#059669` (Forest Green) | QC Passed, Stock In Hand |
| `--accent-destructive` | `#EF4444` (Crimson) | `#DC2626` (Red) | Void Seals, Cancelled Orders |

---

## Appendix B — Physics Motion & Micro-Interaction Tokens

```css
:root {
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-smooth: cubic-bezier(0.4, 0, 0.2, 1);
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --duration-deliberate: 600ms;
}
```

---

## Appendix C — Frontend Route & Directory Tree

```text
src/
├── app/
│   ├── layout.tsx                   # Global Root Layout (Tokens, Font, Providers)
│   ├── page.tsx                     # F07: Interactive Homepage
│   ├── products/
│   │   ├── page.tsx                 # F10: Catalog Listing & Faceted Filters
│   │   └── [slug]/page.tsx          # F12: Product Detail Page & 3D Holographic Seal
│   ├── compare/page.tsx             # F11: Side-by-Side Spec Comparison Matrix
│   ├── pre-orders/page.tsx          # F18: Pre-Order Showcase & Milestone Tracker
│   ├── verify/
│   │   ├── page.tsx                 # F20: Public Holographic Seal Verification Portal
│   │   └── [sealId]/page.tsx        # F21: Verification Result & Packaging Video
│   ├── checkout/
│   │   ├── page.tsx                 # F15, F16: Multi-Step Checkout & COD Meter
│   │   └── success/[orderNumber]/   # F17: Order Confirmation & Celebration
│   ├── account/                     # F22, F23, F24, F26: Customer Self-Service Portal
│   ├── pos/                         # F27, F28: Showroom Counter POS Console
│   ├── runner/                      # F29, F30: Field-Runner Mobile PWA
│   └── admin/                       # F31–F36: Operations, QC, Orders, Ledger & Staff
├── components/
│   ├── ui/                          # F02: Primitive UI Component Library
│   ├── layout/                      # F04, F06: Topbar, Mega-Menu, Mobile Bottom Nav
│   ├── search/                      # F05: Cmd+K Instant Spotlight Search Modal
│   ├── catalog/                     # F08, F10: Dual-Tier Product Cards, Filters
│   ├── trust/                       # F13, F20: 3D Holographic Card & Tilt Shimmer
│   ├── cart/                        # F14: Slide-Over Cart Drawer & Reservation Timer
│   ├── pos/                         # F27, F28: Barcode Listener, Thermal Receipt
│   └── rma/                         # F24: Video Upload & Defect Claim Wizard
├── context/                         # F03: AuthContext, ThemeContext, CartContext
├── hooks/                           # F03: useRealtimeEvents, useDebounce, useBarcode
└── styles/
    ├── tokens.css                   # F01: CSS Custom Properties & Design Tokens
    └── globals.css                  # F01: Global Resets, Typography & Animations
```
