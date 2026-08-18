import React, { useMemo, useCallback } from "react";
import { Check, Lock, Wrench } from "lucide-react";
import "../styles/bed-selector.css";
import { getBedDisplayLabel, groupBedsByBunk } from "../../../shared/utils/bedIdentifier";

/**
 * Visual Bed Selector — minimalist double-deck bunk bed layout (Bunk A, Bunk B... Upper / Lower).
 * Memoized to prevent re-renders when parent modal lease term or move-in date updates.
 */
function BedSelector({ beds = [], selectedBed, onSelect, readOnly = false }) {
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

  const isSelected = useCallback((bed) => {
    if (!bed || !selectedBed) return false;

    // String selectedBed check
    if (typeof selectedBed === "string") {
      const norm = selectedBed.trim().toLowerCase();
      if (!norm) return false;
      return Boolean(
        (bed.id && String(bed.id).toLowerCase() === norm) ||
        (bed.code && String(bed.code).toLowerCase() === norm) ||
        (bed._id && String(bed._id).toLowerCase() === norm)
      );
    }

    // Object selectedBed check: strictly compare non-empty identifiers
    const selId = selectedBed.id || selectedBed._id;
    const bedId = bed.id || bed._id;
    if (selId && bedId && String(selId).trim() === String(bedId).trim()) {
      return true;
    }

    const selCode = selectedBed.code;
    const bedCode = bed.code;
    if (selCode && bedCode && String(selCode).trim().toLowerCase() === String(bedCode).trim().toLowerCase()) {
      return true;
    }

    // Compare bunkBlock and position if both are explicitly present
    const selBlock = selectedBed.bunkBlock || selectedBed.bunk;
    const bedBlock = bed.bunkBlock || bed.bunk;
    const selPos = selectedBed.position;
    const bedPos = bed.position;

    if (
      selBlock && bedBlock &&
      selPos && bedPos &&
      String(selBlock).trim().toUpperCase() === String(bedBlock).trim().toUpperCase() &&
      String(selPos).trim().toLowerCase() === String(bedPos).trim().toLowerCase()
    ) {
      return true;
    }

    return false;
  }, [selectedBed]);

  const handleClick = useCallback((bed, bunkBlock) => {
    if (!isSelectable(bed)) return;
    const resolvedBlock = bed.bunkBlock || bunkBlock || "A";
    const resolvedPos = bed.position || "upper";
    const resolvedCode = bed.code || `${resolvedBlock}-${resolvedPos === "upper" ? "U" : resolvedPos === "lower" ? "L" : "S"}`;
    const resolvedId = String(bed.id || bed._id || resolvedCode);

    onSelect?.({
      ...bed,
      id: resolvedId,
      position: resolvedPos,
      bunkBlock: resolvedBlock,
      code: resolvedCode,
      status: getStatus(bed),
    });
  }, [isSelectable, onSelect, getStatus]);

  const hasAvailableBeds = useMemo(() => {
    return (
      bunks.some((b) => isSelectable(b?.upper) || isSelectable(b?.lower)) ||
      singleBeds.some((b) => isSelectable(b))
    );
  }, [bunks, singleBeds, isSelectable]);

  if (!bunks.length && !singleBeds.length) return null;

  const renderBed = (bed, fallbackLabel, indexInRoom = 0, bunkBlock = "A") => {
    if (!bed) return null;
    const rawStatus = getStatus(bed);
    // User-side normalization: internal locks and maintenance are presented as Reserved
    const status = rawStatus === "locked" || rawStatus === "maintenance" ? "reserved" : rawStatus;
    const resolvedBlock = bed.bunkBlock || bunkBlock || "A";
    const resolvedPos = bed.position || (fallbackLabel === "Upper" ? "upper" : fallbackLabel === "Lower" ? "lower" : "single");
    const resolvedCode = bed.code || `${resolvedBlock}-${resolvedPos === "upper" ? "U" : resolvedPos === "lower" ? "L" : "S"}`;
    const resolvedId = String(bed.id || bed._id || resolvedCode);
    const effectiveBed = {
      ...bed,
      id: resolvedId,
      code: resolvedCode,
      position: resolvedPos,
      bunkBlock: resolvedBlock,
      status,
    };
    const selected = isSelected(effectiveBed);
    const selectable = isSelectable(effectiveBed);
    const displayLabel = getBedDisplayLabel(effectiveBed, indexInRoom);

    return (
      <div
        key={resolvedId || `${bunkBlock}-${resolvedPos}-${indexInRoom}`}
        className={`bs-bed bs-${status} ${selected ? "bs-selected" : ""} ${selectable ? "bs-clickable" : ""}`}
        onClick={() => handleClick(effectiveBed, bunkBlock)}
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : -1}
        aria-selected={selected}
        aria-disabled={!selectable}
        onKeyDown={(e) => {
          if (selectable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            handleClick(effectiveBed, bunkBlock);
          }
        }}
      >
        <div className="bs-bed-content">
          <div className="bs-bed-left">
            <div className={`bs-dot ${selected ? "bs-dot-selected" : `bs-dot-${status}`}`} />
            <div>
              <div className="bs-label">{displayLabel}</div>
              <div className="bs-id">{resolvedCode}</div>
            </div>
          </div>
          <div className="bs-badge">
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
        <h4 className="bs-title">Preferred Bed Location</h4>
        <div className="bs-legend">
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-avail" />Available</span>
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-occ" />Occupied</span>
          <span className="bs-legend-item"><span className="bs-legend-dot bs-legend-resv" />Reserved</span>
        </div>
      </div>

      {!hasAvailableBeds && (
        <div className="bs-no-avail-msg">
          All beds in this room are currently booked or reserved.
        </div>
      )}

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
          <div key={bed.id || `single-${i}`} className="bs-frame bs-frame-single">
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
