import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";

export default function AdminChatLightboxModal({
  imageModal,
  onClose,
}) {
  if (!imageModal) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-w-4xl max-h-[90vh] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close & Action Toolbar */}
        <div className="w-full flex items-center justify-between gap-3 text-white pb-2 px-1">
          <p className="text-xs text-white/90 font-medium truncate max-w-md">
            {imageModal.name || imageModal.fileName || "Photo Preview"}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href={imageModal.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={imageModal.name || "photo"}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-xs font-semibold backdrop-blur-sm transition-colors text-white cursor-pointer"
              title="Download original photo"
            >
              <Download size={13} />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm transition-colors cursor-pointer"
              title="Close preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <img
          src={imageModal.objectUrl}
          alt={imageModal.name || "Full Preview"}
          className="max-w-full max-h-[80vh] rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
        />
      </div>
    </div>,
    document.body,
  );
}
