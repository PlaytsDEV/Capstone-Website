import { Clock, Users, Volume2, Sparkles, Shield, AlertCircle } from 'lucide-react';

const rules = [
  {
    icon: Clock,
    title: 'Curfew Hours',
    description: 'Gate closes at 11:00 PM on weekdays, 12:00 AM on weekends. Late entry requires advance notice.',
    color: '#E7710F'
  },
  {
    icon: Users,
    title: 'Visitor Policy',
    description: 'Visitors allowed in common areas only from 9:00 AM to 9:00 PM. Register at reception desk.',
    color: '#0C375F'
  },
  {
    icon: Volume2,
    title: 'Quiet Hours',
    description: 'Maintain low noise levels from 10:00 PM to 7:00 AM to respect fellow residents.',
    color: '#EDB938'
  },
  {
    icon: Sparkles,
    title: 'Cleanliness',
    description: 'Keep your room and shared spaces clean. Weekly room inspection by management.',
    color: '#E7710F'
  },
  {
    icon: Shield,
    title: 'Security',
    description: 'Do not share access codes. Report suspicious activity immediately to staff.',
    color: '#0C375F'
  },
  {
    icon: AlertCircle,
    title: 'Prohibited Items',
    description: 'No illegal substances, weapons, or pets allowed. Cooking in rooms is strictly prohibited.',
    color: '#EDB938'
  }
];

export function RulesSection() {
  return (
    <section className="py-24 lg:py-32 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-7xl mx-auto px-8 lg:px-12">
        {/* Header */}
        <div className="text-center mb-20">
          <p className="text-xs text-gray-400 mb-3 tracking-widest uppercase font-light">House Guidelines</p>
          <h2 className="text-4xl lg:text-5xl font-light mb-5 tracking-tight" style={{ color: '#0C375F' }}>
            Rules & Policies
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-light leading-relaxed">
            Clear expectations for a safe, respectful, and harmonious living environment for everyone.
          </p>
        </div>

        {/* Rules Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            return (
              <div
                key={index}
                className="p-8 rounded-3xl bg-white border border-gray-100 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex gap-5">
                  <div
                    className="w-12 h-12 flex-shrink-0 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: `${rule.color}15` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: rule.color }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-normal mb-2 tracking-tight" style={{ color: '#0C375F' }}>
                      {rule.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed font-light">
                      {rule.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Additional Info */}
        <div className="mt-16 p-8 rounded-3xl bg-gradient-to-br from-gray-50 to-white border border-gray-100 max-w-3xl mx-auto">
          <p className="text-sm text-gray-600 leading-relaxed font-light text-center">
            <span className="font-normal" style={{ color: '#0C375F' }}>Important:</span> Violation of house rules may result in warnings, fines, or termination of contract. We maintain these policies to ensure a safe and comfortable environment for all residents.
          </p>
        </div>
      </div>
    </section>
  );
}

export default RulesSection;