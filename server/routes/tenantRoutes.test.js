import { describe, expect, jest, test } from "@jest/globals";

const noop = (_req, _res, next) => next?.();
const verifyToken = jest.fn(noop);
const verifyAdmin = jest.fn(noop);

const requirePermission = jest.fn((permission) => {
  const middleware = (_req, _res, next) => next?.();
  middleware.requiredPermission = permission;
  return middleware;
});

const updateTenantAppliances = jest.fn(noop);

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  verifyToken,
  verifyAdmin,
}));

await jest.unstable_mockModule("../middleware/permissions.js", () => ({
  requirePermission,
}));

await jest.unstable_mockModule("../controllers/tenantController.js", () => ({
  updateTenantAppliances,
}));

const { default: router, requireAuth } = await import("./tenantRoutes.js");

describe("tenantRoutes routing and authorization wiring", () => {
  test("registers PATCH /:id/appliances with manage_tenants permission and auth middleware", () => {
    const route = router.stack.find(
      (layer) => layer.route && layer.route.path === "/:id/appliances" && layer.route.methods.patch,
    );

    expect(route).toBeDefined();
    expect(requireAuth).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("manage_tenants");
  });
});
