import { Home, Menu } from "lucide-react";
import { Button } from "./ui/button";
import { RippleButton } from "../../../registry/magicui/ripple-button";
import { useState } from "react";
import { Link } from "react-router-dom";

export function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-md"
      style={{ backgroundColor: "#0C375F" }}
    >
      <div className="max-w-7xl mx-auto px-8 lg:px-12 py-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center">
              <Home className="w-4 h-4" style={{ color: "#0C375F" }} />
            </div>
            <span className="font-semibold text-lg text-white tracking-wide">
              Lilycrest
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-12">
            <a
              href="#rooms"
              className="text-white/80 hover:text-white transition-colors text-sm font-light"
            >
              Rooms
            </a>
            <a
              href="#pricing"
              className="text-white/80 hover:text-white transition-colors text-sm font-light"
            >
              Pricing
            </a>
            <a
              href="#facilities"
              className="text-white/80 hover:text-white transition-colors text-sm font-light"
            >
              Facilities
            </a>
            <a
              href="#location"
              className="text-white/80 hover:text-white transition-colors text-sm font-light"
            >
              Location
            </a>
            <a
              href="#inquiry"
              className="text-white/80 hover:text-white transition-colors text-sm font-light"
            >
              Inquiry
            </a>
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <Link to="/signin">
              <RippleButton
                rippleColor="rgba(12, 55, 95, 0.4)"
                className="hidden md:block bg-white/90 backdrop-blur-sm hover:bg-white text-sm px-8 py-5 rounded-full font-light"
                style={{ color: "#0C375F" }}
              >
                Book Now
              </RippleButton>
            </Link>
            <button
              className="md:hidden text-white"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-6 bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-4">
            <a
              href="#rooms"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Rooms
            </a>
            <a
              href="#pricing"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Pricing
            </a>
            <a
              href="#facilities"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Facilities
            </a>
            <a
              href="#location"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Location
            </a>
            <a
              href="#testimonials"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Testimonials
            </a>
            <a
              href="#inquiry"
              className="block text-white hover:text-white/80 transition-colors font-light"
            >
              Inquiry
            </a>
            <Link to="/login">
              <RippleButton
                rippleColor="rgba(12, 55, 95, 0.4)"
                className="w-full bg-white rounded-full font-light"
                style={{ color: "#0C375F" }}
              >
                Book Now
              </RippleButton>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navigation;
