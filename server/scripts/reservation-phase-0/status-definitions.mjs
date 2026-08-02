import Reservation from "../../models/Reservation.js";
import { ALLOWED_RESERVATION_STATUS_TRANSITIONS as BACKEND_TRANSITIONS, CANONICAL_RESERVATION_STATUSES as BACKEND_STATUSES } from "../../utils/lifecycleNaming.js";
import { ALLOWED_RESERVATION_STATUS_TRANSITIONS as FRONTEND_TRANSITIONS, CANONICAL_RESERVATION_STATUSES as FRONTEND_STATUSES } from "../../../web/src/shared/utils/lifecycleNaming.js";

const difference = (left, right) => left.filter((value) => !right.includes(value)).sort();

export function inspectStatusDefinitions() {
  const schemaStatuses = [...(Reservation.schema.path("status")?.enumValues || [])];
  const transitionMismatches = [];
  for (const status of [...new Set([...BACKEND_STATUSES, ...FRONTEND_STATUSES])].sort()) {
    const backend = [...(BACKEND_TRANSITIONS[status] || [])].sort();
    const frontend = [...(FRONTEND_TRANSITIONS[status] || [])].sort();
    if (JSON.stringify(backend) !== JSON.stringify(frontend)) transitionMismatches.push({ status, backend, frontend, backendOnly: difference(backend, frontend), frontendOnly: difference(frontend, backend) });
  }
  return {
    backendStatuses: [...BACKEND_STATUSES], frontendStatuses: [...FRONTEND_STATUSES], schemaStatuses,
    backendOnlyStatuses: difference([...BACKEND_STATUSES], [...FRONTEND_STATUSES]),
    frontendOnlyStatuses: difference([...FRONTEND_STATUSES], [...BACKEND_STATUSES]),
    schemaOnlyStatuses: difference(schemaStatuses, [...BACKEND_STATUSES]),
    backendMissingFromSchema: difference([...BACKEND_STATUSES], schemaStatuses),
    transitionMismatches,
  };
}
