import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Clock3, FileText, Image as ImageIcon, Loader2, Paperclip } from "lucide-react";
import {
  buildTimelineActor,
  fmtDateTime,
  formatBranchLabel,
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentLabel,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentUri,
  getTimelineVisibility,
  isRemoteUri,
} from "../maintenanceUtils";
import { SectionBadge } from "./SectionBadge";

const TIMELINE_PAGE_SIZE = 5;

export function AttachmentThumbnail({ attachment, index }) {
  const [failed, setFailed] = useState(false);
  const kind = getMaintenanceAttachmentKind(attachment);
  const name = getMaintenanceAttachmentName(attachment, index);
  const uri = getMaintenanceAttachmentUri(attachment);

  if (kind === "image" && !failed && isRemoteUri(uri)) {
    return (
      <img
        src={uri}
        alt={name}
        className="h-12 w-12 rounded-md object-cover"
        onError={() => setFailed(true)}
      />
    );
  }

  const Icon =
    kind === "pdf" ? FileText : kind === "image" ? ImageIcon : Paperclip;

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
      <Icon size={18} />
    </div>
  );
}

export function TimelineAttachmentList({
  attachments = [],
  targets = [],
  onRemove,
  canRemove = false,
  removed = false,
}) {
  if (!attachments.length) return null;

  return (
    <div className="mt-2.5 grid gap-2">
      {attachments.map((attachment, attachmentIndex) => {
        const attachmentUri = getMaintenanceAttachmentUri(attachment);
        const isViewable = isRemoteUri(attachmentUri) && !removed;
        const attachmentName = getMaintenanceAttachmentName(attachment, attachmentIndex);
        const key = `${attachment.id || attachmentUri || attachmentName}-${attachmentIndex}`;
        const content = (
          <>
            <AttachmentThumbnail attachment={attachment} index={attachmentIndex} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {attachmentName}
              </span>
              <span className={removed ? "text-[11px] text-rose-600" : "text-[11px] text-slate-500"}>
                {removed ? "Attachment removed" : getMaintenanceAttachmentLabel(attachment)}
              </span>
            </div>
          </>
        );

        return (
          <div
            key={key}
            className={`flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5 ${removed ? "opacity-70" : ""}`}
          >
            {isViewable ? (
              <a
                href={attachmentUri}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-2.5 hover:opacity-90 transition"
              >
                {content}
              </a>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">{content}</div>
            )}
            {canRemove && !removed ? (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer"
                onClick={() => onRemove?.(targets[attachmentIndex])}
              >
                Remove Attachment
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function MaintenanceTimeline({
  items = [],
  onRemoveAttachment,
  canRemoveAttachments = false,
}) {
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const sentinelRef = useRef(null);

  // Reset pagination when the underlying items collection changes
  useEffect(() => {
    setVisibleCount(Math.min(items.length, TIMELINE_PAGE_SIZE));
    setIsLoadingMore(false);
  }, [items]);

  const loadMoreItems = useCallback(() => {
    if (visibleCount >= items.length || isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(items.length, prev + TIMELINE_PAGE_SIZE));
      setIsLoadingMore(false);
    }, 350);
  }, [visibleCount, items.length, isLoadingMore]);

  // Infinite scroll trigger via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreItems();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreItems]);

  if (!items.length) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
        <Clock3 size={14} />
        No timeline entries recorded yet.
      </div>
    );
  }

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return (
    <div className="space-y-3">
      {visibleItems.map((item) => (
        <article
          key={item.key}
          className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-sm space-y-2"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <strong className="block text-xs font-bold text-slate-900 dark:text-slate-100">
                {item.title}
              </strong>
              <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                {fmtDateTime(item.timestamp)}
                {item.meta ? ` - ${item.meta}` : ""}
              </span>
            </div>
            <SectionBadge tone={item.visibility === "tenant" ? "blue" : "amber"}>
              {getTimelineVisibility(item)}
            </SectionBadge>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {item.actorPrefix || "Updated by"}:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {buildTimelineActor({
                role: item.actorRole,
                name: item.actorName,
                fallback: "Unknown admin",
              })}
            </span>
          </div>

          {item.message && (
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50/70 dark:bg-slate-800/40 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
              {item.type === "attachment_removed" ? `Reason: ${item.message}` : item.message}
            </p>
          )}

          {item.attachmentName && (
            <p className="text-xs text-slate-500">File: {item.attachmentName}</p>
          )}
          {item.branch && (
            <p className="text-xs text-slate-500">Branch: {formatBranchLabel(item.branch)}</p>
          )}
          {item.providerName && (
            <p className="text-xs text-slate-500">Provider: {item.providerName}</p>
          )}
          {item.previousProviderName && (
            <p className="text-[11px] text-slate-400">Previous provider: {item.previousProviderName}</p>
          )}

          <TimelineAttachmentList
            attachments={item.attachments}
            targets={item.attachmentTargets}
            onRemove={onRemoveAttachment}
            canRemove={canRemoveAttachments}
            removed={item.removed}
          />
        </article>
      ))}

      {/* Loading Skeleton Indicator when fetching more items */}
      {isLoadingMore && (
        <div className="rounded-xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30 p-3.5 space-y-2 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded" />
            <div className="h-4 w-16 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>
          <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          <div className="h-10 bg-slate-200/60 dark:bg-slate-700/60 rounded" />
        </div>
      )}

      {/* Sentinel trigger element for infinite scroll */}
      <div ref={sentinelRef} className="h-2 w-full" />

      {/* Footer Progress & Load More Trigger */}
      <div className="flex items-center justify-between pt-1 text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
        <span>
          Showing {visibleItems.length} of {items.length} events
        </span>

        {hasMore ? (
          <button
            type="button"
            onClick={loadMoreItems}
            disabled={isLoadingMore}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
          >
            {isLoadingMore ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                <span>Loading more events...</span>
              </>
            ) : (
              <span>Load older activity (+{Math.min(TIMELINE_PAGE_SIZE, items.length - visibleCount)})</span>
            )}
          </button>
        ) : items.length > TIMELINE_PAGE_SIZE ? (
          <span className="inline-flex items-center gap-1 text-slate-400">
            <Check size={11} className="text-emerald-500" />
            All events loaded
          </span>
        ) : null}
      </div>
    </div>
  );
}
