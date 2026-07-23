import { useState } from "react";
import { Clock3, FileText, Image as ImageIcon, Paperclip } from "lucide-react";
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
    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted text-muted-foreground">
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
    <div className="mt-3 grid gap-3">
      {attachments.map((attachment, attachmentIndex) => {
        const attachmentUri = getMaintenanceAttachmentUri(attachment);
        const isViewable = isRemoteUri(attachmentUri) && !removed;
        const attachmentName = getMaintenanceAttachmentName(attachment, attachmentIndex);
        const key = `${attachment.id || attachmentUri || attachmentName}-${attachmentIndex}`;
        const content = (
          <>
            <AttachmentThumbnail attachment={attachment} index={attachmentIndex} />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-card-foreground">
                {attachmentName}
              </span>
              <span className={removed ? "text-xs text-rose-600" : "text-xs text-muted-foreground"}>
                {removed ? "Attachment removed" : getMaintenanceAttachmentLabel(attachment)}
              </span>
            </div>
          </>
        );

        return (
          <div
            key={key}
            className={`flex items-center gap-3 rounded-lg border border-border bg-card p-3 ${removed ? "opacity-70" : ""}`}
          >
            {isViewable ? (
              <a
                href={attachmentUri}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90"
              >
                {content}
              </a>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
            )}
            {canRemove && !removed ? (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-rose-600 hover:text-rose-700"
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
  if (!items.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock3 size={16} />
        No timeline entries recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.key}
          className="rounded-lg border border-border bg-card p-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <strong className="block text-sm font-semibold text-card-foreground">
                {item.title}
              </strong>
              <span className="mt-1 block text-xs text-muted-foreground">
                {fmtDateTime(item.timestamp)}
                {item.meta ? ` - ${item.meta}` : ""}
              </span>
            </div>
            <SectionBadge tone={item.visibility === "tenant" ? "blue" : "amber"}>
              {getTimelineVisibility(item)}
            </SectionBadge>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {item.actorPrefix || "Updated by"}: {buildTimelineActor({
              role: item.actorRole,
              name: item.actorName,
              fallback: "Unknown admin",
            })}
          </div>
          {item.message ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {item.type === "attachment_removed" ? `Reason: ${item.message}` : item.message}
            </p>
          ) : null}
          {item.attachmentName ? (
            <p className="mt-2 text-sm text-muted-foreground">File: {item.attachmentName}</p>
          ) : null}
          {item.branch ? (
            <p className="mt-2 text-sm text-muted-foreground">Branch: {formatBranchLabel(item.branch)}</p>
          ) : null}
          {item.providerName ? (
            <p className="mt-2 text-sm text-muted-foreground">Provider: {item.providerName}</p>
          ) : null}
          {item.previousProviderName ? (
            <p className="mt-1 text-sm text-muted-foreground">Previous provider: {item.previousProviderName}</p>
          ) : null}
          <TimelineAttachmentList
            attachments={item.attachments}
            targets={item.attachmentTargets}
            onRemove={onRemoveAttachment}
            canRemove={canRemoveAttachments}
            removed={item.removed}
          />
        </article>
      ))}
    </div>
  );
}
