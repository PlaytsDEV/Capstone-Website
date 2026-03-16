import Navbar from "../components/Navbar";
import { ContactFooter } from "../components/ContactFooter";
import { HeroSection } from "../components/HeroSection";
import { BenefitsSection } from "../components/BenefitsSection";
import { SocialProofSection } from "../components/SocialProofSection";
import { RoomInventory } from "../components/RoomInventory";

import { FacilitiesSection } from "../components/FacilitiesSection";
import { LocationSection } from "../components/LocationSection";
import { RulesSection } from "../components/RulesSection";
import { StorytellingSection } from "../components/StorytellingSection";

import { InquiryForm } from "../components/InquiryForm";
import { CTASection } from "../components/CTASection";
import ScrollReveal from "../../../shared/components/ScrollReveal";
import ScrollToTopButton from "../../../shared/components/ScrollToTopButton";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

function LandingPageContent() {
  const { theme } = useTheme();

  return (
    <div className="landing-page" data-theme={theme} style={{ overflowX: "hidden", backgroundColor: "var(--lp-bg)" }}>
      <Navbar type="landing" currentPage="home" />

      {/* 1. HOOK — First impression */}
      <HeroSection />

      {/* 2. FEATURES — Why choose us */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up">
          <BenefitsSection />
        </ScrollReveal>
      </div>

      {/* 3. PRODUCT — What we offer */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up" delay={0.1}>
          <RoomInventory />
        </ScrollReveal>
      </div>

      {/* 4. FACILITIES — Shared spaces */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up">
          <FacilitiesSection />
        </ScrollReveal>
      </div>

      {/* 5. CONVENIENCE — Where we are */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up">
          <LocationSection />
        </ScrollReveal>
      </div>

      {/* 6. TRUST — Social proof */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up">
          <SocialProofSection />
        </ScrollReveal>
      </div>

      {/* 7. STORY — Brand identity */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-left">
          <StorytellingSection />
        </ScrollReveal>
      </div>

      {/* 8. TRANSPARENCY — House rules */}
      <ScrollReveal variant="fade">
        <RulesSection />
      </ScrollReveal>

      {/* 9. ACTION — Convert the visitor */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="fade-up">
          <InquiryForm />
        </ScrollReveal>
      </div>

      {/* 10. FINAL CTA */}
      <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
        <ScrollReveal variant="zoom">
          <CTASection />
        </ScrollReveal>
      </div>

      {/* FOOTER */}
      <ScrollReveal variant="fade">
        <ContactFooter />
      </ScrollReveal>

      <ScrollToTopButton />
    </div>
  );
}

function LandingPage() {
  return (
    <ThemeProvider>
      <LandingPageContent />
    </ThemeProvider>
  );
}

export default LandingPage;
