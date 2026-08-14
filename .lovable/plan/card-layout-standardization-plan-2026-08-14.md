# Card Layout Standardization Plan

Standardize the card UI across Inventory, Expenses, Invoices, and Suppliers sections to match the "Customers" section style. This improves visual consistency and modernization, utilizing the 3-column responsive grid layout.

## User Review Required

> [!IMPORTANT]
> This will change tables in the following sections into modern, mobile-friendly card lists:
> - **Inventory (الأصناف)**
> - **Expenses (المصروفات)**
> - **Invoices (الفواتير والمبيعات)**
> - **Suppliers (الموردين والمشتريات)**
> 
> Dashboard and Daily (اليومية) sections will remain unchanged as requested.

## Proposed Changes

### Card Components
- Standardize on `BezelCard` for all list items.
- Use the responsive 3-column grid pattern: `grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto]`.
- Maintain privacy mode blurring for all financial values.

### 1. Inventory Section (`src/pages/Inventory.tsx`)
- Replace the `<table>` with a list of standardized cards.
- **Identity Column:** Product name, type/size, and barcode (with icon).
- **Metrics Column:** Available quantity (with status color), cost, price, and unit profit (with trend icon).
- **Actions Column:** Adjust, History, Edit, Move to Warehouse, and Delete.

### 2. Expenses Section (`src/pages/Expenses.tsx`)
- Replace the `<table>` with standardized cards.
- **Identity Column:** Category badge and date.
- **Metrics Column:** Amount (highlighted in red) and notes.
- **Actions Column:** Edit and Delete.

### 3. Invoices Section (`src/pages/Invoices.tsx`)
- Replace the `<table>` with standardized cards.
- **Identity Column:** Invoice ID (mono font) and Customer Name (link).
- **Metrics Column:** Total amount, remaining balance (with status color), installment info, and next due date.
- **Actions Column:** View, Edit, Print, Add Payment, and Delete.

### 4. Suppliers Section (`src/pages/Suppliers.tsx`)
- Replace the `<table>` with standardized cards.
- **Identity Column:** Supplier Name and contact phone.
- **Metrics Column:** Current balance (status colored) and notes snippet.
- **Actions Column:** History, Add Payment, Edit, and Delete.

## Technical Details

- **Responsive Grid:** `grid-cols-1 items-center gap-5 p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] md:gap-6`
- **Animations:** Use `framer-motion` for smooth entry/exit and layout transitions (matching the Customers page).
- **Empty States:** Ensure each list has a high-quality `EmptyState` component when no results are found.
- **Performance:** Lists will use `ScrollArea` where appropriate to maintain smooth scrolling.
