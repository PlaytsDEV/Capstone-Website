/**
 * Admin formatting utilities — now re-exports from shared/utils/formatDate.js
 * Kept for backward compatibility so existing admin imports don't break.
 */
export {
 formatDate,
 fmtDate,
 fmtMonth,
 formatDateTime,
 fmtDateTime,
 formatTime,
 formatTimestamp,
 fmtTimestamp,
 getRelativeTime,
 fmtCurrency,
 formatBranch,
 formatRoomType,
} from "../../../shared/utils/formatDate.js";

export { getReservationStatusLabel } from "../../../shared/utils/lifecycleNaming.js";

/** Admin-specific: formatRelativeTime alias using same logic */
export { getRelativeTime as formatRelativeTime } from "../../../shared/utils/formatDate.js";
