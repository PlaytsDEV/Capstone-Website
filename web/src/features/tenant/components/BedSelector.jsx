import React, { useMemo, useCallback } from "react";
import { Check, Lock, Wrench } from "lucide-react";
import "../styles/bed-selector.css";
import { getBedDisplayLabel, groupBedsByBunk } from "../../../shared/utils/bedIdentifier";

/**
 * Visual Bed Selector — minimalist double-deck bunk bed layout (Bunk A, Bunk B... Upper / Lower).
 * Memoized to prevent re-renders when parent modal lease term or move-in date updates.
 */
function BedSelector({ beds = [], selectedBed, onSelect, readOnly = false }) {
  if (!beds.length) return null;

  const { bunks, singleBeds } = useMemo(() => groupBedsByBunk(beds), [beds]);

  const getStatus = useCallback((bed) => {
    if (!bed) return "empty";
    const rawStatus = bed.status || (bed.available === false ? "occupied" : "available");
    return String(rawStatus).toLowerCase().trim();
  }, []);

  const isSelectable = useCallback((bed) => {
    if (readOnly || !bed) return false;
    const status = getStatus(bed);
    return status === "available";
  }, [readOnly, getStatus]);

  const isSelected = useCallback((bed) => Boolean(bed && selectedBed?.id === bed.id), [selectedBed?.id]);

  const handleClick = useCallback((bed, bunkBlock) => {
    if (!isSelectable(bed)) return;
    onSelect?.({
      id: bed.id,
      position: bed.position,
      bunkBlock: bed.bunkBlock || bunkBlock,
      code: bed.code,
    });
  }, [isSelectable, onSelect]);

  const renderBed = (bed, fallbackLabel, indexInRoom = 0, bunkBlock = "A") => {
    if (!bed) return null;
    const status = getStatus(bed);
    const selected = isSelected(bed);
    const selectable = isSelectable(bed);
    const displayLabel = getBedDisplayLabel(bed, indexInRoom);

    return (
      <div
        className={`bs-bed bs-${status} ${selected ? "bs-selected" : ""} ${selectable ? "bs-clickable" : ""}`}
        onClick={() => handleClick(bed, bunkBlock)}
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        onKeyDown={(e) => {
          if (selectable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick(bed, bunkBlock);
          }
        }}
      >
        <div className="bs-bed-content">
          <div className="bs-bed-left">
            <div className={`bs-dot bs-dot-${status}`} />
            <div>
              <div className="bs-label">{displayLabel}</div>
              <div className="bs-id">{bed.code || bed.id}</div>
            </div>
          </div>
          <div className="bs-badge" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            {selected ? (
              <>
                <Check size={13} strokeWidth={2.5} /> Selected
              </>
            ) : status === "occupied" ? (
              "Occupied"
            ) : status === "reserved" ? (
              <>
                <Lock size={12} strokeWidth={2} /> Reserved
              </>
            ) : status === "locked" ? (
              <>
                <Lock size={12} strokeWidth={2} /> Payment Pending
              </>
            ) : status === "maintenance" ? (
              <>
                <Wrench size={12} strokeWidth={2} /> Maint
              </>
            ) : (
              "Available"
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bed-selector">
      <div className="bs-header">
        <h4 className="bs-title">Select Your Bed</h4>
        <div className="bs-legend">
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-avail" />Available</span>
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-occ" />Occupied</span>
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-resv" />Reserved</span>
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-lock" />Payment Pending</span>
        </div>
      </div>

      <div className="bs-bunks">
        {bunks.map((bunk, i) => (
          <div key={`bunk-${bunk.bunkBlock || i}`} className="bs-frame">
            <div className="bs-frame-label">{bunk.bunkLabel}</div>
            <div className="bs-tier">
              {renderBed(bunk.upper, "Upper", i * 2, bunk.bunkBlock)}
            </div>
            <div className="bs-divider" />
            <div className="bs-tier">
              {renderBed(bunk.lower, "Lower", i * 2 + 1, bunk.bunkBlock)}
            </div>
          </div>
        ))}

        {singleBeds.map((bed, i) => (
          <div key={bed.id} className="bs-frame bs-frame-single">
            <div className="bs-tier">
              {renderBed(bed, "Single", i)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default React.memo(BedSelector);
