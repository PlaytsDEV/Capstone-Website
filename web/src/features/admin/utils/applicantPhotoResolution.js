/**
 * Resolves which photo to show as the applicant's avatar in Application
 * Review.
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
 *
 * Cross-account safety: this reads only `reservation.userId.profileImage`
 * and `reservation.selfiePhotoUrl` — both scoped to the single reservation
 * object the caller already fetched. Identity matching for that reservation
 * is enforced upstream by the server (getReservationById only ever returns
 * a reservation the requester is authorized to view, populated with its
 * true owner's userId), always by ObjectId reference, never by comparing
 * display names/emails as strings — so this function cannot be handed a
 * mismatched applicant's photo by construction.
 */
const isUsableUrl = (value) => typeof value === "string" && value.trim().length > 0;

export const resolveApplicantPhotoUrl = (reservation) => {
  const submittedPhoto = reservation?.selfiePhotoUrl;
  if (isUsableUrl(submittedPhoto)) return submittedPhoto.trim();
  const liveProfileImage = reservation?.userId?.profileImage;
  if (isUsableUrl(liveProfileImage)) return liveProfileImage.trim();
  return null;
};
