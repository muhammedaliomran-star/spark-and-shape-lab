# Shipping reliability and tracking automation

## Goal
Make courier settlements database-only, calculate overdue shipments consistently from each zone’s SLA, create durable in-app late-shipment alerts, and ensure every tracking link/QR opens the correct `/track` lookup.

## Changes
1. **Courier ledger persistence**
   - Replace all `localStorage` reads/writes in `carrier-ledger.ts` with authenticated database CRUD against `carrier_settlements`.
   - Update the reconciliation screen to await loading, saving, and deletion, show failures, and refresh from the database after each change.
   - Remove the legacy key `segelly_carrier_settlement_transactions_v1` entirely; no fallback or browser migration path will remain.

2. **SLA and late-shipment state**
   - Add one shared shipping SLA utility that uses persisted `expected_delivery_date`, with a zone `estimatedDays` fallback for older rows.
   - Persist `expected_delivery_date` when creating or reassigning a shipment so the deadline remains stable and auditable.
   - Use the same shared calculation for `lateCount`, late badges, filters, and the rescue list.

3. **Automatic in-app alerts and history**
   - Add a database-backed shipping alert table with per-user RLS and deduplication per shipment/deadline.
   - Sync overdue active shipments into alerts when shipping data loads/refreshes; mark resolved when the shipment is no longer late or becomes terminal.
   - Display late-shipment alerts and their created/resolved history in the shipping experience, with a direct action to open the affected shipment.

4. **Tracking link notifications**
   - After a successful status change, create an in-app notification containing the customer tracking link and offer a one-click WhatsApp action; no message will be sent without user confirmation.
   - Cover both single and bulk status changes while avoiding duplicate notifications for the same shipment/status.
   - Centralize link construction so notifications, WhatsApp templates, and labels all use the same lookup identifier and `/track` URL.

5. **QR label correctness**
   - Add a QR code to each shipping label pointing to `/track?num=…&phone=…`.
   - Prefer the public storefront order number when available; otherwise use the shipment tracking number only when the public tracking endpoint can resolve it.
   - Verify the generated QR payload and the `/track` page lookup end to end.

6. **Validation and cleanup**
   - Confirm the old settlement storage key has zero code references and verify database insert/read/delete with an authenticated session.
   - Test late-count and alert deduplication/resolution against real shipment rows.
   - Fix the currently reported TypeScript/build failures, including any pre-existing errors shown by the preview build log, then verify the relevant shipping flows in the browser.

## Technical notes
- All new database objects will include explicit grants, RLS, owner-scoped policies, indexes, and idempotent constraints in one migration.
- Client writes remain authenticated and scoped by the current user; caller-supplied ownership is never accepted.
- WhatsApp behavior follows the selected mode: an in-app alert/action is created automatically, while the final WhatsApp send remains user-triggered.
