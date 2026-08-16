import React from "react";
import AdminTabs from "../../../../shared/components/AdminTabs";

/**
 * PageShell — Consistent 3-region layout for every admin page.
 *
 * Usage:
 * <PageShell tabs={[...]} activeTab={tab} onTabChange={setTab}>
 * <PageShell.Summary> <SummaryBar ... /> </PageShell.Summary>
 * <PageShell.Actions> <ActionBar ... /> </PageShell.Actions>
 * <PageShell.Content> <DataTable ... /> </PageShell.Content>
 * </PageShell>
 */

function PageShell({ children, tabs, activeTab, onTabChange }) {
 const slots = { summary: null, actions: null, content: null };
 const extras = [];

 React.Children.forEach(children, (child) => {
 if (!React.isValidElement(child)) {
 if (child != null && child !== false) extras.push(child);
 return;
 }
 if (child.type === Summary) slots.summary = child;
 else if (child.type === Actions) slots.actions = child;
 else if (child.type === Content) slots.content = child;
 else extras.push(child);
 });

 // Only render slot wrappers if they have real (non-boolean/null) children
 const hasSlot = (slot) =>
 slot && React.Children.toArray(slot.props.children).length > 0;

 return (
 <div className="flex flex-col gap-6 pb-8">
      {/* Tabs — Unified Underline Navigation Standard */}
      {tabs && tabs.length > 0 && (
        <AdminTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          ariaLabel="Workspace sections"
        />
      )}

 {/* Summary row — only renders if slot has actual content */}
 {hasSlot(slots.summary) && (
 <div>{slots.summary}</div>
 )}

 {/* Actions row — only renders if slot has actual content */}
 {hasSlot(slots.actions) && (
 <div>{slots.actions}</div>
 )}

 {/* Content area */}
 {slots.content && (
 <div>{slots.content}</div>
 )}

 {extras}
 </div>
 );
}

/* ── Slot components ── */
function Summary({ children }) { return <>{children}</>; }
function Actions({ children }) { return <>{children}</>; }
function Content({ children }) { return <>{children}</>; }

PageShell.Summary = Summary;
PageShell.Actions = Actions;
PageShell.Content = Content;

export default PageShell;
