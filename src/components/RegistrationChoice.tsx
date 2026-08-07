import { Bike, User, Building2, ChevronRight } from 'lucide-react';
import AuthHeader from './AuthHeader';
import Footer from './Footer';

type RegistrationChoiceProps = {
  onNavigate: (page: string) => void;
};

export default function RegistrationChoice({ onNavigate }: RegistrationChoiceProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="registration-choice" />

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold text-slate-900 mb-3">
            How are you registering?
          </h1>
          <p className="text-base text-slate-600 max-w-xl mx-auto">
            Pick the option that best describes you. You can always add more details from your dashboard after the 2-minute sign-up.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <ChoiceCard
            gradient="from-emerald-500 to-teal-600"
            hoverBorder="hover:border-emerald-500"
            icon={<User className="h-8 w-8 text-white" />}
            tag="Individual"
            title="Individual Owner"
            description="You own one or more motorcycles in your personal name and want to manage them on the platform."
            features={['National ID required', 'Personal KRA PIN', 'Next of kin contact', 'QR code per motorcycle']}
            cta="Register as Individual"
            ctaColor="text-emerald-600"
            onClick={() => onNavigate('register')}
          />

          <ChoiceCard
            gradient="from-blue-500 to-indigo-600"
            hoverBorder="hover:border-blue-500"
            icon={<Building2 className="h-8 w-8 text-white" />}
            tag="Company / SACCO"
            title="Business or Fleet"
            description="A registered company, SACCO, or fleet operator managing multiple motorcycles under a business name."
            features={['Business registration no.', 'Company KRA PIN', 'Authorised contact person', 'Certificate of incorporation']}
            cta="Register a Business"
            ctaColor="text-blue-600"
            onClick={() => onNavigate('register')}
          />

          <ChoiceCard
            gradient="from-slate-600 to-slate-800"
            hoverBorder="hover:border-slate-500"
            icon={<Bike className="h-8 w-8 text-white" />}
            tag="Rider"
            title="Rider Only"
            description="Register as a rider without a motorcycle. You can be assigned to a motorcycle later by an owner."
            features={['Driving licence required', 'National ID', 'KRA PIN required', 'Rider dashboard access']}
            cta="Register as Rider"
            ctaColor="text-slate-700"
            onClick={() => onNavigate('rider-registration')}
          />
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Not sure? Individual and Business owners both use the same quick 2-minute sign-up — you choose your type on the next screen.
        </p>
      </div>
      <Footer />
    </div>
  );
}

function ChoiceCard({
  gradient, hoverBorder, icon, tag, title, description, features, cta, ctaColor, onClick,
}: {
  gradient: string;
  hoverBorder: string;
  icon: React.ReactNode;
  tag: string;
  title: string;
  description: string;
  features: string[];
  cta: string;
  ctaColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group bg-white rounded-2xl p-7 shadow-sm hover:shadow-xl transition-all duration-300 border-2 border-slate-200 ${hoverBorder} text-left flex flex-col`}
    >
      <div className={`bg-gradient-to-br ${gradient} rounded-xl w-14 h-14 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform shadow-md`}>
        {icon}
      </div>

      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">{tag}</span>

      <h2 className="text-xl font-display font-bold text-slate-900 mb-2 group-hover:text-inherit transition-colors">
        {title}
      </h2>

      <p className="text-sm text-slate-500 mb-5 leading-relaxed flex-1">
        {description}
      </p>

      <ul className="space-y-1.5 mb-6">
        {features.map(f => (
          <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300 flex-shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      <div className={`inline-flex items-center font-semibold text-sm ${ctaColor} group-hover:translate-x-1 transition-transform`}>
        {cta}
        <ChevronRight className="h-4 w-4 ml-1" />
      </div>
    </button>
  );
}
