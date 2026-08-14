# Invoices Overhaul Plan

Standardize the "Invoices and Installments" section to match the specific layout and features shown in the reference images, including a 9-card metric grid and a Returns management system.

## Proposed Changes

### 1. Metric Grid Update (`src/pages/Invoices.tsx`)
- Replace the current 3-card grid with a 9-card responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).
- Add specific metrics with green-themed icons:
    - **Total Paid** (إجمالي المسدد): Sum of all payments.
    - **Total Sales** (إجمالي المبيعات): Sum of all invoice totals.
    - **Invoice Count** (عدد الفواتير): Total number of invoices.
    - **Late Invoices** (الفواتير المتعثرة): Count of invoices with remaining balance and past due date.
    - **Current Month Collections** (تحصيلات الشهر الحالي): Sum of payments made in the current calendar month.
    - **Active Sales** (إجمالي المبيعات النشطة): Sum of remaining balances on all invoices.
    - **Collection Rate** (نسبة التحصيل): `(Total Paid / Total Sales) * 100`.
    - **Average Invoice Value** (متوسط قيمة الفاتورة): `Total Sales / Invoice Count`.
    - **Current Month Sales** (مبيعات الشهر الحالي): Sum of invoice totals created in the current calendar month.

### 2. Navigation & Tabs
- Update `Tabs` to include a new "Returns" (المرتجعات) tab.
- Standardize labels: Active (فواتير نشطة), Late (متأخرة), Collected (تم التحصيل), All (الكل), Returns (المرتجعات).

### 3. Returns Management System
- **Backend Model**: Add `ReturnRecord` and `ReturnItem` interfaces to `src/lib/store.ts`.
- **Database Schema**:
    - `return_records`: id, invoice_id, type (sale/supplier), total_amount, reason, notes, created_at.
    - `return_items`: id, return_id, name, unit_price, quantity.
- **UI Components**:
    - **Register New Return Form**: Toggle for Sale vs. Supplier return, Invoice selection, dynamic item list (name, price, quantity), and Reason field.
    - **Returns Log**: A list of historical returns with "No returns" empty state matching the image.
- **Logic**: Automatically adjust stock levels when a return is recorded (add back to stock for sale returns).

### 4. UI/UX Refinements
- Update empty states with specific Arabic text and icons from the screenshots.
- Ensure `privacy-blur` is applied to all new financial metrics.

## Technical Details
- **Grid Layout**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8`.
- **Icons**: Use `Lucide` icons (`Wallet`, `TrendingUp`, `FileText`, `AlertCircle`, `Calendar`, `Percent`, `Recycle`).
- **State**: Add `returns` to the `useDB` hook in `src/lib/store.ts`.
- **Security**: Implement RLS policies for new `return_records` and `return_items` tables.
