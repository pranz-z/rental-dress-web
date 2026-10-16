# Maison Rêve: Dress Rental Website Spec

*A refined, feminine rental experience for special-occasion dresses, with a studio admin for managing bookings, inquiries, and schedules.*

Version 1.1

---

## 1. Overview

**Working name:** Maison Rêve (placeholder; replace with the final brand)

**Purpose:** An online boutique where women rent designer and occasion dresses for weddings, galas, proms, birthdays, engagements, and photoshoots, with the ease of online shopping and the feel of a private fitting room.

**Brand personality:** Elegant, warm, confident, effortless. Think boutique bridal salon, not discount marketplace.

**Goals**

- Make renting feel as luxurious as buying
- Remove fear around fit, condition, and returns
- Drive confident bookings with clear dates, pricing, and delivery
- Give the studio team one place to manage bookings, inquiries, and schedules

---

## 2. Target Audience

| Segment | Needs |
|---|---|
| Wedding guests and bridesmaids | Coordinated looks, multiple sizes, date certainty |
| Event-goers (galas, formals, proms) | Statement pieces, fast delivery, budget-friendly |
| Brides and engagement or shower hosts | Premium gowns, fittings, white-glove service |
| Fashion-forward renters | Frequent rentals, membership value, new arrivals |

---

## 3. Visual Design Direction

### Mood
Soft, airy, editorial. Generous white space, delicate details, and photography that feels like a fashion magazine spread.

### Color Palette

| Role | Name | Hex |
|---|---|---|
| Background | Ivory | `#FBF7F4` |
| Primary accent | Dusty Rose | `#D8A7A7` |
| Secondary accent | Blush | `#F3E1E1` |
| Highlight | Champagne Gold | `#C9A96E` |
| Text | Soft Charcoal | `#3B3536` |
| Muted text | Warm Taupe | `#8C7F7B` |
| Deep accent | Mulberry | `#7A3E4D` |

**Usage:** Ivory is the dominant canvas. Dusty rose and blush for soft panels. Champagne gold only for fine details (dividers, icons, hover underlines). Mulberry for key calls to action and links.

### Typography

- **Headings:** Cormorant Garamond or Playfair Display
- **Body and UI:** Lato or Montserrat Light
- **Accents:** Italic serif for pull quotes and taglines

### Imagery

- Full-length editorial photography on soft neutral or blush backdrops
- Consistent 3:4 portrait ratio for all product images
- Each dress shown front, back, detail, and on-body in two sizes

### UI Details

- Rounded corners (8–12px), thin 1px blush or champagne borders
- Soft, diffused shadows only
- Pill-shaped buttons: mulberry fill with ivory text; secondary buttons outlined in dusty rose
- Subtle interactions: image fade on hover, heart icon that blooms when saved

---

## 4. Customer Site Map

1. Home
2. Shop (by occasion, length, designer, new arrivals)
3. Dress detail page
4. How it works
5. Size and fit guide
6. Membership
7. Reviews and real events
8. Cart and checkout
9. Account (rentals, favorites, measurements, returns)
10. Help center, contact, policies

---

## 5. Key Customer Pages

### 5.1 Home
- Full-width editorial hero with one call to action ("Find your dress")
- Date-first search bar: event date, occasion, size, with live availability
- Shop by occasion tiles, trending carousel, how it works, customer photo grid, membership teaser, newsletter signup

### 5.2 Shop
- 3–4 column grid with large images, name, designer, rental price, retail value
- Filters: occasion, size, color, length, price, neckline, sleeve, fabric, availability on date
- Wishlist heart on every card; "Available for your date" badge

### 5.3 Dress Detail
- Image gallery with zoom and a short fabric-movement video
- Rental price vs. retail value (for example, Rent $85, Retail $520)
- Size selector with **backup size** option
- 4-day or 8-day rental picker with live availability calendar
- Fit notes, photo reviews, accessory add-ons, delivery and return information

### 5.4 Cart and Checkout
- Single-page guided checkout with progress indicator
- Delivery date confirmation, optional add-ons (backup size, insurance, accessories)
- Apple Pay, Google Pay, cards, buy-now-pay-later
- Reassurance block: free return label, free cleaning, easy exchanges

### 5.5 Account
- Upcoming and past rentals with return tracking
- Saved measurements, favorites, event lists, membership credits

---

## 6. Core Customer Features

**Must have (MVP)**

- Date-based availability calendar and booking engine
- Size and fit guidance with measurement chart
- Backup size option
- Secure payments and damage deposit or insurance option
- Prepaid return labels and shipment tracking
- Email and SMS reminders (shipping, return due date)
- Wishlist, accounts, photo reviews

**Should have (Phase 2)**

- Membership (for example, 3 rentals per month)
- Virtual stylist chat and recommendations
- Accessory bundles, gift cards, referral program

**Nice to have (Phase 3)**

- Virtual try-on or fit prediction
- Local try-on appointments
- Resale of retired inventory
- Group planning tools for bridal parties

---

## 7. Studio Admin (Backend)

A private web application for the studio team to review bookings, answer customer inquiries, and manage the delivery and return schedule. It shares the brand look of the storefront (ivory, dusty rose, mulberry, champagne) with a calmer, denser layout built for daily work.

### 7.1 Roles and Access

| Role | Access |
|---|---|
| Owner | Everything, including revenue, pricing, staff accounts |
| Studio manager | Bookings, schedule, inquiries, inventory, customers |
| Stylist | Inquiries, customers, read-only bookings |
| Fulfillment | Schedule, shipping, returns and the cleaning queue — can ship, deliver and return bookings, but no pricing, payment details, extensions or cancellations |

- Payment details, extensions and cancellations are hidden from Fulfillment; Stylist reviews bookings read-only
- Email and password sign-in with two-factor authentication
- Session timeout after 30 minutes of inactivity
- Audit log of status changes, refunds, and replies

### 7.2 Admin Sitemap

1. **Overview:** daily snapshot
2. **Bookings:** all reservations
3. **Schedule:** deliveries and returns
4. **Inquiries:** customer messages
5. **Inventory:** dresses and availability
6. **Customers:** profiles and history
7. **Settings:** staff, policies, notifications

### 7.3 Overview

A daily snapshot for the studio manager.

- **Summary cards:** revenue this month, active rentals, open inquiries, inventory utilization
- **Next on the schedule:** the next six deliveries and returns
- **Recent inquiries:** latest four messages with unread marker
- **Latest bookings:** five most recent reservations

### 7.4 Bookings

Searchable, filterable list of every reservation.

- **Columns:** booking ID, customer, dress and size, event type, event date, return date, status, total
- **Statuses:** Pending, Confirmed, Shipped, With customer, Late, Returned
- **Filters and search:** by status chip; search by name, dress, or booking ID
- **Detail view:** customer contact, delivery address, payment and deposit status, notes, timeline of status changes
- **Actions:** confirm, mark as shipped, mark as returned, extend rental, cancel and refund, add internal note

### 7.5 Schedule

Operational view of what must leave and arrive each day.

- Grouped by day, starting with today, with weekday and date headings and a today marker
- Each entry shows type (Delivery or Return due), dress, customer, size, booking ID, and status
- Overdue returns are pinned to the top and highlighted with the Late chip
- Buffer days for cleaning and inspection are applied automatically between rentals; the cleaning queue lets staff mark cleaning complete (dress returns to Available, written to the audit log)
- Quick actions from the schedule: mark shipped, mark delivered, mark returned — respecting roles
- Filters: type (Deliveries, Returns, Cleaning) and date range (7, 14 or 30 days)
- Printable daily run sheet for the courier
- Future: calendar month view, courier pickup export

### 7.6 Inquiries

A shared inbox for questions that arrive through the contact form, dress page, and email.

- **List:** sender, subject, topic, time received, open or resolved marker
- **Topics:** Sizing, Booking change, Group booking, Delivery, Damage, General
- **Conversation view:** original message, previous replies, reply box
- **Actions:** send reply (emailed to the customer), mark resolved, reopen, assign to teammate
- **Targets:** first reply within 2 hours during studio hours
- Sidebar badge shows the number of open inquiries

### 7.7 Inventory

- **Columns:** dress name, category, available sizes, status, times rented, retail value
- **Statuses:** Available, Rented, Cleaning, Retired
- **Detail view:** photos, rental calendar, care notes, condition log, cleaning history
- **Actions:** add or edit dress, block dates, mark cleaning complete, retire item

### 7.8 Customers

- **Columns:** name, email, membership tier, rentals count, lifetime spend
- **Profile:** contact details, saved measurements, rental history, inquiries, notes
- Search by name or email

### 7.9 Settings

- Staff accounts and roles
- Rental periods, buffer days, late fees, deposit rules
- Email and SMS templates for confirmations, shipping, and reminders
- Business hours and delivery zones

---

## 8. Admin Data Model

| Entity | Key fields |
|---|---|
| **Booking** | id, customerId, dressId, size, eventType, deliveryDate, eventDate, returnDate, status, total, deposit, notes |
| **Dress** | id, name, category, sizes, retailValue, rentalPrice, status, timesRented, careNotes |
| **Customer** | id, name, email, phone, tier, measurements, lifetimeSpend, address |
| **Inquiry** | id, customerId, subject, topic, message, status, assignedTo, receivedAt |
| **Reply** | id, inquiryId, staffId, body, sentAt |
| **StaffUser** | id, name, email, role, twoFactorEnabled |
| **AuditLog** | id, staffId, action, entity, entityId, timestamp |

**Key rules**

- A booking cannot overlap another booking for the same dress and size, including buffer days
- Returning a booking moves the dress to Cleaning until a staff member marks it complete
- Replying to an inquiry marks it Resolved unless the staff member chooses otherwise
- A booking past its return date without a return scan becomes Late automatically

---

## 9. Seed Data for Build and Review

For the first build, the admin is populated with realistic sample records so every screen can be reviewed with content in place. All records are fictional.

### 9.1 Bookings

| ID | Customer | Dress | Size | Event | Event date | Return | Status | Total |
|---|---|---|---|---|---|---|---|---|
| MR-2841 | Camille Dubois | Valentina Silk Gown | S | Wedding guest | Oct 17 | Oct 21 | Shipped | $185 |
| MR-2840 | Priya Nair | Aurelia Beaded Gown | M | Gala | Oct 16 | Oct 20 | With customer | $320 |
| MR-2839 | Hannah Whitfield | Rosalind Lace Midi | L | Engagement party | Oct 18 | Oct 22 | Confirmed | $140 |
| MR-2838 | Sofia Marquez | Celeste Satin Slip | XS | Birthday dinner | Oct 15 | Oct 19 | With customer | $95 |
| MR-2837 | Elena Rossi | Margaux Velvet Gown | M | Black tie | Oct 20 | Oct 24 | Confirmed | $260 |
| MR-2836 | Naomi Clarke | Juliette Tulle Gown | S | Bridal shower | Oct 21 | Oct 25 | Pending | $210 |
| MR-2835 | Grace Tan | Odette Pleated Midi | M | Wedding guest | Oct 11 | Oct 15 | Late | $120 |
| MR-2834 | Amara Okafor | Seraphine Chiffon Maxi | L | Wedding guest | Oct 24 | Oct 28 | Confirmed | $165 |
| MR-2833 | Lucia Fernandez | Isadora Sequin Mini | S | Anniversary | Oct 10 | Oct 14 | Returned | $110 |
| MR-2832 | Beatrice Moreau | Valentina Silk Gown | M | Gala | Oct 28 | Nov 1 | Pending | $185 |

### 9.2 Inquiries

| From | Subject | Topic | Status |
|---|---|---|---|
| Charlotte Webb | Backup size for a wedding on Nov 14 | Sizing | Open |
| Diana Park | Extending my rental by two days | Booking change | Open |
| Mariam Hassan | Bridal party of six | Group booking | Open |
| Tessa Lindgren | Delivery to a hotel | Delivery | Open |
| Rachel Adeyemi | Stain on returned dress | Damage | Resolved |
| Zoe Carter | Do you rent accessories? | General | Resolved |

### 9.3 Inventory

| Dress | Category | Sizes | Status | Times rented |
|---|---|---|---|---|
| Valentina Silk Gown | Gown | XS–L | Available | 38 |
| Aurelia Beaded Gown | Gown | S–L | Rented | 52 |
| Rosalind Lace Midi | Midi | XS–XL | Available | 27 |
| Celeste Satin Slip | Midi | XS–M | Rented | 31 |
| Margaux Velvet Gown | Gown | S–L | Available | 24 |
| Juliette Tulle Gown | Gown | XS–M | Available | 19 |
| Odette Pleated Midi | Midi | S–L | Cleaning | 33 |
| Seraphine Chiffon Maxi | Maxi | XS–XL | Available | 41 |

### 9.4 Customers

| Name | Tier | Rentals | Lifetime spend |
|---|---|---|---|
| Elena Rossi | Paris Club | 14 | $3,720 |
| Priya Nair | Member | 12 | $2,980 |
| Sofia Marquez | Member | 9 | $1,650 |
| Camille Dubois | Paris Club | 7 | $1,240 |
| Grace Tan | Member | 5 | $880 |

### 9.5 Headline Figures

| Metric | Value |
|---|---|
| Revenue this month | $18,420 (+12% vs. previous month) |
| Inventory utilization | 74% |
| Average first-reply time | 1.4 hours |

---

## 10. Rental Rules and Pricing

- **Rental periods:** 4-day and 8-day; daily extensions available
- **Pricing:** typically 10–20% of retail value for the 4-day period
- **Buffer days:** 1–2 days between rentals for cleaning and inspection
- **Late fees:** per-day fee after a grace period
- **Damage:** minor wear covered; major damage billed up to a stated cap, with optional rental insurance
- **Cancellations:** free up to 7 days before the event; credit afterward

---

## 11. Content and Tone of Voice

- Warm, polished, encouraging, like a stylish friend
- Short, elegant microcopy: "Your dress is on its way." "Wear it. Love it. Send it back."
- Be transparent about fit, condition, and policies
- Admin copy is plain and direct: "Mark as returned", "Send reply", "Reopen inquiry"

---

## 12. Accessibility and Performance

- WCAG 2.1 AA; use charcoal or mulberry for text, never rose or gold
- Mobile-first and fully responsive, including the admin
- Alt text on all imagery; keyboard-navigable filters, tables, and calendars
- Optimized WebP images, lazy loading, under 2.5s Largest Contentful Paint

---

## 13. Recommended Technical Approach

| Layer | Suggestion |
|---|---|
| Storefront | Next.js with headless commerce, or Shopify with a rental app |
| Admin | React app on the same API, role-based access |
| API and database | Node.js with PostgreSQL |
| Booking and inventory | Date-range availability engine with buffer logic |
| Authentication | Auth0 or Clerk with two-factor authentication |
| Payments | Stripe (cards, wallets, BNPL) |
| Shipping | Shippo or EasyPost for labels and tracking |
| Notifications | Klaviyo or Twilio for email and SMS |
| Analytics | GA4 plus rental funnel tracking |
| Hosting | Vercel or Cloudflare |

---

## 14. Success Metrics

- Conversion rate from product view to booking
- Average order value including add-ons
- Repeat rental rate and membership sign-ups
- On-time return rate and damage rate
- Inquiry first-reply time and resolution rate
- Customer satisfaction (NPS) and review volume

---

## 15. Launch Roadmap

| Phase | Timeline | Deliverables |
|---|---|---|
| Discovery and branding | Weeks 1–3 | Brand identity, moodboards, final spec |
| Design | Weeks 4–7 | Wireframes, mockups, design system for storefront and admin |
| Build | Weeks 8–15 | Storefront, booking engine, checkout, admin |
| Testing and content | Weeks 14–17 | QA, photography, copywriting, staff training |
| Launch | Week 18 | Public launch with campaign |
| Growth | Ongoing | Membership, stylist tools, resale |

---

## 16. Open Questions

- Will inventory be owned, consigned, or both?
- Which regions will you ship to at launch?
- Local try-on appointments, or shipping only?
- What price range and designer tier are you targeting?
- Should membership launch with the site or later?
- How many staff will use the admin, and who needs which role?
