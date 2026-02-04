import { useState } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import InquiryModal from "../modals/InquiryModal";
import "../styles/faqs.css";

function FAQsPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [expandedFAQ, setExpandedFAQ] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  const faqData = [
    {
      id: 1,
      category: "Viewing & Reservation",
      question: "How do I schedule a viewing?",
      answer:
        "You can schedule a viewing by clicking the 'Reserve Now' button and filling out the inquiry form. Our team will contact you within 24 hours to confirm your viewing appointment.",
    },
    {
      id: 2,
      category: "Viewing & Reservation",
      question: "Is the reservation fee refundable?",
      answer:
        "The reservation fee is non-refundable once the room has been held for you. However, if we cannot accommodate your reservation, a full refund will be issued.",
    },
    {
      id: 3,
      category: "Viewing & Reservation",
      question: "How long is my reservation valid?",
      answer:
        "Your reservation is valid for 7 days from the date of payment. Within this period, you must complete the move-in process and sign the rental agreement.",
    },
    {
      id: 4,
      category: "Move In & Payment",
      question: "What do I need to bring when moving in?",
      answer:
        "Please bring a valid ID, proof of enrollment or employment, signed rental agreement, and first month's rent plus deposit. You should also bring personal items like bedding, toiletries, and clothing.",
    },
    {
      id: 5,
      category: "Move In & Payment",
      question: "When is rent due each month?",
      answer:
        "Rent is due on the 1st of each month. A grace period extends until the 5th. Late payments after the 5th may incur additional fees.",
    },
    {
      id: 6,
      category: "Move In & Payment",
      question: "What payment methods do you accept?",
      answer:
        "We accept cash, bank transfer, GCash, and credit/debit cards. Payment can be made in person at our office or through our online payment portal.",
    },
    {
      id: 7,
      category: "Rooms & Amenities",
      question: "What amenities are included?",
      answer:
        "All rooms include free Wi-Fi, air conditioning, bed with mattress, study desk, chair, and closet. Common areas include a kitchen, laundry area, and lounge.",
    },
    {
      id: 8,
      category: "Rooms & Amenities",
      question: "Are utilities included in the rent?",
      answer:
        "Water and Wi-Fi are included in the rent. Electricity is billed separately based on meter readings and will be divided among tenants in shared spaces.",
    },
    {
      id: 9,
      category: "Rules & Policies",
      question: "Can I have visitors?",
      answer:
        "Yes, visitors are allowed during designated hours (8 AM - 10 PM). Overnight guests require prior approval from management and may incur additional fees.",
    },
    {
      id: 10,
      category: "Rules & Policies",
      question: "Is smoking allowed?",
      answer:
        "No, smoking is strictly prohibited inside the dormitory premises. Designated smoking areas are available outside the building.",
    },
    {
      id: 11,
      category: "Move Out",
      question: "How much notice do I need to give before moving out?",
      answer:
        "Please provide at least 30 days notice before your intended move-out date.",
    },
    {
      id: 12,
      category: "Move Out",
      question: "Will I get my deposit back?",
      answer:
        "Your deposit will be refunded within 30 days of move-out, minus any deductions for damages or unpaid bills. A move-out inspection will be conducted to assess the room condition.",
    },
  ];

  const categories = [
    "All",
    "Viewing & Reservation",
    "Move In & Payment",
    "Rooms & Amenities",
    "Rules & Policies",
    "Move Out",
  ];

  const filteredFAQs = faqData.filter((faq) => {
    const matchesTab = activeTab === "All" || faq.category === activeTab;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const toggleFAQ = (id) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const handleCategoryClick = (category) => {
    setActiveTab(category);
    // Scroll to FAQ content section
    setTimeout(() => {
      document
        .querySelector(".faqs-content")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 0);
  };

  return (
    <div className="faqs-page">
      <Navbar type="landing" currentPage="faqs" />

      {/* Hero Section */}
      <section className="faqs-hero">
        <div className="faqs-hero-content">
          <h1>Frequently Asked Questions</h1>
          <p>Find answers to common questions about Lilycrest dormitories</p>

          <div className="faqs-search-bar">
            <svg
              className="search-icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="faqs-tabs-section">
        <div className="faqs-tabs">
          {categories.map((category) => (
            <button
              key={category}
              className={`faqs-tab ${activeTab === category ? "active" : ""}`}
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* FAQ Items */}
      <section className="faqs-content">
        <div className="faqs-container">
          {filteredFAQs.length > 0 ? (
            filteredFAQs.map((faq) => (
              <div key={faq.id} className="faq-item">
                <button
                  className="faq-question"
                  onClick={() => toggleFAQ(faq.id)}
                >
                  <div className="faq-question-content">
                    <span className="faq-category">{faq.category}</span>
                    <h3>{faq.question}</h3>
                  </div>
                  <svg
                    className={`faq-chevron ${expandedFAQ === faq.id ? "expanded" : ""}`}
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {expandedFAQ === faq.id && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-results">
              <p>No FAQs found matching your search.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="faqs-cta">
        <div className="faqs-cta-content">
          <h2>Still have questions?</h2>
          <p>
            Our team is here to help. Send us an inquiry and we'll get back to
            you shortly.
          </p>
          <button onClick={() => setIsModalOpen(true)} className="inquiry-btn">
            Inquiry / Learn More
          </button>
        </div>
      </section>

      <InquiryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <Footer />
    </div>
  );
}

export default FAQsPage;
