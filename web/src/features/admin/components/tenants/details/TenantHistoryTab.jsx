import { History, FileText, Eye } from "lucide-react";

export default function TenantHistoryTab({
  tenant,
  roomHistory = [],
  dedicatedContract,
  onOpenDigitalContract,
}) {
  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-4 shadow-2xs">
        <div className="flex justify-between items-center pb-2 border-b border-border/40">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wide">
            <History className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Room Stay Timeline ({roomHistory.length})
          </h4>
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 bg-muted/40 px-2 py-0.5 rounded border border-border/50">
            {roomHistory.filter((c) => c.status === "current" || !c.moveOutDate).length} Current ·{" "}
            {roomHistory.filter((c) => c.status !== "current" && c.moveOutDate).length} Past
          </span>
        </div>

        {roomHistory.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            No room stay records available for this tenant.
          </div>
        ) : (
          <div className="stay-timeline">
            {roomHistory.map((room, idx) => {
              const isCurrent = room.status === "current" || !room.moveOutDate;
              const isLast = idx === roomHistory.length - 1;
              const moveIn = (() => {
                if (!room.moveInDate) return null;
                try {
                  return new Date(room.moveInDate).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return room.moveInDate;
                }
              })();
              const moveOut = (() => {
                if (!room.moveOutDate) return null;
                try {
                  return new Date(room.moveOutDate).toLocaleDateString("en-PH", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  });
                } catch {
                  return room.moveOutDate;
                }
              })();
              const stayContract =
                room.contract || (isCurrent ? dedicatedContract : null);

              return (
                <div
                  key={room.id || room._id || idx}
                  className="stay-timeline__entry"
                >
                  <div className="stay-timeline__left">
                    <div
                      className={`stay-timeline__dot ${
                        isCurrent
                          ? "stay-timeline__dot--current"
                          : "stay-timeline__dot--past"
                      }`}
                    />
                    {!isLast && <div className="stay-timeline__connector" />}
                  </div>
                  <div className="stay-timeline__body">
                    <div className="stay-timeline__header">
                      <span className="stay-timeline__room">
                        {room.branch ? `${room.branch} — ` : ""}
                        {room.room || room.roomName || "Unknown Room"}
                        {room.bed ? ` — ${room.bed}` : ""}
                      </span>
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-transparent text-emerald-700 dark:text-emerald-400 border border-slate-200 dark:border-slate-700">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Current
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-transparent text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Past Stay
                        </span>
                      )}
                    </div>

                    <div className="stay-timeline__meta text-muted-foreground text-xs space-y-0.5 mt-1">
                      <div>
                        Bed:{" "}
                        <span className="text-foreground capitalize font-medium">
                          {room.bed || tenant.bed || "N/A"}
                        </span>{" "}
                        • Move-in Date: {moveIn || tenant.moveInDate || tenant.moveIn || "N/A"}
                        {moveOut
                          ? ` — Move-out Date: ${moveOut}`
                          : isCurrent
                          ? " — Active"
                          : ""}
                      </div>
                    </div>

                    {/* Contract Proof for this Stay */}
                    {stayContract && (
                      <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs bg-muted/20 p-2.5 rounded-lg">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {isCurrent ? "Current Lease Contract" : "Contract"}:{" "}
                            <strong className="text-foreground font-mono">
                              {stayContract.contractNumber || "Pending"}
                            </strong>
                          </span>
                          {(stayContract.purpose === "amendment" || stayContract.purpose === "replacement") && (
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold px-1.5 py-0.5 rounded flex-shrink-0">
                              {stayContract.purpose === "amendment" ? "Room Transfer Addendum" : "Transfer Replacement (legacy)"}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-[#0A1628] hover:text-[#13243D] dark:text-sky-400 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            onClick={() =>
                              onOpenDigitalContract &&
                              onOpenDigitalContract(stayContract)
                            }
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View Digital Contract</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
