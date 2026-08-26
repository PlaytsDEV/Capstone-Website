import { chromium } from "playwright-core";
import path from "path";
import fs from "fs";

const BROWSER_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:3001";

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: BROWSER_PATH,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
  });

  const page = await context.newPage();
  console.log("Navigating to /signin...");
  await page.goto(`${BASE_URL}/signin`, { waitUntil: "networkidle" });
  
  console.log("Filling login credentials...");
  await page.fill('input[type="email"], input[name="email"]', "superadmin@lilycrest.com");
  await page.fill('input[type="password"], input[name="password"]', "Admin123!");
  
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();
  
  console.log("Waiting for navigation or OTP prompt...");
  await page.waitForTimeout(4000);
  console.log("Current URL:", page.url());
  
  await page.screenshot({ path: "d:/Portfolio/3rdYear/CapstoneSystem/test_login_result.png" });
  console.log("Screenshot captured to test_login_result.png");
  
  await browser.close();
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
