import { Sparkles, Home, CheckCircle, Wifi, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { Link } from "react-router-dom";

export function HeroSection() {
  return (
    <section className="grid lg:grid-cols-2 h-[calc(100vh-80px)] overflow-hidden">
      {/* Left Side - Content */}
      <div
        className="flex flex-col justify-start px-10 lg:px-20 pt-16 pb-8"
        style={{ backgroundColor: "#0C375F" }}
      >
        <div className="max-w-xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm mb-5">
            <Sparkles className="w-4 h-4 text-white/90" />
            <span className="text-white/80 text-xs font-light tracking-wider uppercase">
              Premium Student Living
            </span>
          </div>

          {/* Headline — big and bold */}
          <h1 className="text-6xl lg:text-7xl font-light text-white leading-[1.08] mb-4 tracking-tight">
            Affordable, Safe, and Comfortable Dormitory
          </h1>

          {/* Subheadline */}
          <p className="text-white/70 text-lg mb-6 leading-relaxed font-light">
            Browse available rooms near your campus, create your account, and
            find your perfect home away from home.
          </p>

          {/* Compact feature highlights */}
          <p className="text-white/50 text-sm mb-6 font-light">
            24/7 Security · High-Speed WiFi · All-Inclusive
          </p>

          {/* Primary CTA */}
          <Link to="/applicant/check-availability">
            <Button
              size="lg"
              className="text-white px-10 py-6 gap-4 rounded-full font-normal text-base shadow-lg shadow-orange-900/20 hover:opacity-90"
              style={{ backgroundColor: "#E7710F" }}
            >
              Browse Available Rooms
            </Button>
          </Link>

          {/* Reassurance text */}
          <p className="text-white/40 text-xs mt-4 font-light">
            ✓ No hidden fees · ✓ Flexible terms · ✓ Visit first, decide later
          </p>
        </div>
      </div>

      {/* Right Side - Hero Image / Background */}
      <div className="relative overflow-hidden">
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
