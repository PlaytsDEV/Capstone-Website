/**
 * Resolves which photo to show as the applicant's avatar in Application
 * Review, and which reservation the applicant belongs to.
 *
 * Authoritative source order (see PR notes / task spec):
 *  1. The applicant's CURRENT live profile photo (User.profileImage) —
 *     reflects the most recent photo the applicant has on file, even if
 *     they update it after submitting this application.
 *  2. The photo submitted WITH this specific application
 *     (Reservation.selfiePhotoUrl) — an application-time snapshot, used
 *     only when no live profile photo exists yet.
 *  3. null — caller must render a safe initials/fallback avatar, never a
 *     broken-image icon.
 */
const isUsableUrl = (value) => typeof value === "string" && value.trim().length > 0;

export const resolveApplicantPhotoUrl = (reservation) => {
  const liveProfileImage = reservation?.userId?.profileImage;
  if (isUsableUrl(liveProfileImage)) return liveProfileImage.trim();
  const submittedPhoto = reservation?.selfiePhotoUrl;
  if (isUsableUrl(submittedPhoto)) return submittedPhoto.trim();
  return null;
};

/**
 * True identity match is always by the reservation's userId ObjectId
 * reference — never by comparing display names/emails as strings. This
 * guards against ever accidentally showing one applicant's photo/profile
 * on another applicant's reservation record due to a name collision.
 */
export const isReservationOwnedByUser = (reservation, userId) => {
  if (!reservation || !userId) return false;
  const ownerId = reservation.userId?._id || reservation.userId;
  return String(ownerId || "") === String(userId);
};
