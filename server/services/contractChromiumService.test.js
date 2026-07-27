import { describe, expect, jest, test } from "@jest/globals";
import {
  resolveContractChromium,
} from "./contractChromiumService.js";

const fileStat = (validPaths) => async (candidate) => {
  if (!validPaths.includes(candidate)) {
    const error = new Error("missing");
    error.code = "ENOENT";
    throw error;
  }
  return { isFile: () => true };
};

describe("Contract Chromium executable resolution", () => {
  test("uses a configured executable only after validating it", async () => {
    await expect(resolveContractChromium({
      platform: "linux",
      environment: { CONTRACT_CHROMIUM_PATH: "/opt/chrome" },
      stat: fileStat(["/opt/chrome"]),
    })).resolves.toMatchObject({
      executablePath: "/opt/chrome",
      provider: "explicit",
      explicit: true,
    });
  });

  test("rejects an invalid configured path without falling back", async () => {
    await expect(resolveContractChromium({
      platform: "linux",
      environment: { CONTRACT_CHROMIUM_PATH: "/invalid/chrome" },
      stat: fileStat([]),
      bundledExecutablePath: jest.fn(),
      playwrightExecutablePath: jest.fn(),
    })).rejects.toMatchObject({
      code: "CONTRACT_PDF_BROWSER_UNAVAILABLE",
      statusCode: 503,
    });
  });

  test("uses the bundled Chromium runtime on Linux", async () => {
    await expect(resolveContractChromium({
      platform: "linux",
      environment: {},
      stat: fileStat(["/tmp/chromium"]),
      bundledExecutablePath: async () => "/tmp/chromium",
    })).resolves.toMatchObject({
      executablePath: "/tmp/chromium",
      provider: "sparticuz-chromium",
    });
  });

  test("keeps Windows development lookup inside the win32 branch", async () => {
    const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    await expect(resolveContractChromium({
      platform: "win32",
      environment: { PROGRAMFILES: "C:\\Program Files" },
      stat: fileStat([chrome]),
      playwrightExecutablePath: () => "",
    })).resolves.toMatchObject({ executablePath: chrome, provider: "system" });
  });

  test("never selects an exe path for Linux", async () => {
    await expect(resolveContractChromium({
      platform: "linux",
      environment: { PROGRAMFILES: "C:\\Program Files" },
      stat: fileStat([]),
      bundledExecutablePath: () => "",
      playwrightExecutablePath: () => "",
    })).rejects.toMatchObject({ code: "CONTRACT_PDF_BROWSER_UNAVAILABLE" });
  });
});
