import { ArrowRight, BedDouble, MapPinned, MessageSquareMore } from "lucide-react";
import { Link } from "react-router-dom";
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from "../../../shared/components/ScrollReveal";

const STEPS = [
  {
    step: "01",
    title: "Browse the rooms that fit your budget",
    body: "Start with availability, room type, and branch so visitors can narrow choices quickly instead of reading the whole site first.",
    href: "#rooms",
    cta: "See room options",
    icon: BedDouble,
  },
  {
    step: "02",
    title: "Check location and shared amenities",
    body: "Compare the branch, nearby schools, and common spaces before committing to an inquiry.",
    href: "#location",
    cta: "Review locations",
    icon: MapPinned,
  },
  {
    step: "03",
    title: "Start an inquiry with the details already in mind",
    body: "Move directly into the contact flow once room fit and location are clear, with one consistent next step.",
    href: "#inquiry",
    cta: "Start inquiry",
    icon: MessageSquareMore,
  },
];

export function JourneyHighlightsSection() {
  return (
    <section
      className="py-16 lg:py-20"
      style={{
        backgroundColor: "var(--lp-bg-alt)",
      }}
    >
      <div className="max-w-screen-2xl mx-auto px-8 lg:px-12">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_1.7fr] xl:items-start">
          <div className="max-w-md">
            <ScrollReveal variant="fade-up">
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em]"
                style={{
                  color: "var(--lp-accent-text)",
                  backgroundColor: "var(--lp-icon-bg)",
                  border: "1px solid var(--lp-border)",
                }}
              >
                Easier Decision Path
              </span>
              <h2
                className="mt-5 text-3xl font-medium tracking-tight lg:text-4xl"
                style={{ color: "var(--lp-text)" }}
              >
                A clearer route from first visit to room inquiry.
              </h2>
              <p
                className="mt-4 text-base leading-7"
                style={{ color: "var(--lp-text-secondary)" }}
              >
                Lilycrest now guides visitors through room fit, branch confidence,
                and inquiry intent in a tighter sequence instead of a long,
                section-by-section scroll.
              </p>
            </ScrollReveal>

            <ScrollReveal variant="fade-up" delay={0.12}>
              <div
                className="mt-8 rounded-[28px] p-6"
                style={{
                  backgroundColor: "var(--lp-bg-card)",
                  border: "1px solid var(--lp-border)",
                  boxShadow: "var(--lp-card-shadow)",
                }}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div
                      className="text-xs font-semibold uppercase tracking-[0.2em]"
                      style={{ color: "var(--lp-text-muted)" }}
                    >
                      Dominant Action
                    </div>
                    <div
                      className="mt-2 text-xl font-medium"
                      style={{ color: "var(--lp-text)" }}
                    >
                      Browse rooms first
                    </div>
                  </div>
                  <Link
                    to="/applicant/check-availability"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold no-underline transition-transform duration-200 hover:scale-[1.02]"
                    style={{
                      color: "var(--lp-navy)",
                      backgroundColor: "var(--lp-accent)",
                    }}
                  >
                    Explore now
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </ScrollReveal>
          </div>

          <ScrollRevealStagger className="grid gap-6 md:grid-cols-3" staggerDelay={0.12}>
            {STEPS.map((item) => {
              const Icon = item.icon;
              return (
                <ScrollRevealItem key={item.step} className="h-full">
                  <a
                    href={item.href}
                    className="group flex h-full flex-col justify-between rounded-[28px] p-6 no-underline transition-transform duration-300 hover:-translate-y-1"
                    style={{
                      backgroundColor: "var(--lp-bg-card)",
                      border: "1px solid var(--lp-border)",
                      boxShadow: "var(--lp-card-shadow)",
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-4">
                        <span
                          className="text-xs font-semibold tracking-[0.24em]"
                          style={{ color: "var(--lp-text-muted)" }}
                        >
                          {item.step}
                        </span>
                        <span
                          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl"
                          style={{
                            backgroundColor: "var(--lp-icon-bg)",
                            color: "var(--lp-accent-text, #8C6200)",
                          }}
                        >
                          <Icon size={18} />
                        </span>
                      </div>

                      <h3
                        className="mt-10 text-xl font-medium leading-8"
                        style={{ color: "var(--lp-text)" }}
                      >
                        {item.title}
                      </h3>
                      <p
                        className="mt-4 text-sm leading-7"
                        style={{ color: "var(--lp-text-secondary)" }}
                      >
                        {item.body}
                      </p>
                    </div>

                    <span
                      className="mt-8 inline-flex items-center gap-2 text-sm font-semibold"
                      style={{ color: "var(--lp-accent-text)" }}
                    >
                      {item.cta}
                      <ArrowRight
                        size={15}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </span>
                  </a>
                </ScrollRevealItem>
              );
            })}
          </ScrollRevealStagger>
        </div>
      </div>
    </section>
  );
}

export default JourneyHighlightsSection;
