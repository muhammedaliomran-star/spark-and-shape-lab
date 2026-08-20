# Accounting Expansion: Purchases & Reports

Expand the application's accounting capabilities by implementing the Purchase Cycle (Invoices and Suppliers) and advanced Financial Reports, while integrating dynamic data into the Dashboard.

## Proposed Changes

### 1. Purchase Cycle (Purchases)
- **Purchase List UI (`src/routes/purchases/index.tsx`)**:
  - Implement a list of purchase invoices with search and status filtering (Cash/Credit).
  - Use standardized card design (Supplier, Total, Date, Status).
- **New Purchase Form (`src/routes/purchases/new.tsx`)**:
  - Implement a full-page, multi-step or streamlined two-column form for recording stock purchases.
  - Include fields for Supplier selection, Date, Payment Type (Cash/Credit), Notes.
  - Line items management: Item name (search existing/add new), Quantity, Unit Cost.
  - Profit Protection: Privacy mode toggle for cost/totals.
  - Automated stock update upon saving (via `db.addPurchase` logic).

### 2. Financial Reports
- **Reports Module UI (`src/routes/reports/index.tsx`)**:
  - Implement the full Reports page currently mocked.
  - Financial KPIs: Net Sales, Cost of Goods Sold (Purchases), Expenses, Gross Profit, Net Profit.
  - Advanced Charts: Monthly performance comparison (Sales vs Purchases), Profit Trends.
  - Export functionality (Excel/PDF) using existing `pdfDocument` patterns.
  - Tax report summary.

### 3. Dashboard Integration
- **Dynamic Metrics (`src/pages/Dashboard.tsx`)**:
  - Replace static 25% profit estimate with dynamic profit calculation based on actual costs from invoice items and purchases.
  - Update the profit trend chart to reflect real net income.

### 4. Database & Logic (`src/lib/store.ts`)
- Ensure `getFinancialReport` correctly aggregates data from all relevant tables (`invoices`, `purchases`, `expenses`, `return_records`).
- Add missing helper methods if needed for per-item cost tracking verification.

## Technical Details
- Use `@tanstack/react-router` for all new routes.
- Style with Tailwind CSS v4, following the existing `plate` and `bezel-lift` design language.
- Use `recharts` for data visualization.
- Ensure RTL support for all new Arabic UI elements.
- Maintain Privacy Mode across all financial screens.
