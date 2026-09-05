import { lazy, Suspense, useEffect } from "react";
import Navbar from "../components/Navbar";
import { HeroSection } from "../components/HeroSection";
import { JourneyHighlightsSection } from "../components/JourneyHighlightsSection";
import { BenefitsSection } from "../components/BenefitsSection";
import { RoomInventory } from "../components/RoomInventory";
import ScrollToTopButton from "../../../shared/components/ScrollToTopButton";
import { ThemeProvider } from "../context/ThemeContext";
import RouteErrorBoundary from "../../../shared/components/RouteErrorBoundary";

// Code-split below-the-fold sections to minimize initial main-thread execution time
const FacilitiesSection = lazy(() =>
  import("../components/FacilitiesSection").then((m) => ({ default: m.FacilitiesSection }))
);
const LocationSection = lazy(() =>
  import("../components/LocationSection").then((m) => ({ default: m.LocationSection }))
);
const StorytellingSection = lazy(() =>
  import("../components/StorytellingSection").then((m) => ({ default: m.StorytellingSection }))
);
const RulesSection = lazy(() =>
  import("../components/RulesSection").then((m) => ({ default: m.RulesSection }))
);
const FAQSection = lazy(() =>
  import("../components/faq/FAQSection").then((m) => ({ default: m.FAQSection }))
);
const InquiryForm = lazy(() =>
  import("../components/InquiryForm").then((m) => ({ default: m.InquiryForm }))
);
const CTASection = lazy(() =>
  import("../components/CTASection").then((m) => ({ default: m.CTASection }))
);
const ContactFooter = lazy(() => import("../components/ContactFooter"));

import SEOHead from "../../../shared/components/SEOHead";

/* Lightweight section fallback — only hides the broken section, not the whole page */
function SectionFallback({ name }) {
  return (
    <div
      style={{
        padding: "40px 24px",
        textAlign: "center",
        color: "var(--lp-text-muted)",
        fontSize: "13px",
      }}
    >
      {name} section is temporarily unavailable.
    </div>
  );
}

const LILYCREST_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Hostel",
      "@id": "https://www.lilycrest.space/#dormitory",
      "name": "Lilycrest Dormitory",
      "url": "https://www.lilycrest.space",
      "logo": "https://www.lilycrest.space/logo192.png",
      "image": "https://www.lilycrest.space/og-image.png",
      "description": "Affordable, safe, and fully-furnished dormitory rooms near universities in Makati, Philippines. Providing quality urban living with 24/7 security and high-speed internet.",
      "telephone": "+639123456789",
      "email": "lilycrestadmin@gmail.com",
      "priceRange": "₱3,500 - ₱15,000",
      "currenciesAccepted": "PHP",
      "paymentAccepted": "Bank Transfer, GCash, Maya, Cash",
      "checkinTime": "14:00",
      "checkoutTime": "12:00",
      "amenityFeature": [
        { "@type": "LocationFeatureSpecification", "name": "Air Conditioning", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "High-Speed Fiber WiFi", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "24/7 RFID Biometric Security", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Study Lounge", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Pantry & Microwave Station", "value": true },
        { "@type": "LocationFeatureSpecification", "name": "Drinking Water Refill", "value": true }
      ],
      "department": [
        {
          "@type": "Hostel",
          "name": "Lilycrest Gil Puyat Branch",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Sen. Gil J. Puyat Ave",
            "addressLocality": "Makati City",
            "addressRegion": "Metro Manila",
            "postalCode": "1200",
            "addressCountry": "PH"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": 14.5552,
            "longitude": 121.0003
          }
        },
        {
          "@type": "Hostel",
          "name": "Lilycrest Guadalupe Branch",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "1212, 9431 Magallanes, Brgy. Guadalupe Nuevo",
            "addressLocality": "Makati City",
            "addressRegion": "Metro Manila",
            "postalCode": "1212",
            "addressCountry": "PH"
          },
          "geo": {
            "@type": "GeoCoordinates",
            "latitude": 14.5618,
            "longitude": 121.0446
          }
        }
      ]
    },
    {
      "@type": "FAQPage",
      "@id": "https://www.lilycrest.space/#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "What are the room rates for Gil Puyat and Guadalupe branches?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Lilycrest offers Quadruple Sharing Rooms (₱3,500–₱4,200/bed/mo), Double Sharing Rooms (₱5,500–₱6,500/bed/mo), and Private Single Rooms (₱9,000–₱11,000/room/mo). All room tiers include air conditioning, private or shared bathrooms, study lockers, and fiber WiFi."
          }
        },
        {
          "@type": "Question",
          "name": "What is the initial deposit required to secure a reservation?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "To secure a room reservation, Lilycrest requires 1 Month Advance Rent and 1 Month Security Deposit with zero hidden processing charges. The deposit is 100% refundable upon contract completion following standard clearance."
          }
        },
        {
          "@type": "Question",
          "name": "What payment methods are accepted?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Online bank transfers (BDO, BPI, UnionBank), e-wallets (GCash, Maya), and over-the-counter cashier payments at the branch administrative office."
          }
        },
        {
          "@type": "Question",
          "name": "What are the building curfew hours and late entry rules?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Main biometric entrance doors lock securely at 11:00 PM and reopen at 5:00 AM daily. Night-shift professionals (BPO, Healthcare) and students with late classes can obtain late-entry passes."
          }
        },
        {
          "@type": "Question",
          "name": "Are visitors allowed inside the dormitory?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Registered daytime guests are welcome in the ground-floor study lounge and lobby from 8:00 AM to 8:00 PM. Visitors are strictly not permitted inside tenant bedrooms to preserve privacy and security."
          }
        },
        {
          "@type": "Question",
          "name": "Are pets and smoking permitted on the premises?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Lilycrest is 100% smoke-free and vape-free across all rooms, hallways, and common spaces. Pets are strictly prohibited to maintain a clean, quiet, and hypoallergenic environment."
          }
        }
      ]
    }
  ]
};

function LandingPageContent() {
  useEffect(() => {
    const rootTheme =
      document.documentElement.getAttribute("data-theme") ||
      (document.documentElement.classList.contains("dark") ? "dark" : "light");
    const landing = document.querySelector(".landing-page");
    if (landing && !landing.getAttribute("data-theme")) {
      landing.setAttribute("data-theme", rootTheme);
    }
  }, []);

  return (
    <div className="landing-page" style={{ overflowX: "hidden", backgroundColor: "var(--lp-bg)" }}>
      <SEOHead
        title="Home"
        description="Affordable, safe, and fully-furnished dormitory rooms near universities in Makati, Philippines. Book a visit today."
        structuredData={LILYCREST_STRUCTURED_DATA}
      />

      {/* A2: Skip-to-content link — visible only on keyboard focus */}
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          zIndex: 9999,
        }}
        onFocus={(e) => {
          Object.assign(e.currentTarget.style, {
            position: "fixed", left: "16px", top: "16px",
            width: "auto", height: "auto", overflow: "visible",
            padding: "12px 24px", backgroundColor: "var(--lp-accent)",
            color: "white", borderRadius: "8px", fontWeight: "600",
            fontSize: "14px", textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          });
        }}
        onBlur={(e) => {
          Object.assign(e.currentTarget.style, {
            position: "absolute", left: "-9999px", top: "auto",
            width: "1px", height: "1px", overflow: "hidden",
            padding: "", backgroundColor: "", color: "",
            borderRadius: "", fontWeight: "", fontSize: "",
            textDecoration: "", boxShadow: "",
          });
        }}
      >
        Skip to main content
      </a>

      <Navbar type="landing" currentPage="home" />

      {/* Main content target for skip link */}
      <main id="main-content" className="relative w-full">

        {/* 1. HOOK — Pinned Sticky Hero with Parallax Unveil */}
        <div className="sticky top-0 z-0 h-[100dvh] w-full overflow-hidden">
          <RouteErrorBoundary name="HeroSection" fallback={<SectionFallback name="Hero" />}>
            <HeroSection />
          </RouteErrorBoundary>
        </div>

        {/* Sliding Elevated Content Layer — Overlaps over the pinned Hero */}
        <div
          className="relative z-10 w-full rounded-t-[24px] lg:rounded-t-[36px] border-t border-[var(--lp-border)] shadow-[0_-12px_40px_rgba(0,0,0,0.12)] dark:shadow-[0_-16px_50px_rgba(0,0,0,0.5)]"
          style={{
            backgroundColor: "var(--lp-bg)",
            transform: "translate3d(0, 0, 0)",
            willChange: "transform",
          }}
        >
          {/* 2. FEATURES — Why choose us */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary
              name="JourneyHighlightsSection"
              fallback={<SectionFallback name="Journey" />}
            >
              <JourneyHighlightsSection />
            </RouteErrorBoundary>
          </div>

          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="BenefitsSection" fallback={<SectionFallback name="Benefits" />}>
              <BenefitsSection />
            </RouteErrorBoundary>
          </div>

          {/* 3. PRODUCT — What we offer */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="RoomInventory" fallback={<SectionFallback name="Rooms" />}>
              <RoomInventory />
            </RouteErrorBoundary>
          </div>

          {/* 4. FACILITIES — Shared spaces */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="FacilitiesSection" fallback={<SectionFallback name="Facilities" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '350px' }} />}>
                <FacilitiesSection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 5. CONVENIENCE — Where we are */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="LocationSection" fallback={<SectionFallback name="Location" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '350px' }} />}>
                <LocationSection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 7. STORY — Brand identity */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="StorytellingSection" fallback={<SectionFallback name="About" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '300px' }} />}>
                <StorytellingSection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 8. TRANSPARENCY — House rules */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="RulesSection" fallback={<SectionFallback name="Rules" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '300px' }} />}>
                <RulesSection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 9. FAQ — Instant answers & knowledge base */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="FAQSection" fallback={<SectionFallback name="FAQs" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '300px' }} />}>
                <FAQSection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 10. ACTION — Convert the visitor */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="InquiryForm" fallback={<SectionFallback name="Inquiry Form" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '300px' }} />}>
                <InquiryForm />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* 10. FINAL CTA */}
          <div style={{ borderBottom: '1px solid var(--lp-border)' }}>
            <RouteErrorBoundary name="CTASection" fallback={<SectionFallback name="CTA" />}>
              <Suspense fallback={<div className="py-12" style={{ minHeight: '200px' }} />}>
                <CTASection />
              </Suspense>
            </RouteErrorBoundary>
          </div>

          {/* FOOTER */}
          <RouteErrorBoundary name="ContactFooter" fallback={<SectionFallback name="Footer" />}>
            <Suspense fallback={<div className="py-8" style={{ minHeight: '200px' }} />}>
              <ContactFooter />
            </Suspense>
          </RouteErrorBoundary>

        </div>
      </main>

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
