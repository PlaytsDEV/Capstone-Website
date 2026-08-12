import fs from "fs";

describe("mobile Survey route safety", () => {
  const routes = fs.readFileSync(new URL("./mobileSurveyRoutes.js", import.meta.url), "utf8");
  const bridgeRouteIndex = fs.readFileSync(
    new URL("../mobile/routes/index.js", import.meta.url),
    "utf8",
  );
  const serverEntry = fs.readFileSync(new URL("../server.js", import.meta.url), "utf8");

  test("tenant identity is resolved server-side from the session, never from client input", () => {
    expect(routes).toContain('mongoose.connection.db.collection("user_sessions")');
    expect(routes).toContain('mongoose.connection.db.collection("users")');
    expect(routes).toContain("req.mobileTenant = user");
  });

  test("every survey/assignment lookup is scoped to the authenticated tenant", () => {
    const scopedQueries = routes.match(/SurveyAssignment\.findOne\(\{[^}]*\}\)/gs) || [];
    expect(scopedQueries.length).toBeGreaterThan(0);
    scopedQueries.forEach((query) => {
      expect(query).toContain("tenantId: req.mobileTenant._id");
    });
    expect(routes).toContain("SurveyAssignment.find({ tenantId: req.mobileTenant._id }");
  });

  test("answers are validated against the authoritative template before being saved", () => {
    expect(routes).toContain(
      'import { validateSurveyAnswers } from "../services/surveyValidationService.js"',
    );
    expect(routes).toContain("validateSurveyAnswers(assignment.templateId, webAnswers, { submission })");
  });

  test("is mounted at /api/m alongside the mobile contract bridge", () => {
    expect(serverEntry).toContain('import mobileSurveyRoutes from "./routes/mobileSurveyRoutes.js"');
    expect(serverEntry).toContain('app.use("/api/m", mobileSurveyRoutes)');
  });

  test("does not duplicate a competing /surveys mount in the legacy bridge copy", () => {
    expect(bridgeRouteIndex).not.toMatch(/require\(['"]\.\/survey\.routes['"]\)/);
  });
});
