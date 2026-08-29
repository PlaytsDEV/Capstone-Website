import { useEffect, useMemo, useRef, useState } from "react";
import { showNotification } from "../../../shared/utils/notification.js";

/* ─────────────────────────────────────────────────────────────────────────────
   Searchable Room Dropdown Component

   Used by the Transfer Room modal's "New Room" field. The modal renders inside
   a `createPortal(..., document.body)` subtree that lives OUTSIDE the React
   root element, so this component keeps its dismiss-on-outside-click behaviour
   on a *native* `document` "mousedown" listener rather than a React synthetic
   handler.

   Selection is committed on `mousedown` (pointer-down), not on a follow-up
   `click`:
     - it fires in the same native event that would otherwise blur the search
       input, so `preventDefault()` there reliably keeps focus and the commit
       happens before any blur / outside-close race, and
     - it does not depend on a second synthetic `click` propagating back
       through the portal.
   The old two-handler split (empty `onMouseDown` + selecting `onClick`) is why
   a pick used to need an extra outside click to settle.
   ───────────────────────────────────────────────────────────────────────────── */
export default function SearchableRoomSelect({
  rooms,
  value,
  onChange,
  disabled,
  placeholder = "Select a room...",
  fmtMoney,
  isInvalid,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const roomLabelOf = (room) =>
    `${room.name || room.roomNumber} (${fmtMoney(room.monthlyPrice || room.price)})`;

  const roomHasAvail = (room) =>
    Array.isArray(room.beds) &&
    room.beds.some(
      (b) => b.status === "available" || (b.status === undefined && b.available !== false),
    );

  const selectedRoom = useMemo(
    () => rooms.find((r) => String(r._id || r.id) === String(value)),
    [rooms, value],
  );

  // The input has two modes:
  //  - CLOSED: it mirrors the selected room's label (or is empty).
  //  - OPEN:   it starts empty so the full room list is shown and the user can
  //            type to filter — a previously-selected label must never linger
  //            as a search query (that made re-picking show "No matching rooms
  //            found").
  // Toggling `isOpen` drives the swap; typing while open is preserved because
  // this effect only runs on an open/close transition, not on every keystroke.
  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
    } else {
      setSearchTerm(selectedRoom ? roomLabelOf(selectedRoom) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, value]);

  // Dismiss-without-selection on an outside pointer-down. Native listener
  // because the modal is portalled outside the React root.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredRooms = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => {
      const name = String(r.name || r.roomNumber || "").toLowerCase();
      const price = String(r.monthlyPrice || r.price || "").toLowerCase();
      const floor = String(r.floor || "").toLowerCase();
      return name.includes(q) || price.includes(q) || floor.includes(q);
    });
  }, [rooms, searchTerm]);

  // Keep the keyboard highlight in range as the filtered list changes.
  useEffect(() => {
    setHighlightIndex((prev) => {
      if (!isOpen || filteredRooms.length === 0) return -1;
      if (prev < 0 || prev >= filteredRooms.length) return 0;
      return prev;
    });
  }, [isOpen, filteredRooms]);

  // Single commit path — pointer OR keyboard both land here.
  const commitSelection = (room) => {
    if (!room) return;
    if (!roomHasAvail(room)) {
      showNotification(
        `Room ${room.name || room.roomNumber} has no available beds.`,
        "warning",
      );
      return;
    }
    // Close first so a later throw in the parent onChange can never strand the
    // dropdown open (that regression is exactly what this fix removes).
    setIsOpen(false);
    setSearchTerm(roomLabelOf(room));
    if (inputRef.current) inputRef.current.blur();
    onChange(String(room._id || room.id));
  };

  const handleInputKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setHighlightIndex((prev) =>
        filteredRooms.length === 0 ? -1 : Math.min(prev + 1, filteredRooms.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((prev) => (prev <= 0 ? 0 : prev - 1));
    } else if (event.key === "Enter") {
      if (isOpen && highlightIndex >= 0 && filteredRooms[highlightIndex]) {
        event.preventDefault();
        commitSelection(filteredRooms[highlightIndex]);
      }
    } else if (event.key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        if (inputRef.current) inputRef.current.blur();
      }
    }
  };

  return (
    <div className="twm-search-select" ref={containerRef}>
      <div className="twm-search-select__input-wrap">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="twm-search-select__listbox"
          aria-autocomplete="list"
          className={`twm-search-select__input ${isInvalid ? "tenant-modal-field--invalid" : ""}`}
          placeholder={
            disabled
              ? "Loading available rooms..."
              : isOpen && selectedRoom
                ? `${roomLabelOf(selectedRoom)} — type to change`
                : placeholder
          }
          value={searchTerm}
          disabled={disabled}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleInputKeyDown}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
        />
        <span className={`twm-search-select__arrow ${isOpen ? "twm-search-select__arrow--open" : ""}`}>
          ▼
        </span>
      </div>

      {isOpen && !disabled && (
        <div
          className="twm-search-select__dropdown"
          id="twm-search-select__listbox"
          role="listbox"
        >
          {filteredRooms.length === 0 ? (
            <div className="twm-search-select__empty">No matching rooms found</div>
          ) : (
            filteredRooms.map((room, index) => {
              const rId = String(room._id || room.id);
              const isSelected = String(value) === rId;
              const isHighlighted = index === highlightIndex;
              const hasAvail = roomHasAvail(room);
              const roomLabel = roomLabelOf(room);

              return (
                <div
                  key={rId}
                  role="option"
                  aria-selected={isSelected}
                  className={`twm-search-select__option ${isSelected ? "twm-search-select__option--selected" : ""} ${isHighlighted ? "twm-search-select__option--highlighted" : ""} ${!hasAvail ? "twm-search-select__option--disabled" : ""}`}
                  // Commit on pointer-down so the selection lands in the same
                  // native event that would blur the input / close the menu —
                  // no follow-up `click` (and no outside click) required.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    commitSelection(room);
                  }}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  <span style={{ fontWeight: isSelected ? 700 : 500 }}>{roomLabel}</span>
                  <span
                    className={`twm-search-select__badge ${
                      hasAvail ? "twm-search-select__badge--avail" : "twm-search-select__badge--full"
                    }`}
                  >
                    {hasAvail ? "Available" : "Full"}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
