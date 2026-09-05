import { Sparkles, Users, MapPin, ThumbsUp, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";
import hero1 from "../../../assets/images/hero1.webp";
import hero2 from "../../../assets/images/hero2.webp";
import hero3 from "../../../assets/images/hero3.webp";
import hero1Mobile from "../../../assets/images/hero1-mobile.webp";
import hero2Mobile from "../../../assets/images/hero2-mobile.webp";
import hero3Mobile from "../../../assets/images/hero3-mobile.webp";
import { smoothScrollTo } from "../../../shared/utils/smoothScroll";
import { ScrollReveal } from "../../../shared/components/ScrollReveal";


const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: [0.25, 0.1, 0.25, 1] },
});

/* Animated counter — always replays on scroll, easeOut curve */
function useCounter(target, duration = 2, isInView) {
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isInView) { setCount(0); setDone(false); return; }

    const startTime = performance.now();
    const ms = duration * 1000;
    const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);

    function tick(now) {
      const progress = Math.min((now - startTime) / ms, 1);
      setCount(Math.round(easeOutQuart(progress) * target));
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        setCount(target); setDone(true);
      }
    }
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isInView, target, duration]);

  return { count, done };
}

const stats = [
  { icon: Users, value: 100, suffix: "+", label: "Happy Tenants" },
  { icon: MapPin, value: 2, suffix: "", label: "Branches" },
  { icon: ThumbsUp, value: 98, suffix: "%", label: "Satisfaction Rate" },
];

const heroImages = [
  hero1,
  hero2,
  hero3,
];

const heroMobileImages = [
  hero1Mobile,
  hero2Mobile,
  hero3Mobile,
];

const SLIDE_DURATION = 6000;

export function HeroSection() {
  const statRef = useRef(null);
  const isInView = useInView(statRef, { margin: "-50px" });
  const [currentImage, setCurrentImage] = useState(0);
  const [zoomingImages, setZoomingImages] = useState({ 0: true });
  const [scrollProgress, setScrollProgress] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timerRef = useRef(null);

  // Detect prefers-reduced-motion preference
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener?.("change", handler);
    return () => mediaQuery.removeEventListener?.("change", handler);
  }, []);

  // rAF-debounced scroll listener for smooth 60fps parallax depth
  useEffect(() => {
    if (reducedMotion) return;
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const vh = window.innerHeight || 800;
          const currentScroll = window.scrollY || window.pageYOffset || 0;
          const progress = Math.min(Math.max(currentScroll / vh, 0), 1);
          setScrollProgress(progress);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % heroImages.length);
    }, SLIDE_DURATION);
  }, []);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [resetTimer]);

  // When currentImage changes: start zoom on new image, clean up old after 1.5s crossfade
  useEffect(() => {
    setZoomingImages((prev) => ({ ...prev, [currentImage]: true }));

    const timeout = setTimeout(() => {
      setZoomingImages({ [currentImage]: true });
    }, 1800);

    return () => clearTimeout(timeout);
  }, [currentImage]);

  const handleSlideSelect = (index) => {
    if (index === currentImage) return;
    setCurrentImage(index);
    resetTimer();
  };

  const heroOverlay = "var(--lp-hero-overlay)";
  const heroTextPrimary = "var(--lp-text)";
  const heroTextSecondary = "var(--lp-text-secondary)";
  const heroTextMuted = "var(--lp-text-muted)";

  const contentTranslateY = reducedMotion ? 0 : scrollProgress * -40;
  const contentOpacity = reducedMotion ? 1 : Math.max(1 - scrollProgress * 1.15, 0);
  const bgTranslateY = reducedMotion ? 0 : scrollProgress * 40;

  return (
    <>
      {/* Full-bleed Hero */}
      <section className="relative min-h-[100dvh] h-[100dvh] overflow-hidden flex items-center">
        {/* Background Slideshow with Responsive Picture Tag */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate3d(0, ${bgTranslateY}px, 0)`,
            willChange: "transform",
          }}
        >
          {heroImages.map((src, i) => (
            <div
              key={i}
              className="absolute inset-0"
              style={{
                opacity: currentImage === i ? 1 : 0,
                transition: "opacity 1.5s ease-in-out",
              }}
            >
              <picture>
                <source
                  media="(max-width: 768px)"
                  srcSet={heroMobileImages[i]}
                  type="image/webp"
                />
                <img
                  src={src}
                  alt={`Lilycrest Dormitory ${i + 1}`}
                  width="1920"
                  height="1080"
                  className={`w-full h-full object-cover ${
                    zoomingImages[i] ? "animate-ken-burns" : ""
                  }`}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchpriority={i === 0 ? "high" : "low"}
                  fetchPriority={i === 0 ? "high" : "low"}
                  decoding="async"
                  style={{
                    objectPosition: "center 68%",
                  }}
                />
              </picture>
            </div>
          ))}
        </div>

        {/* Dark overlay for text readability */}
        <div
          className="absolute inset-0"
          style={{
            background: heroOverlay,
          }}
        />

        {/* Content with GPU Parallax Depth & Opacity */}
        <div
          className="relative z-10 max-w-screen-2xl mx-auto px-5 sm:px-8 lg:px-12 w-full"
          style={{
            transform: `translate3d(0, ${contentTranslateY}px, 0)`,
            opacity: contentOpacity,
            willChange: "transform, opacity",
          }}
        >
          <div className="max-w-2xl pt-12 lg:pt-15">
            {/* Badge */}
            <ScrollReveal variant="fade-up" duration={0.9} delay={0.08}>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md mb-6 animate-hero-fade-up"
                style={{
                  backgroundColor: "var(--lp-badge-bg)",
                  border: "1px solid var(--lp-badge-border)",
                  boxShadow: "var(--lp-card-shadow)",
                }}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: "var(--lp-accent)" }} />
                <span
                  className="text-xs font-semibold tracking-[0.18em] uppercase"
                  style={{ color: heroTextPrimary }}
                >
                  Quality Urban Living
                </span>
              </div>
            </ScrollReveal>

            {/* Headline */}
            <ScrollReveal variant="fade-up" duration={1.0} delay={0.22}>
              <h1
                className="text-3xl sm:text-5xl lg:text-7xl font-medium leading-[1.12] mb-4 sm:mb-6 tracking-tight animate-hero-fade-up"
                style={{
                  color: heroTextPrimary,
                }}
              >
                Affordable, Safe,{" "}
                <span className="block">and Comfortable</span>
                <span style={{ color: "var(--lp-accent-text)" }}>Dormitory</span>
              </h1>
            </ScrollReveal>

            {/* Subheadline */}
            <ScrollReveal variant="fade-up" duration={1.0} delay={0.38}>
              <p
                className="text-base sm:text-lg mb-6 sm:mb-10 leading-relaxed font-light max-w-lg animate-hero-fade-up"
                style={{
                  color: heroTextSecondary,
                }}
              >
                Browse available rooms, create your account, and find your perfect
                home away from home.
              </p>
            </ScrollReveal>

            {/* CTA Buttons */}
            <ScrollReveal variant="fade-up" duration={1.0} delay={0.54}>
              <div
                className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6 animate-hero-fade-up"
              >
                <Link
                  to="/applicant/check-availability"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-medium text-sm sm:text-base transition-all duration-300 no-underline cursor-pointer"
                  style={{
                    minHeight: "48px",
                    color: "var(--lp-navy)",
                    backgroundColor: "var(--lp-accent)",
                    boxShadow: "0 4px 20px rgba(212, 175, 55, 0.25)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 6px 30px rgba(212, 175, 55, 0.4)";
                    e.currentTarget.style.transform =
                      "translateY(-2px) scale(1.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 20px rgba(212, 175, 55, 0.25)";
                    e.currentTarget.style.transform = "translateY(0) scale(1)";
                  }}
                >
                  Browse Available Rooms
                  <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </Link>
                <a
                  href="#inquiry"
                  onClick={(e) => {
                    e.preventDefault();
                    smoothScrollTo("inquiry", 80);
                  }}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 rounded-full font-semibold text-sm sm:text-base transition-all duration-300 cursor-pointer"
                  style={{
                    minHeight: "48px",
                    border: "1.5px solid var(--lp-hero-btn-border, var(--lp-border))",
                    color: heroTextPrimary,
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--lp-icon-bg)";
                    e.currentTarget.style.borderColor = "var(--lp-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                    e.currentTarget.style.borderColor = "var(--lp-hero-btn-border, var(--lp-border))";
                  }}
                >
                  Contact Us
                </a>
              </div>
            </ScrollReveal>

            {/* Reassurance */}
            <ScrollReveal variant="fade-up" duration={1.0} delay={0.68}>
              <p
                className="text-xs sm:text-sm font-normal mb-6 animate-hero-fade-up"
                style={{
                  color: heroTextMuted,
                }}
              >
                ✓ No hidden fees · ✓ Flexible terms · ✓ Visit first, decide later
              </p>
            </ScrollReveal>

            {/* Stats — enhanced glassmorphism strip */}
            <ScrollReveal variant="fade-up" duration={1.0} delay={0.82}>
              <div
                ref={statRef}
                className="inline-flex items-center gap-2 sm:gap-0 flex-wrap p-2 sm:p-2.5 sm:px-5 rounded-[50px] animate-hero-fade-up"
                style={{
                  background: "var(--lp-stats-bg)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid var(--lp-stats-border)",
                  boxShadow: "var(--lp-card-shadow)",
                }}
              >
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  return (
                    <div key={i} className="flex items-center">
                      {i > 0 && (
                        <div
                          className="mx-2 sm:mx-4 hidden sm:block"
                          style={{
                            width: '1px',
                            height: '24px',
                            backgroundColor: 'var(--lp-border)',
                          }}
                        />
                      )}
                      <StatItem
                        icon={Icon}
                        target={stat.value}
                        suffix={stat.suffix}
                        label={stat.label}
                        isInView={isInView}
                        delay={i * 0.15}
                      />
                    </div>
                  );
                })}
              </div>
            </ScrollReveal>
          </div>
        </div>

        {/* Slide Indicators — right side */}
        <div
          className="absolute z-10 hidden md:flex flex-col items-center gap-1"
          style={{ right: "40px", top: "50%", transform: "translateY(-50%)" }}
        >
          {heroImages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSlideSelect(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="flex items-center justify-center p-2 bg-transparent border-none cursor-pointer focus:outline-none"
              style={{ minWidth: "32px", minHeight: "32px" }}
            >
              <span
                style={{
                  display: "block",
                  width: "2px",
                  height: currentImage === i ? "32px" : "20px",
                  borderRadius: "1px",
                  backgroundColor: currentImage === i
                    ? "var(--lp-text)"
                    : "var(--lp-border)",
                  transition: "all 0.4s ease",
                }}
              />
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function StatItem({ icon: Icon, target, suffix, label, isInView, delay }) {
  const { count, done } = useCounter(target, 2, isInView);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      className="flex items-center gap-1.5 sm:gap-2"
    >
      <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" style={{ color: "var(--lp-accent)" }} />
      <motion.span
        animate={done ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="text-base sm:text-lg font-medium inline-block"
        style={{ color: done ? 'var(--lp-accent-text)' : 'var(--lp-text)' }}
      >
        {count}{suffix}
      </motion.span>
      <span className="text-xs sm:text-sm font-light whitespace-nowrap" style={{ color: 'var(--lp-text-muted)' }}>{label}</span>
    </motion.div>
  );
}
