# Complete advanced invoice items and digital receipts

## Build
- Extend each invoice line with its own discount percentage, tax percentage, and optional serial/IMEI list; validate serial count against quantity and calculate line totals before applying the existing invoice-level adjustments.
- Store and retrieve these fields from the database, then show them in invoice details, cloning, bulk output, and printable receipts.
- Add a public, unguessable digital receipt link backed by a restricted database function that returns only receipt-safe invoice/customer data.
- Add a customer-facing receipt page, point printed QR codes to it, and add copy-link, native sharing, WhatsApp, and PNG download actions.

## Technical details
- Add nullable/defaulted columns to `invoice_items` and an opaque `receipt_token` to `invoices`; preserve existing rows and current RLS.
- Expose receipt data only through a security-definer read function keyed by the opaque token; do not grant anonymous table access.
- Use a browser-safe DOM-to-image utility for PNG export and keep all current invoice workflows intact.
- Verify database migration, typecheck/build telemetry, and the relevant desktop/mobile UI flows.
