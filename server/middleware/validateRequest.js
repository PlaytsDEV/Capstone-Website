import { z } from "zod";
import { sendError } from "./errorHandler.js";

/**
 * Express middleware factory for validating and parsing request data with Zod.
 *
 * @param {Object} [schemas={}]
 * @param {import("zod").ZodSchema} [schemas.body] - Schema for req.body
 * @param {import("zod").ZodSchema} [schemas.query] - Schema for req.query
 * @param {import("zod").ZodSchema} [schemas.params] - Schema for req.params
 * @returns {import("express").RequestHandler}
 */
export const validateRequest = ({ body, query, params } = {}) => async (req, res, next) => {
  try {
    if (body) req.body = await body.parseAsync(req.body);
    if (query) req.query = await query.parseAsync(req.query);
    if (params) req.params = await params.parseAsync(req.params);
    next();
  } catch (error) {
    if (error instanceof z.ZodError || error?.name === "ZodError") {
      const details = (error.issues || []).map((issue) => ({
        field: Array.isArray(issue.path) ? issue.path.join(".") : String(issue.path || ""),
        message: issue.message,
        code: issue.code,
      }));
      return sendError(res, "Validation failed", 400, "VALIDATION_ERROR", details);
    }
    next(error);
  }
};

export default validateRequest;
