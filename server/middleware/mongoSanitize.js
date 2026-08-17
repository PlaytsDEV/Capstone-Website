/**
 * ============================================================================
 * NOSQL INJECTION & MONGODB OPERATOR SANITIZATION MIDDLEWARE
 * ============================================================================
 *
 * Recursively removes keys starting with '$' or containing '.' from request
 * body, query, and params to prevent MongoDB operator injection attacks.
 *
 * Example attack vectors prevented:
 * - req.body = { username: { "$gt": "" }, password: { "$ne": null } }
 * - req.query = { branch: { "$regex": ".*" } }
 *
 * ============================================================================
 */

function sanitizeObject(target) {
  if (!target || typeof target !== "object") {
    return target;
  }

  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      target[i] = sanitizeObject(target[i]);
    }
    return target;
  }

  for (const key of Object.keys(target)) {
    // Prohibit keys starting with $ or containing a dot
    if (key.startsWith("$") || key.includes(".")) {
      delete target[key];
    } else {
      target[key] = sanitizeObject(target[key]);
    }
  }

  return target;
}

/**
 * Express middleware to sanitize req.body, req.query, and req.params against NoSQL injection.
 */
export const mongoSanitize = (req, _res, next) => {
  try {
    if (req.body && typeof req.body === "object") {
      sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === "object") {
      sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === "object") {
      sanitizeObject(req.params);
    }
  } catch (err) {
    // Ignore errors during sanitization and proceed safely
  }
  next();
};

export default mongoSanitize;
