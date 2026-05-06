const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)$/i;
const PDF_FILE_PATTERN = /\.pdf$/i;

const toText = (value) =>
  typeof value === "string" ? value.trim() : "";

export const getMaintenanceAttachmentName = (attachment, index = 0) =>
  toText(attachment?.name) || `Attachment ${index + 1}`;

export const getMaintenanceAttachmentType = (attachment) => {
  const explicitType = toText(attachment?.type).toLowerCase();
  if (explicitType) return explicitType;

  const source = `${getMaintenanceAttachmentName(attachment)} ${toText(attachment?.uri)}`.toLowerCase();

  if (PDF_FILE_PATTERN.test(source)) return "application/pdf";
  if (IMAGE_FILE_PATTERN.test(source)) return "image/*";
  return "application/octet-stream";
};

export const isMaintenanceImageAttachment = (attachment) =>
  getMaintenanceAttachmentType(attachment).startsWith("image/");

export const isMaintenancePdfAttachment = (attachment) =>
  getMaintenanceAttachmentType(attachment) === "application/pdf";

export const getMaintenanceAttachmentKind = (attachment) => {
  if (isMaintenanceImageAttachment(attachment)) return "image";
  if (isMaintenancePdfAttachment(attachment)) return "pdf";
  return "file";
};

export const getMaintenanceAttachmentLabel = (attachment) => {
  const kind = getMaintenanceAttachmentKind(attachment);

  if (kind === "image") return "Image";
  if (kind === "pdf") return "PDF";
  return "File";
};
