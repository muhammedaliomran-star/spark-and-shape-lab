# Standardize Card UI Layout across the App

Align the visual layout of cards across all sections (Inventory, Expenses, Invoices, Suppliers, Warehouse) to match the layout used in the "Customers" section, while excluding the Dashboard and Daily sections.

## Customer Card Reference
The "Customer" card (at `src/pages/Customers.tsx`) uses a specific layout:
- **Container**: `group bezel-shell bezel-lift` with `bezel-core`.
- **Grid Structure**: `grid grid-cols-1 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_auto] gap-5 md:gap-6 items-center`.
- **Section 1 (Identity)**: Icon/Avatar + Name + Phone + Badges (Status, Type, Rating).
- **Section 2 (Metrics)**: Balance/Value + Progress Bar (optional) + Sub-text.
- **Section 3 (Actions)**: Primary CTA button + Secondary icon buttons.

## Proposed Changes

### 1. Inventory Section (`src/pages/Inventory.tsx`)
- Replace the `table` rows with Customer-style cards.
- **Identity**: Product Name + Barcode/Type badges.
- **Metrics**: Quantity + Price/Profit metrics.
- **Actions**: Adjustment, History, Edit, Delete buttons.

### 2. Expenses Section (`src/pages/Expenses.tsx`)
- Replace the `table` rows with Customer-style cards.
- **Identity**: Date + Category badge.
- **Metrics**: Amount + Notes (as sub-text).
- **Actions**: Edit, Delete buttons.

### 3. Invoices Section (`src/pages/Invoices.tsx`)
- Replace the `table` rows with Customer-style cards.
- **Identity**: Invoice # + Customer Name + Date.
- **Metrics**: Total Value + Remaining Balance + Status badge.
- **Actions**: Print, Edit, Delete, Payment buttons.

### 4. Suppliers Section (`src/pages/Suppliers.tsx`)
- Replace the `table` rows with Customer-style cards.
- **Identity**: Supplier Name + Phone + Notes.
- **Metrics**: Balance + Status badge.
- **Actions**: Profile, Payment, Edit, Delete buttons.

### 5. Warehouse Section (`src/pages/Warehouse.tsx`)
- Update the existing grid cards to follow the standard 3-column layout (Identity | Metrics | Actions).
- **Identity**: Item Name + Category/Season badges.
- **Metrics**: Quantity + Cost + Total Value.
- **Actions**: Move to Shop, Edit buttons.

## Technical Details
- Use `cn` for conditional classes.
- Maintain existing logic (filters, sorting, privacy mode blurring).
- Ensure responsiveness (stack to 1 column on mobile, horizontal grid on tablet/desktop).
- Use `framer-motion` for stagger entrance animations to match the premium feel.
