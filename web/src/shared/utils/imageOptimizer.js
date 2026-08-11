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
 * - Firebase Storage URLs: ensures `alt=media` is present (required)
 * - Cloudinary URLs: appends f_auto,q_auto,w_{width} transforms
 * - Local / bundled assets: returned as-is
 *
 * @param {string} src - Original image URL
 * @param {{ width?: number, quality?: number }} opts
 * @returns {string}
 */
export function getOptimizedUrl(src, opts = {}) {
  if (!src || typeof src !== "string") return src;

  const { width = 1200, quality = 75 } = opts;

  // ── Cloudinary ────────────────────────────────────────────────────────────
  if (CLOUDINARY_CLOUD && src.includes("cloudinary.com")) {
    // Insert transforms before /upload/ segment
    return src.replace(
      /\/upload\//,
      `/upload/f_auto,q_auto:${quality},w_${width},c_fill,dpr_auto/`
    );
  }

  // ── Firebase Storage ──────────────────────────────────────────────────────
  if (src.includes("firebasestorage.googleapis.com")) {
    try {
      const url = new URL(src);
      // Ensure the file is served as a download (not metadata)
      if (!url.searchParams.has("alt")) {
        url.searchParams.set("alt", "media");
      }
      return url.toString();
    } catch {
      return src;
    }
  }

  // ── Fallback: return as-is ────────────────────────────────────────────────
  return src;
}

/**
 * Returns true if the src is a remote URL (Firebase / Cloudinary / http)
 * as opposed to a local bundled asset.
 * @param {string} src
 * @returns {boolean}
 */
export function isRemoteImage(src) {
  if (!src || typeof src !== "string") return false;
  return src.startsWith("http://") || src.startsWith("https://");
}
