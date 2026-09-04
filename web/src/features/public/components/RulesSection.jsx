import { Ban, Users, Sparkles, HeartHandshake, ShieldCheck, ReceiptText, AlertCircle } from 'lucide-react';
import {
  ScrollReveal,
  ScrollRevealStagger,
  ScrollRevealItem,
} from '../../../shared/components/ScrollReveal';

const rules = [
  {
    icon: Ban,
    title: 'No Smoking Policy',
    description: 'Smoking is strictly prohibited inside rooms and throughout the premises to ensure a clean and healthy environment.',
  },
  {
    icon: Users,
    title: 'Visitor Policy',
    description: 'Visitors are only allowed in designated areas, with room access restrictions depending on accommodation type.',
  },
  {
    icon: Sparkles,
    title: 'Cleanliness Responsibility',
    description: 'All tenants are expected to maintain cleanliness in their rooms and shared spaces at all times.',
  },
  {
    icon: HeartHandshake,
    title: 'Respect and Proper Conduct',
    description: 'Tenants must show respect to others and avoid any disruptive or inappropriate behavior.',
  },
  {
    icon: ShieldCheck,
    title: 'Security & RFID Usage',
    description: 'RFID access cards must be kept secure and not shared to maintain safety within the premises.',
  },
  {
    icon: ReceiptText,
    title: 'Payment & Compliance Policy',
    description: 'Timely rental payments and adherence to house rules are required to avoid penalties or contract termination.',
  }
];

export function RulesSection() {
  return (
    <section className="py-20 lg:py-24" style={{ backgroundColor: 'var(--lp-bg)' }}>
      <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 lg:px-12">
        {/* Header */}
        <ScrollReveal variant="fade-up">
          <div className="text-center mb-12">
            <p className="text-xs mb-3 tracking-widest uppercase font-medium" style={{ color: 'var(--lp-accent-text)' }}>
              Tenant Rules
            </p>
            <h2 className="text-3xl lg:text-4xl font-medium mb-5 tracking-tight" style={{ color: 'var(--lp-text)' }}>
              Rules & Policies
            </h2>
            <p className="max-w-2xl mx-auto font-normal leading-relaxed text-sm sm:text-base" style={{ color: 'var(--lp-text-secondary)' }}>
              Clear expectations for a safe, respectful, and well-managed living environment for everyone.
            </p>
          </div>
        </ScrollReveal>

        {/* Rules Feature Cards Grid */}
        <ScrollRevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6" staggerDelay={0.12}>
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            return (
              <ScrollRevealItem key={index} className="h-full">
                <div
                  className="rounded-2xl p-6 sm:p-7 flex flex-col items-start transition-all duration-300 hover:-translate-y-0.5 h-full select-none"
                  style={{
                    backgroundColor: 'var(--lp-bg-card)',
                    border: '1px solid var(--lp-border)',
                    boxShadow: 'var(--lp-card-shadow)',
                  }}
                >
                  {/* Top-aligned Icon Badge */}
                  <div
                    className="w-11 h-11 flex-shrink-0 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: 'var(--lp-icon-bg)' }}
                  >
                    <Icon className="w-5 h-5" style={{ color: 'var(--lp-accent)' }} />
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-medium tracking-tight mb-2" style={{ color: 'var(--lp-text)' }}>
                    {rule.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm font-normal leading-relaxed flex-1 m-0" style={{ color: 'var(--lp-text-secondary)' }}>
                    {rule.description}
                  </p>
                </div>
              </ScrollRevealItem>
            );
          })}
        </ScrollRevealStagger>

        {/* Important Warning — clean neutral border with standalone icon */}
        <ScrollReveal variant="fade-up" delay={0.2}>
          <div
            className="mt-10 p-6 rounded-2xl max-w-3xl mx-auto flex gap-4 items-start"
            style={{
              backgroundColor: 'var(--lp-bg-card)',
              border: '1px solid var(--lp-border)',
            }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--lp-accent-text)' }} />
            <p className="text-sm leading-relaxed m-0" style={{ color: 'var(--lp-text-secondary)' }}>
              <span className="font-semibold" style={{ color: 'var(--lp-text)' }}>Important: </span>
              Violation of house rules may result in warnings, fines, or termination of contract. We maintain these policies to ensure a safe and comfortable environment for all tenants.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default RulesSection;