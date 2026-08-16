import React, { useState, useMemo } from "react";
import {
  ChevronDown,
  Search,
  X,
  HelpCircle,
  Sparkles,
  Bot,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
} from "lucide-react";
import FAQCategoryTabs, { FAQ_CATEGORIES } from "./FAQCategoryTabs";

const FAQ_DATA = [
  {
    id: "faq-rates-1",
    category: "rates",
    question: "What are the room rates for Gil Puyat and Guadalupe branches?",
    answer:
      "Lilycrest offers three accommodation tiers across both branches:\n• **Quadruple Sharing Room (4 beds)**: ₱3,500 – ₱4,200 / bed / month\n• **Double Sharing Room (2 beds)**: ₱5,500 – ₱6,500 / bed / month\n• **Private Single Room**: ₱9,000 – ₱11,000 / room / month\n\nAll rates include fully air-conditioned rooms, personal study desks/lockers, en-suite bathrooms, and access to study lounges and high-speed fiber internet.",
  },
  {
    id: "faq-rates-2",
    category: "rates",
    question: "What is the initial deposit required to secure a reservation?",
    answer:
      "To secure your room reservation, Lilycrest requires **1-month advance rent** plus **1-month security deposit**. The security deposit is fully refundable at the end of your contract upon room clearance and settlement of final utility bills.",
  },
  {
    id: "faq-rates-3",
    category: "rates",
    question: "What payment methods are accepted?",
    answer:
      "We accept bank transfers (BDO, BPI, UnionBank), e-wallets (GCash, Maya), and over-the-counter payments at the branch administrative office. Proof of payment receipts must be uploaded in the tenant portal for automatic ledger verification.",
  },
  {
    id: "faq-policies-1",
    category: "policies",
    question: "What are the building curfew hours and late entry rules?",
    answer:
      "Our building security gate locks at **11:00 PM** and reopens at **5:00 AM**. For students with evening classes or professionals working night shifts (BPO/Healthcare), late entry passes are granted by submitting a company/student ID or written logging in advance.",
  },
  {
    id: "faq-policies-2",
    category: "policies",
    question: "Are visitors allowed inside the dormitory?",
    answer:
      "Registered daytime visitors are welcome in the **ground floor study lounge and cafeteria from 8:00 AM to 8:00 PM**. For resident security and privacy, non-resident visitors are strictly not permitted inside tenant dormitory bedrooms.",
  },
  {
    id: "faq-policies-3",
    category: "policies",
    question: "Are pets and smoking permitted on the premises?",
    answer:
      "Lilycrest enforces a **strict No-Smoking and No-Vaping policy** throughout all rooms and common areas. Pets are also strictly prohibited to maintain hygiene, quiet, and allergy-free shared living quarters.",
  },
  {
    id: "faq-reservation-1",
    category: "reservation",
    question: "How does the 5-step online reservation process work?",
    answer:
      "Applying for a room at Lilycrest is seamless and digital:\n1. **Room Selection**: Choose your branch, room type, and bed position.\n2. **Viewing Schedule / Waiver**: Pick an in-person viewing date or submit a remote waiver.\n3. **Tenant Details**: Submit your profile and valid government/student IDs.\n4. **Deposit Payment**: Upload transfer receipt proof for 1-mo advance + 1-mo deposit.\n5. **Admin Approval**: Branch management approves and issues your digital contract within 24–48 hours.",
  },
  {
    id: "faq-reservation-2",
    category: "reservation",
    question: "What documents and IDs are required for reservation?",
    answer:
      "Applicants must submit:\n• One (1) Primary Government ID (Passport, UMID, Driver's License, PhilID) OR Valid Student ID with Certificate of Registration (COR).\n• Emergency contact/guardian information.\n• Proof of enrollment or employment (for verification).",
  },
  {
    id: "faq-reservation-3",
    category: "reservation",
    question: "Can I schedule an in-person room viewing before applying?",
    answer:
      "Yes! You can schedule a guided physical branch viewing Monday through Saturday between 9:00 AM and 5:00 PM. Alternatively, you can take a 360 virtual room tour online directly on our room browsing page.",
  },
  {
    id: "faq-facilities-1",
    category: "facilities",
    question: "How are monthly electricity and water utility bills calculated?",
    answer:
      "Electricity and water meters are logged monthly on the **15th of each billing cycle**. Charges are calculated on a **pro-rata shared basis** among active occupants in the room, viewable in real-time through the tenant portal billing ledger.",
  },
  {
    id: "faq-facilities-2",
    category: "facilities",
    question: "Can I bring personal electric appliances (e.g. mini-fridge, rice cooker)?",
    answer:
      "Laptops, mobile phones, and desk lamps are included free with no additional charge. Higher-wattage appliances (e.g., mini-refrigerators, rice cookers, electric kettles, desktop PCs) must be declared and registered with a modest monthly appliance surcharge.",
  },
  {
    id: "faq-facilities-3",
    category: "facilities",
    question: "What security and shared amenities are provided?",
    answer:
      "Lilycrest premises include:\n• 24/7 RFID biometric entrance access\n• High-definition CCTV coverage in all hallways and common areas\n• 24-hour on-site security guard and duty receptionist\n• High-speed fiber WiFi zones throughout the building\n• Dedicated silent study lounge with charging stations\n• Shared kitchenette, microwave stations, and laundromat area",
  },
];

/**
 * FAQSection
 *
 * Searchable, categorized FAQ accordion section for the public Landing Page.
 * Employs solid HSL design tokens, 1px crisp borders, and zero gradients.
 */
export function FAQSection() {
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState("faq-rates-1");

  // Filter FAQs based on active category and search input
  const filteredFaqs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return FAQ_DATA.filter((item) => {
      const matchesCategory =
        activeCategory === "all" || item.category === activeCategory;
      const matchesQuery =
        !q ||
        item.question.toLowerCase().includes(q) ||
        item.answer.toLowerCase().includes(q);

      return matchesCategory && matchesQuery;
    });
  }, [activeCategory, searchQuery]);

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

  const handleOpenChatbot = (promptText = "") => {
    window.dispatchEvent(
      new CustomEvent("open-lilycrest-chatbot", {
        detail: { prompt: promptText || searchQuery },
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
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10">
          <p
            className="text-xs mb-3 tracking-widest uppercase font-semibold select-none"
            style={{ color: "var(--lp-accent, #D4AF37)" }}
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
            Find quick answers regarding room rates, deposits, house policies, and our 5-step digital reservation workflow.
          </p>
        </div>

        {/* Search Bar & AI Chatbot Prompt */}
        <div className="max-w-2xl mx-auto mb-8">
          <div
            className="relative flex items-center rounded-2xl p-1.5 shadow-sm transition-all"
            style={{
              backgroundColor: "var(--lp-bg-card, #ffffff)",
              border: "1px solid var(--lp-border, #E6D9B2)",
            }}
          >
            <Search className="w-5 h-5 ml-3 text-slate-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by keyword (e.g. rates, curfew, deposit, WiFi, pets)..."
              aria-label="Search frequently asked questions"
              className="w-full text-xs sm:text-sm py-2 px-3 bg-transparent outline-none"
              style={{ color: "var(--lp-text, #162f53)" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mr-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="max-w-4xl mx-auto mb-8 flex justify-center">
          <FAQCategoryTabs
            activeCategory={activeCategory}
            onSelectCategory={(catId) => setActiveCategory(catId)}
            counts={categoryCounts}
          />
        </div>

        {/* Accordion FAQ List */}
        <div className="max-w-3xl mx-auto space-y-3">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const isExpanded = expandedId === faq.id;

              return (
                <div
                  key={faq.id}
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
                  <button
                    type="button"
                    onClick={() => toggleItem(faq.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${faq.id}`}
                    className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
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
                        color: isExpanded ? "#ffffff" : "var(--lp-accent, #D4AF37)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  <div
                    id={`faq-answer-${faq.id}`}
                    className={`transition-all duration-200 ease-in-out ${
                      isExpanded ? "max-h-[500px] opacity-100 py-4 px-5 border-t" : "max-h-0 opacity-0 overflow-hidden p-0"
                    }`}
                    style={{
                      borderColor: "var(--lp-border, #E6D9B2)",
                      backgroundColor: "var(--lp-bg-alt, #ffffff)",
                    }}
                  >
                    <div
                      className="text-xs sm:text-sm leading-relaxed whitespace-pre-line"
                      style={{ color: "var(--lp-text-secondary, #475569)" }}
                    >
                      {faq.answer}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            /* Zero Search State */
            <div
              className="text-center py-12 px-6 rounded-2xl border"
              style={{
                backgroundColor: "var(--lp-bg-card, #ffffff)",
                borderColor: "var(--lp-border, #E6D9B2)",
              }}
            >
              <HelpCircle
                className="w-10 h-10 mx-auto mb-3 text-slate-400"
                style={{ color: "var(--lp-accent, #D4AF37)" }}
              />
              <h3
                className="text-base font-bold mb-1"
                style={{ color: "var(--lp-text, #162f53)" }}
              >
                No matching answers found
              </h3>
              <p
                className="text-xs sm:text-sm mb-5 max-w-md mx-auto"
                style={{ color: "var(--lp-text-secondary, #475569)" }}
              >
                We couldn't find a direct FAQ matching &ldquo;{searchQuery}&rdquo;. Would you like to ask our 24/7 AI Receptionist?
              </p>
              <button
                type="button"
                onClick={() => handleOpenChatbot(searchQuery)}
                className="inline-flex items-center gap-2 py-2.5 px-5 rounded-full text-xs sm:text-sm font-semibold text-white transition-all shadow-sm cursor-pointer"
                style={{
                  backgroundColor: "var(--lp-navy, #0A1628)",
                  border: "1px solid var(--lp-accent, #D4AF37)",
                }}
              >
                <Bot className="w-4 h-4 text-amber-400" />
                <span>Ask Lilycrest AI Assistant</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Helper Strip: Chatbot CTA */}
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
                backgroundColor: "var(--lp-navy, #0A1628)",
                border: "1px solid var(--lp-accent, #D4AF37)",
              }}
            >
              <Bot className="w-5 h-5 text-amber-400" />
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
                Our 24/7 AI Digital Receptionist is ready to help you in real time.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleOpenChatbot()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-2.5 px-5 rounded-full text-xs font-bold text-white transition-all cursor-pointer shadow-sm focus:outline-none flex-shrink-0"
            style={{
              backgroundColor: "var(--lp-navy, #0A1628)",
              border: "1px solid var(--lp-accent, #D4AF37)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Launch AI Assistant</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default FAQSection;
