import { describe, expect, jest, test } from "@jest/globals";

const noop = (_req, _res, next) => next?.();
const verifyToken = jest.fn(noop);
const verifyOwner = jest.fn(noop);

const getAppliances = jest.fn(noop);
const createAppliance = jest.fn(noop);
const updateAppliance = jest.fn(noop);
const deleteAppliance = jest.fn(noop);

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  verifyToken,
  verifyOwner,
}));

await jest.unstable_mockModule("../controllers/applianceController.js", () => ({
  getAppliances,
  createAppliance,
  updateAppliance,
  deleteAppliance,
}));

const { default: router } = await import("./applianceRoutes.js");

function getRouteHandlers(routerInstance, path, method) {
  const layer = routerInstance.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods?.[method],
  );
  return layer?.route?.stack?.map((entry) => entry.handle) || [];
}

describe("applianceRoutes routing and authorization wiring", () => {
  test("registers GET / for fetching appliance catalog", () => {
    const route = router.stack.find(
      (layer) => layer.route && layer.route.path === "/" && layer.route.methods.get,
    );
    expect(route).toBeDefined();
    const handlers = getRouteHandlers(router, "/", "get");
    expect(handlers).toContain(getAppliances);
  });

  test("registers POST / with verifyToken and verifyOwner guards", () => {
    const route = router.stack.find(
      (layer) => layer.route && layer.route.path === "/" && layer.route.methods.post,
    );
    expect(route).toBeDefined();
    const handlers = getRouteHandlers(router, "/", "post");
    expect(handlers).toContain(verifyToken);
    expect(handlers).toContain(verifyOwner);
    expect(handlers).toContain(createAppliance);
  });

  test("registers PATCH /:id with verifyToken and verifyOwner guards", () => {
    const route = router.stack.find(
      (layer) => layer.route && layer.route.path === "/:id" && layer.route.methods.patch,
    );
    expect(route).toBeDefined();
    const handlers = getRouteHandlers(router, "/:id", "patch");
    expect(handlers).toContain(verifyToken);
    expect(handlers).toContain(verifyOwner);
    expect(handlers).toContain(updateAppliance);
  });

  test("registers DELETE /:id with verifyToken and verifyOwner guards", () => {
    const route = router.stack.find(
      (layer) => layer.route && layer.route.path === "/:id" && layer.route.methods.delete,
    );
    expect(route).toBeDefined();
    const handlers = getRouteHandlers(router, "/:id", "delete");
    expect(handlers).toContain(verifyToken);
    expect(handlers).toContain(verifyOwner);
    expect(handlers).toContain(deleteAppliance);
  });
});

