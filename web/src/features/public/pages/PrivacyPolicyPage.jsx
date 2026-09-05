import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import SEOHead from "../../../shared/components/SEOHead";

export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--lp-bg)", color: "var(--lp-text)" }}>
      <SEOHead title="Privacy Policy" description="Read Lilycrest Dormitory's privacy policy — how we collect, use, and protect your personal information." />
      {/* Header */}
      <div style={{ backgroundColor: "var(--lp-bg-alt)", borderBottom: "1px solid var(--lp-border)" }} className="py-16 lg:py-20">
        <div className="max-w-screen-2xl mx-auto px-8 lg:px-12">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm mb-8 transition-colors"
            style={{ color: "var(--lp-text-muted)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl lg:text-5xl font-light tracking-tight" style={{ color: "var(--lp-text)" }}>
            Privacy Policy
          </h1>
          <p className="mt-3 font-light" style={{ color: "var(--lp-text-secondary)" }}>
            Last updated: March 2026
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-8 lg:px-12 py-16">
        <div className="prose prose-gray max-w-none space-y-8">
          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              1. Information We Collect
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              We collect information you provide directly to us when you fill
              out an inquiry form, create an account, make a reservation, or
              contact us. This may include your name, email address, phone
              number, preferred accommodation details, and payment information.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              2. How We Use Your Information
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              We use the information we collect to process your inquiries and
              reservations, manage your accommodation, communicate with you
              about your account and our services, improve our website and
              services, and comply with legal obligations.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              3. Information Sharing
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              We do not sell, trade, or rent your personal information to third
              parties. We may share your information only with service providers
              who assist us in operating our website and services, or when
              required by law.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              4. Data Security
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              We implement industry-standard security measures to protect your
              personal information from unauthorized access, alteration,
              disclosure, or destruction. However, no method of transmission
              over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              5. Cookies
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              Our website uses cookies to enhance your browsing experience.
              Cookies are small files stored on your device that help us
              understand how you use our website and improve our services.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              6. Your Rights
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              You have the right to access, correct, or delete your personal
              information at any time. You may also opt out of receiving
              communications from us. To exercise these rights, please contact
              us at lilycrestadmin@gmail.com.
            </p>
          </section>

          <section>
            <h2
              className="text-xl font-medium mb-4 tracking-tight"
              style={{ color: "var(--lp-text)" }}
            >
              7. Contact Us
            </h2>
            <p className="leading-relaxed font-light" style={{ color: "var(--lp-text-secondary)" }}>
              If you have any questions about this Privacy Policy, please
              contact us at lilycrestadmin@gmail.com or call us at +63 912 345 6789.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
