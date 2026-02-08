import Navbar from "../components/Navbar";
import { ContactFooter } from "../components/ContactFooter";
import { HeroSection } from "../components/HeroSection";
import { BenefitsSection } from "../components/BenefitsSection";
import { RoomInventory } from "../components/RoomInventory";
import { PricingSection } from "../components/PricingSection";
import { FacilitiesSection } from "../components/FacilitiesSection";
import { LocationSection } from "../components/LocationSection";
import { RulesSection } from "../components/RulesSection";
import { StorytellingSection } from "../components/StorytellingSection";
import { GuaranteeSection } from "../components/GuaranteeSection";
import { InquiryForm } from "../components/InquiryForm";
import { CTASection } from "../components/CTASection";

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar type="landing" currentPage="home" />
      <HeroSection />
      <BenefitsSection />
      <RoomInventory />
      <PricingSection />
      <FacilitiesSection />
      <LocationSection />
      <RulesSection />
      <StorytellingSection />
      <GuaranteeSection />
      <InquiryForm />
      <CTASection />
      <ContactFooter />
    </div>
  );
}

export default LandingPage;
