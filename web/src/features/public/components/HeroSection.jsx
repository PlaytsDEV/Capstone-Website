import { Sparkles, Home, CheckCircle, Wifi, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="grid lg:grid-cols-2 min-h-screen">
      {/* Left Side - Content */}
      <div
        className="flex flex-col justify-center px-8 lg:px-20 py-32 lg:py-20"
        style={{ backgroundColor: "#0C375F" }}
      >
        <div className="max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm mb-8">
            <Sparkles className="w-4 h-4 text-white/90" />
            <span className="text-white/80 text-xs font-light tracking-wider uppercase">
              Premium Student Living
            </span>
          </div>

          {/* Headline - Bold, clear statement */}
          <h1 className="text-5xl lg:text-6xl xl:text-7xl font-light text-white leading-[1.1] mb-6 tracking-tight">
            Affordable, Safe, and Comfortable Dormitory
          </h1>

          {/* Subheadline - Supporting line about process */}
          <p className="text-white/70 text-lg mb-10 leading-relaxed font-light">
            Browse available rooms near your campus, create your account, and
            schedule a visit to find your perfect home away from home.
          </p>

          {/* Optional Quick Info / Stats - Key features */}
          <div className="flex flex-wrap gap-6 mb-10 pb-10 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#E7710F" }}
              >
                <Shield className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/80 text-sm font-light">
                24/7 Security
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#E7710F" }}
              >
                <Wifi className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/80 text-sm font-light">
                High-Speed WiFi
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#E7710F" }}
              >
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <span className="text-white/80 text-sm font-light">
                All-Inclusive
              </span>
            </div>
          </div>

          {/* Primary CTA - Prominent button */}
          <div className="flex flex-wrap gap-6">
            <Link to="/browse-rooms">
              <Button
                size="lg"
                className="text-white px-10 py-6 gap-4 rounded-full font-normal text-base shadow-lg shadow-orange-900/20 hover:opacity-90"
                style={{ backgroundColor: "#E7710F" }}
              >
                Browse Available Rooms
              </Button>
            </Link>
            <Link to="/browse-rooms">
              <Button
                size="lg"
                variant="outline"
                className="px-12 py-6 bg-transparent border-2 border-white/30 text-white hover:bg-white/10 rounded-full font-light text-base"
              >
                Schedule a Visit
              </Button>
            </Link>
          </div>

          {/* Additional reassurance text */}
          <p className="text-white/40 text-xs mt-8 font-light">
            ✓ No hidden fees · ✓ Flexible terms · ✓ Visit first, decide later
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image / Background */}
      <div className="relative min-h-[500px] lg:min-h-screen">
        <img
          src="https://images.unsplash.com/photo-1651093791347-4898d49c573a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBkb3JtaXRvcnklMjBidWlsZGluZyUyMGV4dGVyaW9yfGVufDF8fHx8MTc3MDI2MDY1N3ww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Lilycrest Dormitory - Modern student housing with comfortable rooms and facilities"
          className="w-full h-full object-cover"
        />
        {/* Overlay gradient for better text visibility and trust building */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent"></div>

        {/* Floating trust badge */}
        <div className="absolute bottom-8 right-8 bg-white rounded-2xl p-6 shadow-2xl max-w-xs">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: "#DEF7EC" }}
            >
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="font-semibold" style={{ color: "#0C375F" }}>
                Trusted by Dormitory Residents
              </p>
              <p className="text-xs text-gray-500">500+ Happy Residents</p>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-light">
            Safe, clean, and affordable housing near major universities in Metro
            Manila.
          </p>
        </div>
      </div>
    </section>
  );
}
