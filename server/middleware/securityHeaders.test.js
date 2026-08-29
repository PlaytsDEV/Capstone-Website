import http from "http";
import express from "express";
import helmet from "helmet";

describe("Backend Security Headers", () => {
  let server;
  let baseUrl;

  beforeAll((done) => {
    const app = express();

    app.use((_req, res, next) => {
      res.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()",
      );
      next();
    });

    app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: [
              "'self'",
              "https://identitytoolkit.googleapis.com",
              "https://securetoken.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            objectSrc: ["'none'"],
            frameSrc: ["'none'"],
            frameAncestors: ["'none'"],
            formAction: ["'self'"],
          },
        },
        crossOriginEmbedderPolicy: false,
        crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
        hsts: {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
        frameguard: {
          action: "deny",
        },
        referrerPolicy: {
          policy: "strict-origin-when-cross-origin",
        },
        permittedCrossDomainPolicies: {
          permittedPolicies: "none",
        },
        xContentTypeOptions: true,
        crossOriginResourcePolicy: {
          policy: "same-origin",
        },
      }),
    );

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

  it("attaches Permissions-Policy, HSTS, and Helmet security headers to responses", async () => {
    const res = await fetch(`${baseUrl}/api/health-check`);
    expect(res.status).toBe(200);

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("strict-transport-security")).toContain("max-age=31536000");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(res.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(res.headers.get("content-security-policy")).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
