import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const heroSectionPath = path.join(__dirname, "HeroSection.jsx");

describe("HeroSection Mobile Performance Optimization", () => {
  test("HeroSection uses responsive picture element for mobile viewport image delivery", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    assert.match(
      heroContent,
      /<picture/i,
      "HeroSection should render a <picture> element for responsive image delivery."
    );
  });

  test("First hero image specifies fetchpriority high and loading eager", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    assert.match(
      heroContent,
      /fetchpriority|fetchPriority/i,
      "Hero image must have fetchpriority attribute specified."
    );
    assert.match(
      heroContent,
      /loading=\{i === 0 \? "eager" : "lazy"\}/,
      "First hero image must have eager loading."
    );
  });

  test("Above-the-fold headline avoids blocking framer-motion runtime delays", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    // Critical headline should be a native h1 rather than motion.h1
    assert.match(
      heroContent,
      /<h1[\s>]/,
      "Critical LCP headline should use native <h1> with hardware-accelerated CSS classes for immediate painting."
    );
  });
});
