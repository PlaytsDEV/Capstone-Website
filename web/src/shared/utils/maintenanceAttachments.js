const IMAGE_FILE_PATTERN = /\.(avif|bmp|gif|heic|jpeg|jpg|png|svg|webp)(?:$|[?#])/i;
const PDF_FILE_PATTERN = /\.pdf(?:$|[?#])/i;

const toText = (value) =>
  typeof value === "string" ? value.trim() : "";

const getAttachmentUriCandidates = (attachment) => [
  attachment?.url,
  attachment?.downloadUrl,
  attachment?.downloadURL,
  attachment?.download_url,
  attachment?.publicUrl,
  attachment?.publicURL,
  attachment?.public_url,
  attachment?.secureUrl,
  attachment?.secureURL,
  attachment?.secure_url,
  attachment?.uri,
  attachment?.href,
  attachment?.src,
  attachment?.imageUrl,
  attachment?.imageURL,
  attachment?.image_url,
  attachment?.fileUrl,
  attachment?.fileURL,
  attachment?.file_url,
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

const isLocalHostName = (hostname = "") => {
  const value = String(hostname || "").toLowerCase();
  return value === "localhost" || value === "127.0.0.1" || value === "::1" || value === "[::1]";
};

const getCurrentHostname = () =>
  typeof window !== "undefined" ? window.location.hostname : "";

export const isLegacyLocalMaintenanceUploadUri = (uri) => {
  const source = toText(uri);
  if (!source) return false;

  try {
    const parsed = new URL(
      source,
      typeof window !== "undefined" ? window.location.origin : "https://placeholder.local",
    );
    return (
      parsed.pathname.startsWith("/uploads/attachments/") &&
      !isLocalHostName(parsed.hostname) &&
      !isLocalHostName(getCurrentHostname())
    );
  } catch {
    return false;
  }
};

export const isViewableMaintenanceAttachmentUri = (uri) => {
  const source = toText(uri);
  if (!source || isLegacyLocalMaintenanceUploadUri(source)) return false;

  try {
    const { protocol } = new URL(source);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
};

/** Alias for isViewableMaintenanceAttachmentUri */
export const isRemoteUri = isViewableMaintenanceAttachmentUri;

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

const getMaintenanceAttachmentSize = (attachment) => {
  const rawSize = attachment?.size ?? attachment?.fileSize;
  const size = Number(rawSize);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

export const normalizeMaintenanceAttachment = (attachment, index = 0) => {
  const uri = getMaintenanceAttachmentUri(attachment);
  if (!uri) return null;

  const name = getMaintenanceAttachmentName(attachment, index);
  const type = getMaintenanceAttachmentType(attachment);
  const fileType = getMaintenanceAttachmentKind({ ...attachment, name, uri, type });
  const originalName = pickFirstText(
    attachment?.originalName,
    attachment?.originalFilename,
    attachment?.filename,
    attachment?.fileName,
    attachment?.name,
    name,
  );
  const normalized = {
    name,
    uri,
    type,
    url: uri,
    filename: name,
    originalName,
    mimeType: type,
    fileType,
  };
  const size = getMaintenanceAttachmentSize(attachment);
  if (size !== null) normalized.size = size;
  if (attachment?.storagePath) normalized.storagePath = attachment.storagePath;
  [
    "id",
    "attachmentId",
    "provider",
    "visibility",
    "uploadedBy",
    "uploadedAt",
    "branch",
    "branchId",
    "context",
    "relatedId",
    "isRemoved",
    "removedAt",
    "removedBy",
    "removedByRole",
    "removedByName",
    "removedReason",
    "removedScope",
  ].forEach((field) => {
    if (attachment?.[field] !== undefined) normalized[field] = attachment[field];
  });

  return {
    ...normalized,
  };
};

export const normalizeMaintenanceAttachments = (attachments) =>
  Array.isArray(attachments)
    ? attachments
        .map((attachment, index) => normalizeMaintenanceAttachment(attachment, index))
        .filter(Boolean)
    : [];
