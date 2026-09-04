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

  test("HeroSection applies hardware-accelerated animate-ken-burns to active dormitory photo", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    assert.match(
      heroContent,
      /animate-ken-burns/,
      "HeroSection must apply animate-ken-burns CSS class to active background photos for continuous GPU zoom."
    );
  });

  test("HeroSection applies staggered animate-hero-fade-up CSS classes to text and CTA elements", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    assert.match(
      heroContent,
      /animate-hero-fade-up/,
      "HeroSection must use animate-hero-fade-up classes for GPU-accelerated non-blocking entrance animations."
    );
    assert.match(
      heroContent,
      /handleSlideSelect/,
      "HeroSection slide indicators must use handleSlideSelect to reset rotation timer upon manual selection."
    );
  });
});

describe("Sticky Curtain Overlap Scroll Reveal Invariants", () => {
  const landingPagePath = path.join(__dirname, "../pages/LandingPage.jsx");

  test("LandingPage encapsulates HeroSection in a pinned sticky container", () => {
    const landingContent = fs.readFileSync(landingPagePath, "utf-8");
    assert.match(
      landingContent,
      /sticky\s+top-0\s+z-0/,
      "LandingPage must wrap HeroSection in a sticky top-0 z-0 container for pinned reveal effect."
    );
  });

  test("LandingPage wraps below-the-fold content in an elevated rounded sliding sheet", () => {
    const landingContent = fs.readFileSync(landingPagePath, "utf-8");
    assert.match(
      landingContent,
      /relative\s+z-10[\s\S]*?rounded-t-\[(24px|36px)\]/,
      "LandingPage must wrap main content in a relative z-10 rounded sliding sheet layer."
    );
    assert.match(
      landingContent,
      /border-t\s+border-\[var\(--lp-border\)\]/,
      "Sliding sheet must feature a crisp 1px top border line matching var(--lp-border)."
    );
  });

  test("HeroSection includes rAF-debounced scroll parallax tracking with reduced-motion support", () => {
    const heroContent = fs.readFileSync(heroSectionPath, "utf-8");
    assert.match(
      heroContent,
      /requestAnimationFrame/,
      "HeroSection must use requestAnimationFrame debouncing for smooth 60fps parallax scroll calculation."
    );
    assert.match(
      heroContent,
      /prefers-reduced-motion|prefersReducedMotion/,
      "HeroSection must respect user preferences for reduced motion."
    );
  });
});

