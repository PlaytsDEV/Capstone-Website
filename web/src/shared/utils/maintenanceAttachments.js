const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i;
const PDF_FILE_PATTERN = /\.pdf(?:$|[?#])/i;

const toText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getAttachmentUriCandidates = (attachment) => [
  attachment?.uri,
  attachment?.url,
  attachment?.href,
  attachment?.src,
  attachment?.imageUrl,
  attachment?.imageURL,
  attachment?.image_url,
  attachment?.fileUrl,
  attachment?.fileURL,
  attachment?.file_url,
  attachment?.downloadUrl,
  attachment?.downloadURL,
  attachment?.download_url,
  attachment?.publicUrl,
  attachment?.publicURL,
  attachment?.public_url,
  attachment?.secureUrl,
  attachment?.secureURL,
  attachment?.secure_url,
  attachment?.mediaUrl,
  attachment?.mediaURL,
  attachment?.media_url,
  attachment?.path,
];

const pickFirstText = (...values) => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return "";
};

const getFilenameFromUri = (uri, fallback = "Attachment") => {
  const source = toText(uri);
  if (!source) return fallback;

  try {
    const parsed = new URL(
      source,
      typeof window !== "undefined" ? window.location.origin : "https://placeholder.local",
    );
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return pickFirstText(segment ? decodeURIComponent(segment) : "", fallback);
  } catch {
    const segment = source.split(/[/?#]/).filter(Boolean).pop();
    return pickFirstText(segment, fallback);
  }
};

export const getMaintenanceAttachmentUri = (attachment) => {
  if (typeof attachment === "string") {
    return toText(attachment);
  }

  return pickFirstText(...getAttachmentUriCandidates(attachment));
};

export const getMaintenanceAttachmentName = (attachment, index = 0) =>
  pickFirstText(
    attachment?.name,
    attachment?.filename,
    attachment?.fileName,
    attachment?.originalName,
    attachment?.originalFilename,
    attachment?.label,
    attachment?.title,
    getFilenameFromUri(getMaintenanceAttachmentUri(attachment), `Attachment ${index + 1}`),
  );

export const getMaintenanceAttachmentType = (attachment) => {
  const explicitType = pickFirstText(
    attachment?.type,
    attachment?.mimeType,
    attachment?.mime,
    attachment?.contentType,
  ).toLowerCase();
  if (explicitType) return explicitType;

  const source = `${getMaintenanceAttachmentName(attachment)} ${getMaintenanceAttachmentUri(attachment)}`.toLowerCase();

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

export const normalizeMaintenanceAttachment = (attachment, index = 0) => {
  const uri = getMaintenanceAttachmentUri(attachment);
  if (!uri) return null;

  return {
    name: getMaintenanceAttachmentName(attachment, index),
    uri,
    type: getMaintenanceAttachmentType(attachment),
  };
};

export const normalizeMaintenanceAttachments = (attachments) =>
  Array.isArray(attachments)
    ? attachments
        .map((attachment, index) => normalizeMaintenanceAttachment(attachment, index))
        .filter(Boolean)
    : [];
