import React from "react";

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
      {/* Tabs — Premium Light Mode Segmented Control */}
      {tabs && tabs.length > 0 && (
        <div
          className="inline-flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-100 border border-slate-200/80 overflow-x-auto max-w-full self-start"
          role="tablist"
          aria-label="Workspace sections"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                id={`page-shell-tab-${tab.key}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={`page-shell-panel-${tab.key}`}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-150 select-none whitespace-nowrap ${
                  isActive
                    ? "bg-white text-[#0A1628] border border-slate-300/80 shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border border-transparent"
                }`}
                onClick={() => onTabChange?.(tab.key)}
              >
                {tab.icon && (
                  <tab.icon
                    size={15}
                    className={isActive ? "text-[#0A1628]" : "text-slate-400"}
                  />
                )}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
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
