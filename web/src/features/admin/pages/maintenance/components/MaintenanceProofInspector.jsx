import { useState } from "react";
import { CheckCircle2, Eye, FileImage, Image as ImageIcon, ShieldCheck, X } from "lucide-react";
import { getMaintenanceAttachmentUri, getMaintenanceAttachmentName } from "../maintenanceUtils";

export function MaintenanceProofInspector({ request }) {
  const [activeImage, setActiveImage] = useState(null);

  const initialAttachments = Array.isArray(request?.attachments)
    ? request.attachments.filter((att) => !att?.isRemoved)
    : [];

  const workLogAttachments = Array.isArray(request?.work_log)
    ? request.work_log.flatMap((log) =>
        Array.isArray(log?.attachments)
          ? log.attachments.filter((att) => !att?.isRemoved)
          : [],
      )
    : [];

  const hasAnyAttachments = initialAttachments.length > 0 || workLogAttachments.length > 0;

  if (!hasAnyAttachments) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-card-foreground">
            Repair Quality & Proof Verification
          </h3>
        </div>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Inspection View
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Issue / Before Photos */}
        <div className="rounded-lg border border-border bg-muted/20 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Reported Issue ({initialAttachments.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Initial Submission</span>
          </div>

          {initialAttachments.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              No initial photos provided
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {initialAttachments.map((att, idx) => {
                const uri = getMaintenanceAttachmentUri(att);
                const name = getMaintenanceAttachmentName(att) || `Photo ${idx + 1}`;
                const isImg = !uri.endsWith(".pdf");

                return (
                  <div
                    key={idx}
                    onClick={() => uri && setActiveImage({ uri, name, label: "Initial Issue Photo" })}
                    className="group relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-card transition hover:border-primary"
                  >
                    {isImg && uri ? (
                      <img
                        src={uri}
                        alt={name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <FileImage size={24} />
                        <span className="max-w-[100px] truncate text-[11px]">{name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <Eye size={18} className="text-white" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completion / After Proof */}
        <div className="rounded-lg border border-border bg-muted/20 p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Resolution Proof ({workLogAttachments.length})
            </span>
            <span className="text-[11px] text-muted-foreground">Work Log & Sign-Off</span>
          </div>

          {workLogAttachments.length === 0 ? (
            <div className="flex h-28 items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
              No completion proof uploaded yet
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {workLogAttachments.map((att, idx) => {
                const uri = getMaintenanceAttachmentUri(att);
                const name = getMaintenanceAttachmentName(att) || `Proof ${idx + 1}`;
                const isImg = !uri.endsWith(".pdf");

                return (
                  <div
                    key={idx}
                    onClick={() => uri && setActiveImage({ uri, name, label: "Resolution Proof Photo" })}
                    className="group relative flex h-28 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-card transition hover:border-emerald-600"
                  >
                    {isImg && uri ? (
                      <img
                        src={uri}
                        alt={name}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={24} />
                        <span className="max-w-[100px] truncate text-[11px]">{name}</span>
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <Eye size={18} className="text-white" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {activeImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setActiveImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-3xl overflow-hidden rounded-xl border border-border bg-card p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                  {activeImage.label}
                </span>
                <p className="text-sm font-medium text-card-foreground">{activeImage.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveImage(null)}
                className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-lg bg-black/10">
              <img
                src={activeImage.uri}
                alt={activeImage.name}
                className="max-h-full max-w-full rounded-md object-contain"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
