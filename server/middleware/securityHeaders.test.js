import http from "http";
import express from "express";
import securityHeaders from "./securityHeaders.js";

describe("Backend Security Headers", () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    const app = express();

    app.use(securityHeaders);

    app.get("/api/health-check", (_req, res) => res.json({ status: "ok" }));

    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      done();
    });
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it("attaches Permissions-Policy, HSTS, and Helmet security headers with Google Auth CSP to responses", async () => {
    const res = await fetch(`${baseUrl}/api/health-check`);
    expect(res.status).toBe(200);

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");

    const csp = res.headers.get("content-security-policy");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self' https://apis.google.com https://*.firebaseapp.com");
    expect(csp).toContain("frame-src 'self' https://accounts.google.com https://*.firebaseapp.com");
    expect(csp).toContain("connect-src 'self' https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://accounts.google.com");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
