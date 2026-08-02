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
});
