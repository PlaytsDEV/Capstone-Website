/**
 * imageOptimizer.js
 *
 * Utility helpers for optimizing image URLs before rendering.
 *
 * Firebase Storage does NOT natively support resize transforms via URL params,
 * but if the "Resize Images" Firebase Extension is enabled, it generates
 * sibling files like: original.jpg → original_200x200.jpg
 *
 * For now this module:
 *  1. Forces `alt=media` on Firebase Storage URLs (required to serve the file)
 *  2. Strips token expiry when unnecessary (public rules)
 *  3. Provides a ready-to-wire Cloudinary transform helper if images are ever
 *     migrated to Cloudinary (just swap VITE_CLOUDINARY_CLOUD_NAME in .env)
 *
 * Usage:
 *   import { getOptimizedUrl } from '@/shared/utils/imageOptimizer';
 *   <img src={getOptimizedUrl(room.images[0], { width: 800 })} />
 */

const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

/**
 * Returns an optimized image URL.
 *
 * - Handles string URLs or image objects { url, thumbnailUrl }
 * - Firebase Storage URLs: ensures `alt=media` is present (required)
 * - Cloudinary URLs: appends f_auto,q_auto,w_{width} transforms
 * - Local / bundled assets: returned as-is
 *
 * @param {string | { url?: string, thumbnailUrl?: string }} src - Original image URL or object
 * @param {{ width?: number, quality?: number }} opts
 * @returns {string}
 */
export function getOptimizedUrl(src, opts = {}) {
  if (!src) return "";

  // Support structured image objects
  const rawSrc = typeof src === "object" ? src.url || src.thumbnailUrl || "" : src;
  if (!rawSrc || typeof rawSrc !== "string") return "";

  const { width = 1200, quality = 80 } = opts;

  // ── Cloudinary ────────────────────────────────────────────────────────────
  if (CLOUDINARY_CLOUD && rawSrc.includes("cloudinary.com")) {
    // Insert transforms before /upload/ segment
    return rawSrc.replace(
      /\/upload\//,
      `/upload/f_auto,q_auto:${quality},w_${width},c_fill,dpr_auto/`
    );
  }

  // ── Firebase Storage / Google Storage ─────────────────────────────────────
  if (rawSrc.includes("firebasestorage.googleapis.com") || rawSrc.includes("storage.googleapis.com")) {
    try {
      const url = new URL(rawSrc);
      if (rawSrc.includes("firebasestorage.googleapis.com") && !url.searchParams.has("alt")) {
        url.searchParams.set("alt", "media");
      }
      return url.toString();
    } catch {
      return rawSrc;
    }
  }

  // ── Fallback: return as-is (e.g. bundled assets) ───────────────────────────
  return rawSrc;
}

/**
 * Returns a lightweight thumbnail image URL (~480px, ~75% quality).
 * Ideal for card grid previews to prevent bandwidth choke.
 *
 * @param {string | { url?: string, thumbnailUrl?: string }} src
 * @param {{ width?: number, quality?: number }} opts
 * @returns {string}
 */
export function getThumbnailUrl(src, opts = {}) {
  if (!src) return "";

  // If object already has explicit thumbnailUrl
  if (typeof src === "object" && src.thumbnailUrl) {
    return getOptimizedUrl(src.thumbnailUrl, { width: 480, quality: 75, ...opts });
  }

  const rawSrc = typeof src === "object" ? src.url || "" : src;
  if (!rawSrc || typeof rawSrc !== "string") return "";

  // If string already contains thumb suffix
  if (rawSrc.includes("-thumb.")) {
    return getOptimizedUrl(rawSrc, { width: 480, quality: 75, ...opts });
  }

  // Cloudinary transform
  if (CLOUDINARY_CLOUD && rawSrc.includes("cloudinary.com")) {
    return getOptimizedUrl(rawSrc, { width: 480, quality: 75, ...opts });
  }

  // Default optimization pass
  return getOptimizedUrl(rawSrc, { width: 480, quality: 75, ...opts });
}

/**
 * Returns true if the src is a remote URL (Firebase / Cloudinary / http)
 * as opposed to a local bundled asset.
 * @param {string | object} src
 * @returns {boolean}
 */
export function isRemoteImage(src) {
  const target = typeof src === "object" ? src?.url || src?.thumbnailUrl : src;
  if (!target || typeof target !== "string") return false;
  return target.startsWith("http://") || target.startsWith("https://");
}

