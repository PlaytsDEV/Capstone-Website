# Lilycrest DMS — Billing UI & Design System Guidelines

This document outlines the UI design rules, CSS design tokens, component standards, and screen layout audit guidelines for Module 4 (Billing Management Interface).

---

## 1. Design Tokens & Styling Philosophy

### Bespoke HSL Color Palette
In accordance with workspace design guidelines, the billing interface uses custom HSL color harmonies to avoid generic AI-generated templates:

```css
:root {
  /* Brand Harmony Tokens */
  --color-brand-primary: hsl(220, 48%, 22%);
  --color-brand-accent: hsl(38, 92%, 50%);
  
  /* Status Indicators */
  --color-status-paid-bg: hsl(142, 72%, 95%);
  --color-status-paid-text: hsl(142, 72%, 29%);
  --color-status-pending-bg: hsl(38, 92%, 95%);
  --color-status-pending-text: hsl(38, 92%, 35%);
  --color-status-overdue-bg: hsl(0, 84%, 95%);
  --color-status-overdue-text: hsl(0, 84%, 42%);
}
```

### High-Contrast Visual Unification
- All cards leverage crisp border definitions (`1px solid var(--color-border)`), subtle glassmorphism backgrounds (`backdrop-filter: blur(8px)`), and modern typography (`Inter`, `Outfit`).
- Status badges use standardized padding (`0.25rem 0.75rem`), rounded pill borders (`border-radius: 9999px`), and consistent font weights (`600`).

---

## 2. Layout Structure & Component Boundaries

### Sub-Tab Navigation Pattern
The Admin Billing Interface (`/admin/billing`) is structured into four unified sub-tabs:
1. **Overview & Invoices Tab**: Summary revenue stat cards, active tenant monthly bills list, status filter buttons (`All`, `Pending`, `Paid`, `Overdue`).
2. **Utility Billing Tab**: Sub-meter input forms, 15th-cycle reading table, pro-rata result calculator, batch publishing controls.
3. **Payment Verifications Tab**: Tenant proof-of-payment image inspection modal, approve/reject controls with admin notes.
4. **Reports & Exports Tab**: Revenue breakdown charts, export CSV button, payment collection performance gauges.

---

## 3. UI Resilience & Layout Shift Prevention

- **Skeleton Placeholders**: All billing data tables use `*Skeleton.jsx` components during asynchronous Suspense loading to prevent layout shifts.
- **Modal Scrollbar Locking**: System modal dialogs enforce scrollbar width compensation (`padding-right: var(--scrollbar-width)`) when locking body scroll, preventing jumping text during modal opens.
