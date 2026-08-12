import { describe, expect, test } from "@jest/globals";
import { getPublicUrlConfig } from "./publicUrls.js";

describe("public URL configuration", () => {
  test("uses explicit official Lilycrest production URLs", () => {
    const config = getPublicUrlConfig({
      NODE_ENV: "production",
      PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
      EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
      RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
    });
    expect(config.publicFrontendUrl).toBe("https://www.lilycrest.space");
    expect(config.publicApiUrl).toBe("https://api.lilycrest.space");
  });

  test("uses localhost only for development defaults", () => {
    const config = getPublicUrlConfig({ NODE_ENV: "development" });
    expect(config.publicFrontendUrl).toBe("http://localhost:3000");
    expect(config.publicApiUrl).toBe("http://localhost:5000");
  });

  test("fails safely when a production URL is missing", () => {
    expect(() => getPublicUrlConfig({ NODE_ENV: "production" })).toThrow("PUBLIC_FRONTEND_URL is required");
  });

  test("defaults the logo URL to a stable, non-build-hashed path under the frontend URL", () => {
    const config = getPublicUrlConfig({
      NODE_ENV: "production",
      PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
      EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
      RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
    });
    expect(config.publicLogoUrl).toBe("https://www.lilycrest.space/logo512.png");
  });

  test("PUBLIC_LOGO_URL overrides the default when explicitly set", () => {
    const config = getPublicUrlConfig({
      NODE_ENV: "production",
      PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
      PUBLIC_API_URL: "https://api.lilycrest.space",
      EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
      RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
      PUBLIC_LOGO_URL: "https://cdn.lilycrest.space/brand/logo.png",
    });
    expect(config.publicLogoUrl).toBe("https://cdn.lilycrest.space/brand/logo.png");
  });
});
