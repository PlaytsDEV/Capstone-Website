import fs from "fs/promises";
import path from "path";
import sparticuzChromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const SYSTEM_BROWSER_PATHS = {
  linux: [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ],
  darwin: [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ],
};

const windowsBrowserPaths = (environment = process.env) => [
  environment.PROGRAMFILES,
  environment["PROGRAMFILES(X86)"],
  environment.LOCALAPPDATA,
].filter(Boolean).flatMap((root) => [
  path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
  path.join(root, "Chromium", "Application", "chrome.exe"),
]);

const isExecutableFile = async (candidate, stat = fs.stat) => {
  if (!candidate) return false;
  try {
    return (await stat(candidate)).isFile();
  } catch {
    return false;
  }
};

export const browserUnavailableError = (cause = null) => Object.assign(
  new Error("The Contract PDF browser runtime is not available in this environment."),
  {
    code: "CONTRACT_PDF_BROWSER_UNAVAILABLE",
    statusCode: 503,
    cause,
  },
);

export const resolveContractChromium = async ({
  platform = process.platform,
  environment = process.env,
  stat = fs.stat,
  bundledExecutablePath = () => sparticuzChromium.executablePath(),
  playwrightExecutablePath = () => playwrightChromium.executablePath(),
} = {}) => {
  const explicitPath = environment.CONTRACT_CHROMIUM_PATH?.trim();
  if (explicitPath) {
    if (!await isExecutableFile(explicitPath, stat)) throw browserUnavailableError();
    return {
      executablePath: explicitPath,
      provider: "explicit",
      explicit: true,
      args: platform === "linux" ? sparticuzChromium.args : [],
    };
  }

  if (platform === "linux") {
    try {
      const bundledPath = await bundledExecutablePath();
      if (await isExecutableFile(bundledPath, stat)) {
        return {
          executablePath: bundledPath,
          provider: "sparticuz-chromium",
          explicit: false,
          // These are the provider's minimal container-compatible Chromium flags.
          args: sparticuzChromium.args,
        };
      }
    } catch {
      // Continue to Playwright cache and verified system candidates.
    }
  }

  try {
    const packagePath = await playwrightExecutablePath();
    if (await isExecutableFile(packagePath, stat)) {
      return {
        executablePath: packagePath,
        provider: "playwright",
        explicit: false,
        args: platform === "linux" ? sparticuzChromium.args : [],
      };
    }
  } catch {
    // Continue to platform-specific system candidates.
  }

  const candidates = platform === "win32"
    ? windowsBrowserPaths(environment)
    : (SYSTEM_BROWSER_PATHS[platform] || []);
  for (const candidate of candidates) {
    if (await isExecutableFile(candidate, stat)) {
      return {
        executablePath: candidate,
        provider: "system",
        explicit: false,
        args: platform === "linux" ? sparticuzChromium.args : [],
      };
    }
  }

  throw browserUnavailableError();
};

export const logContractPdfRendererStartupStatus = async (logger) => {
  try {
    const resolved = await resolveContractChromium();
    logger.info({
      platform: process.platform,
      provider: resolved.provider,
      browserAvailable: true,
      explicitExecutablePath: resolved.explicit,
    }, "Contract PDF renderer: chromium ready");
  } catch {
    logger.warn({
      platform: process.platform,
      provider: "unavailable",
      browserAvailable: false,
      explicitExecutablePath: Boolean(process.env.CONTRACT_CHROMIUM_PATH),
    }, "Contract PDF renderer: chromium unavailable");
  }
};
