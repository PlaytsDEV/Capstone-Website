import React, { useState, useMemo } from "react";
import { ChevronDown, Bot, ArrowRight, Sparkles } from "lucide-react";
import FAQCategoryTabs, { FAQ_CATEGORIES } from "./FAQCategoryTabs";
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from "../../../../shared/components/ScrollReveal";

const FAQ_DATA = [
  {
    id: "faq-rates-1",
    category: "rates",
    question: "What are the room rates for Gil Puyat and Guadalupe branches?",
    lead: "Lilycrest offers three accommodation tiers tailored for students and young professionals across both branches:",
    type: "bullets",
    items: [
      {
        title: "Quadruple Sharing Room (4 Beds)",
        description: "₱3,500 – ₱4,200 per bed / month. Ideal for students and colleagues seeking a cost-effective, collaborative space.",
      },
      {
        title: "Double Sharing Room (2 Beds)",
        description: "₱5,500 – ₱6,500 per bed / month. Balanced privacy and comfort with dedicated personal study workstations.",
      },
      {
        title: "Private Single Room",
        description: "₱9,000 – ₱11,000 per room / month. Exclusive accommodation with complete quiet and independent personal space.",
      },
    ],
    note: "All room tiers include full air conditioning, private en-suite bathroom, personal study desk and locker, study lounge access, and high-speed fiber internet.",
  },
  {
    id: "faq-rates-2",
    category: "rates",
    question: "What is the initial deposit required to secure a reservation?",
    lead: "To confirm and secure your chosen room reservation, Lilycrest requires standard move-in fees:",
    type: "bullets",
    items: [
      {
        title: "One (1) Month Advance Rent",
        description: "Directly applied to your first month of residency upon check-in.",
      },
      {
        title: "One (1) Month Security Deposit",
        description: "Held safely throughout your lease and 100% refundable upon contract completion following standard room clearance and final utility settlement.",
      },
    ],
    note: "Zero hidden processing charges or surprise reservation fees are billed during your application.",
  },
  {
    id: "faq-rates-3",
    category: "rates",
    question: "What payment methods are accepted?",
    lead: "We provide multiple fast, secure payment channels for your monthly rent and deposits:",
    type: "bullets",
    items: [
      {
        title: "Online Bank Transfers",
        description: "Direct bank deposit or InstaPay/PESONet to our official BDO, BPI, and UnionBank corporate accounts.",
      },
      {
        title: "E-Wallets",
        description: "Instant cashless payments via GCash and Maya QR / merchant codes.",
      },
      {
        title: "Over-the-Counter Cashier",
        description: "In-person cash or cheque settlements at the branch administrative office during business hours.",
      },
    ],
    note: "Simply upload your transfer receipt to the tenant portal for automated digital ledger verification and instant SMS/Email confirmation.",
  },
  {
    id: "faq-policies-1",
    category: "policies",
    question: "What are the building curfew hours and late entry rules?",
    lead: "Our branches enforce standard security hours to ensure resident safety, quiet study, and restful living:",
    type: "bullets",
    items: [
      {
        title: "Standard Gate Hours",
        description: "Main biometric entrance doors lock securely at 11:00 PM and reopen at 5:00 AM daily.",
      },
      {
        title: "Night Shift & Late Class Passes",
        description: "Students with late university schedules or professionals on night shifts (BPO, Healthcare, Aviation) can obtain regular late-entry privileges by presenting their valid institutional ID.",
      },
    ],
    note: "24/7 on-duty lobby security guards assist verified late entrants with zero hassle.",
  },
  {
    id: "faq-policies-2",
    category: "policies",
    question: "Are visitors allowed inside the dormitory?",
    lead: "We welcome daytime visitors under clear guidelines that preserve resident privacy and community security:",
    type: "bullets",
    items: [
      {
        title: "Designated Visiting Areas",
        description: "Registered daytime guests are welcome in the ground-floor study lounge, reception lobby, and cafeteria from 8:00 AM to 8:00 PM.",
      },
      {
        title: "Bedroom Privacy Policy",
        description: "To safeguard personal belongings, privacy, and quiet study quarters, non-resident visitors are strictly not permitted inside tenant dormitory bedrooms.",
      },
    ],
  },
  {
    id: "faq-policies-3",
    category: "policies",
    question: "Are pets and smoking permitted on the premises?",
    lead: "Lilycrest maintains strict health, hygiene, and environmental standards across all properties:",
    type: "bullets",
    items: [
      {
        title: "100% Smoke-Free & Vape-Free",
        description: "Smoking, vaping, and electronic cigarettes are strictly prohibited across all private bedrooms, hallways, balconies, and common facilities.",
      },
      {
        title: "No Pets Policy",
        description: "Pets are strictly prohibited to maintain a clean, quiet, and hypoallergenic shared living environment for all residents.",
      },
    ],
  },
  {
    id: "faq-reservation-1",
    category: "reservation",
    question: "How does the 5-step online reservation process work?",
    lead: "Applying for a room at Lilycrest is 100% digital, transparent, and hassle-free:",
    type: "steps",
    items: [
      {
        step: 1,
        title: "Room & Bed Selection",
        description: "Choose your preferred branch (Gil Puyat or Guadalupe), accommodation tier, and available bed position.",
      },
      {
        step: 2,
        title: "Viewing Schedule or Remote Waiver",
        description: "Book an in-person branch viewing with our staff or accept the remote virtual tour waiver to proceed immediately.",
      },
      {
        step: 3,
        title: "Tenant Profile & Verification",
        description: "Complete your tenant profile information and upload your valid government or student ID.",
      },
      {
        step: 4,
        title: "Advance & Deposit Payment",
        description: "Settle your initial 1-month advance and 1-month security deposit via bank transfer, e-wallet, or cashier.",
      },
      {
        step: 5,
        title: "Approval & Digital Contract",
        description: "Branch administration reviews your application within 24–48 hours and issues your signed digital lease agreement.",
      },
    ],
  },
  {
    id: "faq-reservation-2",
    category: "reservation",
    question: "What documents and IDs are required for reservation?",
    lead: "Applicants are required to submit the following credentials during online application:",
    type: "bullets",
    items: [
      {
        title: "Valid Primary ID",
        description: "One (1) valid government-issued ID (Passport, UMID, Driver's License, PhilID) OR student ID paired with your latest Certificate of Registration (COR).",
      },
      {
        title: "Emergency Contact Details",
        description: "Complete contact information and relationship of a parent, guardian, or designated emergency contact person.",
      },
      {
        title: "Proof of Enrollment or Employment",
        description: "Current university registration slip or company employment certificate for background verification.",
      },
    ],
    note: "All documents can be quickly photographed or uploaded as PDF/PNG directly through our secure registration portal.",
  },
  {
    id: "faq-reservation-3",
    category: "reservation",
    question: "Can I schedule an in-person room viewing before applying?",
    lead: "Yes, we encourage prospective residents to tour our facilities before making a final decision:",
    type: "bullets",
    items: [
      {
        title: "Guided In-Person Tours",
        description: "Available Monday through Saturday from 9:00 AM to 5:00 PM. Our branch staff will guide you through available rooms, study spaces, and amenities.",
      },
      {
        title: "360° Virtual Tours",
        description: "Explore interactive 360-degree room tours directly on our website from any device at any time.",
      },
    ],
  },
  {
    id: "faq-facilities-1",
    category: "facilities",
    question: "How are monthly electricity and water utility bills calculated?",
    lead: "Utilities are metered with complete transparency and zero hidden markups:",
    type: "bullets",
    items: [
      {
        title: "Sub-Metered Logging",
        description: "Individual room electricity and water meters are officially logged on the 15th of every monthly billing cycle.",
      },
      {
        title: "Pro-Rata Occupancy Split",
        description: "Total monthly consumption is divided equally among active registered roommates, viewable with itemized meter breakdowns on your tenant billing dashboard.",
      },
    ],
  },
  {
    id: "faq-facilities-2",
    category: "facilities",
    question: "Can I bring personal electric appliances?",
    lead: "Essential personal electronics are welcome with zero added charges:",
    type: "bullets",
    items: [
      {
        title: "Free of Charge",
        description: "Laptops, smartphones, tablets, study desk lamps, and electric shavers are completely free.",
      },
      {
        title: "Registered Appliances",
        description: "Higher-wattage appliances (such as mini-refrigerators, rice cookers, electric kettles, and desktop PCs) must be declared with branch administration for a modest monthly utility surcharge.",
      },
    ],
  },
  {
    id: "faq-facilities-3",
    category: "facilities",
    question: "What security and shared amenities are provided?",
    lead: "Every Lilycrest branch is equipped with modern facilities designed for comfort and peace of mind:",
    type: "bullets",
    items: [
      {
        title: "24/7 Security & Access",
        description: "RFID biometric turnstile entrance, HD CCTV security cameras in all corridors, and 24-hour on-site security personnel.",
      },
      {
        title: "Study & High-Speed Connectivity",
        description: "Air-conditioned silent study lounges with dedicated charging points and high-speed fiber WiFi zones throughout.",
      },
      {
        title: "Communal Living Amenities",
        description: "Pantry microwave stations, shared refrigerators, drinking water refill stations, and on-premise laundromat facilities.",
      },
    ],
  },
];

/**
 * FAQItemContent
 *
 * Renders structured FAQ details with elegant typography,
 * custom gold bullet accents, step badges, and tip cards.
 */
function FAQItemContent({ item }) {
  return (
    <div className="space-y-3 text-xs sm:text-sm">
      {item.lead && (
        <p
          className="font-medium leading-relaxed"
          style={{ color: "var(--lp-text, #162f53)" }}
        >
          {item.lead}
        </p>
      )}

      {item.type === "steps" && item.items && (
        <div className="space-y-2.5 pt-1">
          {item.items.map((step) => (
            <div key={step.step} className="flex items-start gap-3">
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
                style={{
                  backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.15))",
                  color: "var(--lp-accent, #D4AF37)",
                  border: "1px solid var(--lp-border, #E6D9B2)",
                }}
              >
                {step.step}
              </span>
              <div className="flex-1 leading-relaxed">
                <span
                  className="font-semibold"
                  style={{ color: "var(--lp-text, #162f53)" }}
                >
                  {step.title}
                </span>
                <span
                  className="text-slate-400 mx-1.5 select-none"
                  aria-hidden="true"
                >
                  —
                </span>
                <span style={{ color: "var(--lp-text-secondary, #475569)" }}>
                  {step.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {item.type === "bullets" && item.items && (
        <ul className="space-y-2.5 pt-1">
          {item.items.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-3">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2"
                style={{ backgroundColor: "var(--lp-accent, #D4AF37)" }}
              />
              <div className="flex-1 leading-relaxed">
                <span
                  className="font-semibold"
                  style={{ color: "var(--lp-text, #162f53)" }}
                >
                  {bullet.title}
                </span>
                {bullet.title && bullet.description && (
                  <span
                    className="text-slate-400 mx-1.5 select-none"
                    aria-hidden="true"
                  >
                    :
                  </span>
                )}
                <span style={{ color: "var(--lp-text-secondary, #475569)" }}>
                  {bullet.description}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {item.note && (
        <div
          className="mt-3 p-3 sm:p-3.5 rounded-xl text-xs leading-relaxed flex items-start gap-2.5"
          style={{
            backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.08))",
            border: "1px solid var(--lp-border, #E6D9B2)",
          }}
        >
          <span
            className="font-bold flex-shrink-0"
            style={{ color: "var(--lp-accent, #D4AF37)" }}
          >
            Tip:
          </span>
          <span style={{ color: "var(--lp-text-secondary, #475569)" }}>
            {item.note}
          </span>
        </div>
      )}

      {/* Fallback render */}
      {!item.type && item.answer && (
        <div
          className="leading-relaxed whitespace-pre-line"
          style={{ color: "var(--lp-text-secondary, #475569)" }}
        >
          {item.answer}
        </div>
      )}
    </div>
  );
}

/**
 * FAQSection
 *
 * Categorized FAQ accordion section for the public Landing Page.
 * Employs solid HSL design tokens, 1px crisp borders, and zero gradients.
 */
export function FAQSection() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedId, setExpandedId] = useState("faq-rates-1");

  // Filter FAQs based on active category
  const filteredFaqs = useMemo(() => {
    return FAQ_DATA.filter((item) => {
      return activeCategory === "all" || item.category === activeCategory;
    });
  }, [activeCategory]);

  // Compute category count breakdown
  const categoryCounts = useMemo(() => {
    const counts = { all: FAQ_DATA.length };
    FAQ_CATEGORIES.forEach((c) => {
      if (c.id !== "all") {
        counts[c.id] = FAQ_DATA.filter((f) => f.category === c.id).length;
      }
    });
    return counts;
  }, []);

  const toggleItem = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleSelectCategory = (catId) => {
    setActiveCategory(catId);
    // Auto-expand first item in selected category
    const firstInCat =
      catId === "all"
        ? FAQ_DATA[0]?.id
        : FAQ_DATA.find((f) => f.category === catId)?.id;
    if (firstInCat) {
      setExpandedId(firstInCat);
    }
  };

  const handleOpenChatbot = (promptText = "") => {
    window.dispatchEvent(
      new CustomEvent("open-lilycrest-chatbot", {
        detail: { prompt: promptText },
      })
    );
  };

  return (
    <section
      id="faqs"
      className="py-20 lg:py-24 transition-colors duration-200"
      style={{ backgroundColor: "var(--lp-bg, #ffffff)" }}
    >
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Section Header & Category Filter Tabs */}
        <ScrollReveal variant="fade-up">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
            <p
              className="text-xs mb-3 tracking-widest uppercase font-semibold select-none"
              style={{ color: "var(--lp-accent-text, #8C6200)" }}
            >
              Instant Answers
            </p>
            <h2
              className="text-3xl lg:text-4xl font-bold mb-4 tracking-tight"
              style={{ color: "var(--lp-text, #162f53)" }}
            >
              Frequently Asked Questions
            </h2>
            <p
              className="text-sm sm:text-base font-normal leading-relaxed"
              style={{ color: "var(--lp-text-secondary, #475569)" }}
            >
              Find clear, verified information regarding accommodation rates, security deposits, house policies, and our 5-step digital reservation workflow.
            </p>
          </div>

          {/* Category Filter Tabs */}
          <div className="max-w-4xl mx-auto mb-8 sm:mb-10 flex justify-center">
            <FAQCategoryTabs
              activeCategory={activeCategory}
              onSelectCategory={handleSelectCategory}
              counts={categoryCounts}
            />
          </div>
        </ScrollReveal>

        {/* Accordion FAQ List */}
        <ScrollRevealStagger className="space-y-4 max-w-4xl mx-auto" staggerDelay={0.12}>
          {filteredFaqs.map((faq) => {
            const isExpanded = expandedId === faq.id;

            return (
              <ScrollRevealItem key={faq.id}>
                <div
                  className="rounded-2xl transition-all duration-200 overflow-hidden"
                  style={{
                    backgroundColor: "var(--lp-bg-card, #ffffff)",
                    border: isExpanded
                      ? "1px solid var(--lp-accent, #D4AF37)"
                      : "1px solid var(--lp-border, #E6D9B2)",
                    boxShadow: isExpanded
                      ? "0 4px 14px rgba(10, 22, 40, 0.06)"
                      : "var(--lp-card-shadow, 0 1px 3px rgba(0,0,0,0.04))",
                  }}
                >
                  <h3 className="m-0 p-0 font-normal">
                    <button
                      id={`faq-question-${faq.id}`}
                      type="button"
                      onClick={() => toggleItem(faq.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`faq-answer-${faq.id}`}
                      className="w-full py-4 px-5 sm:px-6 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                    >
                      <span
                        className="text-sm sm:text-base font-semibold tracking-tight leading-snug"
                        style={{ color: "var(--lp-text, #162f53)" }}
                      >
                        {faq.question}
                      </span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200"
                        style={{
                          backgroundColor: isExpanded
                            ? "var(--lp-navy, #0A1628)"
                            : "var(--lp-icon-bg, rgba(212, 175, 55, 0.1))",
                          color: isExpanded ? "#ffffff" : "var(--lp-accent-text, #8C6200)",
                          transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </button>
                  </h3>

                  {/* Collapsible Content */}
                  <div
                    id={`faq-answer-${faq.id}`}
                    role="region"
                    aria-labelledby={`faq-question-${faq.id}`}
                    className={`transition-all duration-200 ease-in-out ${
                      isExpanded
                        ? "max-h-[800px] opacity-100 py-4 sm:py-5 px-5 sm:px-6 border-t"
                        : "max-h-0 opacity-0 overflow-hidden p-0"
                    }`}
                    style={{
                      borderColor: "var(--lp-border, #E6D9B2)",
                      backgroundColor: "var(--lp-bg-alt, #ffffff)",
                    }}
                  >
                    <FAQItemContent item={faq} />
                  </div>
                </div>
              </ScrollRevealItem>
            );
          })}
        </ScrollRevealStagger>

        {/* Bottom Helper Strip: Chatbot CTA */}
        <ScrollReveal variant="fade-up" delay={0.15}>
          <div
            className="mt-12 max-w-3xl mx-auto p-6 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-sm"
            style={{
              backgroundColor: "var(--lp-bg-card, #ffffff)",
              border: "1px solid var(--lp-border, #E6D9B2)",
            }}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  backgroundColor: "var(--lp-icon-bg, rgba(212, 175, 55, 0.14))",
                  border: "1px solid var(--lp-accent, #D4AF37)",
                }}
              >
                <Bot className="w-5 h-5 text-amber-600 dark:text-amber-500" />
              </div>
              <div>
                <h4
                  className="text-sm sm:text-base font-bold"
                  style={{ color: "var(--lp-text, #162f53)" }}
                >
                  Still have unanswered questions?
                </h4>
                <p
                  className="text-xs"
                  style={{ color: "var(--lp-text-secondary, #475569)" }}
                >
                  Our 24/7 Lilycrest AI Chatbot is ready to help you in real time.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChatbot()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-full text-xs font-bold text-white transition-all cursor-pointer shadow-sm focus:outline-none flex-shrink-0"
              style={{
                backgroundColor: "var(--lp-accent, #D4AF37)",
                border: "1px solid var(--lp-accent, #D4AF37)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <Bot className="w-4 h-4 text-white" />
              <span>Ask Lilycrest AI Chatbot</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default FAQSection;


