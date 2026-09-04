# Landing Page Gentle Scroll-Reveal Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide smooth, slow, staggered scroll-reveal animations across all sections, headers, and card components of the public landing page (`/`) using `framer-motion`, enhancing user experience and visual polish while strictly adhering to accessibility guidelines.

**Architecture:** Upgrade `ScrollReveal.jsx` into a modular `framer-motion` animation suite exposing `<ScrollReveal>`, `<ScrollRevealStagger>`, and `<ScrollRevealItem>`. Integrate these primitives into `LandingPage.jsx` and across individual landing page section components (`JourneyHighlightsSection`, `BenefitsSection`, `RoomInventory`, `FacilitiesSection`, `LocationSection`, `StorytellingSection`, `RulesSection`, `FAQSection`, `InquiryForm`, `CTASection`, and `ContactFooter`) so each section title and card cascades in gently and stays visible on scroll-up.

**Tech Stack:** React 19, Vite, Tailwind CSS, Framer Motion (`^12.34.0`), Lucide React.

## What to Expect from These Changes

When you visit the Lilycrest website homepage (`/`) and scroll down:
1. **Gentle, Slow Appearances**: Content will not pop abruptly into view. Instead, as each section enters your screen, it will smoothly glide upwards and fade in gently over ~0.7 seconds.
2. **Staggered Card Reveals**: Within sections that display multiple cards (such as Benefits, Room Inventory, Shared Facilities, and Dorm Rules), the cards will not all appear at the same moment. They will cascade in one after the other with a tiny 0.1-second delay, creating a fluid, professional presentation.
3. **No Disappearing or Annoying Re-animation**: Once an element has animated into view, it stays visible. If you scroll back up to double-check room rates or locations, everything remains right where it is without blinking, flickering, or re-playing.
4. **Accessibility First**: For visitors who have enabled "Reduce Motion" in their operating system settings, animations are automatically bypassed, showing all contents immediately and comfortably.

## Global Constraints
- Strictly no gradients: solid HSL CSS variables, clean neutral 1px borders (`1px solid var(--border)` or `var(--lp-border)`).
- Status colors must follow semantic tokens; no colored badge outlines or side-colored borders.
- Animation timing: duration `~0.7s`, ease `[0.25, 0.1, 0.25, 1]`, stagger `0.1s`.
- Trigger once: `viewport={{ once: true, amount: 0.15 }}` so elements stay visible when scrolling back up.
- Accessibility: Honor `prefers-reduced-motion` to render instantly without transform/delay for users with motion sensitivity.
- Zero layout shift: lazy loaded sections wrapped smoothly with stable min-height fallbacks.

---

## File Structure & Module Map

| File Path | Role / Responsibility |
|:---|:---|
| `web/src/shared/components/ScrollReveal.jsx` | Core animation wrappers: `<ScrollReveal>`, `<ScrollRevealStagger>`, `<ScrollRevealItem>` with framer-motion |
| `web/src/features/public/pages/LandingPage.jsx` | Main landing page orchestration and section wrappers |
| `web/src/features/public/components/JourneyHighlightsSection.jsx` | 3-step applicant decision journey with staggered card reveal |
| `web/src/features/public/components/BenefitsSection.jsx` | "Why Choose Us" section with 6 staggered benefit cards |
| `web/src/features/public/components/RoomInventory.jsx` | Room listings with staggered cards and tab transition |
| `web/src/features/public/components/FacilitiesSection.jsx` | Shared amenities grid with staggered photo cards |
| `web/src/features/public/components/LocationSection.jsx` | Branch locator, landmarks, and map with smooth entrance |
| `web/src/features/public/components/StorytellingSection.jsx` | Brand mission and story with smooth upward reveal |
| `web/src/features/public/components/RulesSection.jsx` | House policies with 6 staggered policy cards |
| `web/src/features/public/components/faq/FAQSection.jsx` | Knowledge base category tabs and accordion items |
| `web/src/features/public/components/InquiryForm.jsx` | Booking inquiry form with smooth reveal container |
| `web/src/features/public/components/CTASection.jsx` | Final pre-footer conversion banner with smooth reveal |
| `web/src/features/public/components/ContactFooter.jsx` | Footer navigation and contact info with smooth reveal |

---

## Tasks

### Task 1: Core Animation Engine Upgrade (`ScrollReveal.jsx`)

**Files:**
- Modify: `web/src/shared/components/ScrollReveal.jsx`
- Test: Build verification (`npm run build` in `web/`)

**Interfaces:**
- Produces:
  - `ScrollReveal`: `({ children, variant = "fade-up", duration = 0.7, delay = 0, className = "", style = {}, amount = 0.15, once = true }) => JSX.Element`
  - `ScrollRevealStagger`: `({ children, staggerDelay = 0.1, delayChildren = 0, className = "", style = {}, amount = 0.15, once = true }) => JSX.Element`
  - `ScrollRevealItem`: `({ children, variant = "fade-up", duration = 0.7, className = "", style = {} }) => JSX.Element`

- [ ] **Step 1: Write modern Framer Motion primitives in ScrollReveal.jsx**

Upgrade `web/src/shared/components/ScrollReveal.jsx` to export `ScrollReveal`, `ScrollRevealStagger`, and `ScrollRevealItem` using `framer-motion`'s `motion.div` and `useReducedMotion()`.

- [ ] **Step 2: Verify export compatibility and build**
Run: `npm run build` in `Capstone-Website/web`
Expected: Passes without errors.

- [ ] **Step 3: Commit Task 1**
```bash
git add web/src/shared/components/ScrollReveal.jsx
git commit -m "feat(web): upgrade ScrollReveal to framer-motion with stagger and accessibility support"
```

---

### Task 2: Landing Page Main Layout & Journey Highlights Stagger

**Files:**
- Modify: `web/src/features/public/pages/LandingPage.jsx`
- Modify: `web/src/features/public/components/JourneyHighlightsSection.jsx`

**Interfaces:**
- Consumes: `ScrollReveal`, `ScrollRevealStagger`, `ScrollRevealItem` from `../../../shared/components/ScrollReveal`

- [ ] **Step 1: Wrap JourneyHighlightsSection in LandingPage.jsx**

Wrap `JourneyHighlightsSection` with `<ScrollReveal variant="fade-up">` inside `LandingPage.jsx`.

- [ ] **Step 2: Enhance JourneyHighlightsSection with staggered step cards**

Wrap the 3 journey step cards in `<ScrollRevealStagger>` and `<ScrollRevealItem>`.

- [ ] **Step 3: Verify build**
Run: `npm run build` in `Capstone-Website/web`
Expected: Passes without errors.

- [ ] **Step 4: Commit Task 2**
```bash
git add web/src/features/public/pages/LandingPage.jsx web/src/features/public/components/JourneyHighlightsSection.jsx
git commit -m "feat(web): add staggered scroll reveal to journey highlights section"
```

---

### Task 3: Staggered Entrance for Benefits & Room Inventory

**Files:**
- Modify: `web/src/features/public/components/BenefitsSection.jsx`
- Modify: `web/src/features/public/components/RoomInventory.jsx`

**Interfaces:**
- Consumes: `ScrollReveal`, `ScrollRevealStagger`, `ScrollRevealItem` from `../../../shared/components/ScrollReveal`

- [ ] **Step 1: Add staggered card entrance to BenefitsSection**

Wrap header in `<ScrollReveal>` and 6 cards in `<ScrollRevealStagger>` + `<ScrollRevealItem>`.

- [ ] **Step 2: Add staggered card entrance to RoomInventory**

Wrap section title and branch filter tabs in `<ScrollReveal>`, and room listings in `<ScrollRevealStagger>` + `<ScrollRevealItem>`.

- [ ] **Step 3: Verify build**
Run: `npm run build` in `Capstone-Website/web`
Expected: Passes without errors.

- [ ] **Step 4: Commit Task 3**
```bash
git add web/src/features/public/components/BenefitsSection.jsx web/src/features/public/components/RoomInventory.jsx
git commit -m "feat(web): add staggered card entrance animations to benefits and room inventory"
```

---

### Task 4: Staggered Entrance for Facilities & Location

**Files:**
- Modify: `web/src/features/public/components/FacilitiesSection.jsx`
- Modify: `web/src/features/public/components/LocationSection.jsx`

**Interfaces:**
- Consumes: `ScrollReveal`, `ScrollRevealStagger`, `ScrollRevealItem` from `../../../shared/components/ScrollReveal`

- [ ] **Step 1: Add staggered entrance to FacilitiesSection**

Wrap facility header and photo cards in `<ScrollRevealStagger>` + `<ScrollRevealItem>`.

- [ ] **Step 2: Add smooth entrance to LocationSection**

Wrap branch selector and landmark/map columns in `<ScrollRevealStagger>` + `<ScrollRevealItem>`.

- [ ] **Step 3: Verify build**
Run: `npm run build` in `Capstone-Website/web`
Expected: Passes without errors.

- [ ] **Step 4: Commit Task 4**
```bash
git add web/src/features/public/components/FacilitiesSection.jsx web/src/features/public/components/LocationSection.jsx
git commit -m "feat(web): add staggered entrance animations to facilities and location sections"
```

---

### Task 5: Staggered Entrance for Brand Story, Rules, FAQs, Inquiry Form & CTA

**Files:**
- Modify: `web/src/features/public/components/StorytellingSection.jsx`
- Modify: `web/src/features/public/components/RulesSection.jsx`
- Modify: `web/src/features/public/components/faq/FAQSection.jsx`
- Modify: `web/src/features/public/components/InquiryForm.jsx`
- Modify: `web/src/features/public/components/CTASection.jsx`
- Modify: `web/src/features/public/components/ContactFooter.jsx`

**Interfaces:**
- Consumes: `ScrollReveal`, `ScrollRevealStagger`, `ScrollRevealItem` from `../../../shared/components/ScrollReveal`

- [ ] **Step 1: Add smooth reveal to StorytellingSection, RulesSection, and FAQSection**
- [ ] **Step 2: Add smooth reveal to InquiryForm, CTASection, and ContactFooter**
- [ ] **Step 3: Verify build**
Run: `npm run build` in `Capstone-Website/web`
Expected: Passes without errors.

- [ ] **Step 4: Commit Task 5**
```bash
git add web/src/features/public/components/StorytellingSection.jsx web/src/features/public/components/RulesSection.jsx web/src/features/public/components/faq/FAQSection.jsx web/src/features/public/components/InquiryForm.jsx web/src/features/public/components/CTASection.jsx web/src/features/public/components/ContactFooter.jsx
git commit -m "feat(web): apply scroll reveal and staggered animations across story, rules, faq, inquiry, cta and footer"
```

---

### Task 6: Whole-Branch Build Verification & Manual QA Verification

**Files:**
- Execute runtime build check in `Capstone-Website/web`

- [ ] **Step 1: Run comprehensive build verification**
Run: `npm run build` in `Capstone-Website/web`
Expected: Zero compilation errors.

- [ ] **Step 2: Verify WCAG reduced-motion compliance**
Confirm that when `prefers-reduced-motion: reduce` is active, all animations are gracefully bypassed.
