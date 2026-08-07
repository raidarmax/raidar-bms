import { useState } from 'react';
import {
  AlertTriangle, Search, Bike, User, CheckCircle, XCircle, ArrowRight,
  ShieldAlert, Info, MapPin, ArrowLeft,
} from 'lucide-react';
import { supabase, type Motorcycle, type Rider, type Owner } from '../lib/supabase';
import IncidentReportModal from './IncidentReportModal';
import AuthHeader from './AuthHeader';

type ReportIncidentPageProps = {
  onNavigate: (page: string) => void;
};

type FoundBike = {
  motorcycle: Motorcycle | null;
  rider: Rider | null;
  owner: Owner | null;
};

export default function ReportIncidentPage({ onNavigate }: ReportIncidentPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [found, setFound] = useState<FoundBike | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [reportUnregistered, setReportUnregistered] = useState(false);

  const handleSearch = async () => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchError('Enter a motorcycle registration or rider ID number to search.');
      return;
    }

    setSearching(true);
    setSearchError('');
    setFound(null);
    setAttempted(true);

    try {
      const cleaned = term.replace(/\s+/g, '');
      let motorcycle: Motorcycle | null = null;
      let rider: Rider | null = null;
      let ownerId: string | null = null;

      const { data: motorcycles } = await supabase.from('motorcycles').select('*');
      const matched = motorcycles?.find(
        (m) => m.registration_number.replace(/\s+/g, '').toLowerCase() === cleaned.toLowerCase(),
      );

      if (matched) {
        motorcycle = matched;
        ownerId = matched.owner_id;
        const { data: riderMatch } = await supabase
          .from('riders')
          .select('*')
          .eq('motorcycle_id', matched.id)
          .maybeSingle();
        rider = riderMatch ?? null;
      } else {
        const { data: riderMatch } = await supabase
          .from('riders')
          .select('*')
          .ilike('id_number', term)
          .maybeSingle();
        if (riderMatch) {
          rider = riderMatch;
          ownerId = riderMatch.owner_id;
          if ((riderMatch as any).motorcycle_id) {
            const { data: m } = await supabase
              .from('motorcycles')
              .select('*')
              .eq('id', (riderMatch as any).motorcycle_id)
              .maybeSingle();
            motorcycle = m ?? null;
          }
        }
      }

      let owner: Owner | null = null;
      if (ownerId) {
        const { data: o } = await supabase.from('owners').select('*').eq('id', ownerId).maybeSingle();
        owner = o ?? null;
      }

      if (!motorcycle && !rider) {
        setFound(null);
      } else {
        setFound({ motorcycle, rider, owner });
      }
    } catch (err) {
      console.error('Report search error:', err);
      setSearchError('We could not complete the search. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const openReportForFound = () => {
    setReportUnregistered(false);
    setShowModal(true);
  };

  const openReportUnregistered = () => {
    setReportUnregistered(true);
    setShowModal(true);
  };

  const resetSearch = () => {
    setSearchTerm('');
    setAttempted(false);
    setFound(null);
    setSearchError('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="report-incident" />

      <div className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-orange-50">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-red-100 rounded-full opacity-30 translate-x-1/3 -translate-y-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-orange-100 rounded-full opacity-25 -translate-x-1/3 translate-y-1/3 blur-3xl pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
            <button
              onClick={() => onNavigate('home')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 mb-6 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </button>

            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 border border-red-200 rounded-full text-sm font-semibold text-red-700 mb-5">
              <ShieldAlert className="h-4 w-4" />
              Confidential incident reporting
            </div>

            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight mb-4">
              Report an incident
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
              Witnessed an accident, theft, harassment, or a traffic offence? Search for the
              motorcycle by registration or rider ID, or file a report with whatever details you
              can remember. Your phone number is verified before submission to prevent abuse.
            </p>
          </div>
        </section>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 -mt-2">
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-6 sm:p-8 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Step 1 — Try to identify the motorcycle</h2>
              <p className="text-sm text-slate-500 mb-5">
                If you have the number plate or the rider's national ID, search for them so the
                report is linked to the right registration. If you don't, skip to Step 2.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="e.g. KAA 123A or 12345678"
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {searching ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Searching…
                    </>
                  ) : (
                    <>
                      <Search className="h-5 w-5" />
                      Search
                    </>
                  )}
                </button>
              </div>

              {searchError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {searchError}
                </div>
              )}
            </div>

            {attempted && found && (
              <div className="p-6 sm:p-8 bg-emerald-50/50 border-b border-slate-100 space-y-4">
                <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                  <CheckCircle className="h-5 w-5" />
                  Registration found — you can attach your report to this bike
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Bike className="h-4 w-4 text-emerald-700" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Motorcycle</span>
                    </div>
                    {found.motorcycle ? (
                      <>
                        <p className="text-lg font-bold text-slate-900">
                          {found.motorcycle.registration_number}
                        </p>
                        {(found.motorcycle as any).make && (
                          <p className="text-sm text-slate-600 mt-1">
                            {(found.motorcycle as any).make} {(found.motorcycle as any).model ?? ''}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No motorcycle linked to this rider yet.</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-700" />
                      </div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rider</span>
                    </div>
                    {found.rider ? (
                      <>
                        <p className="text-lg font-bold text-slate-900">{found.rider.name}</p>
                        {found.rider.stage_name && (
                          <p className="text-sm text-slate-600 mt-1">Stage: {found.rider.stage_name}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">No rider currently assigned.</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={openReportForFound}
                    className="group flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition shadow-md"
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Report incident for this bike
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                  <button
                    onClick={resetSearch}
                    className="px-6 py-3 bg-white text-slate-700 border border-slate-300 rounded-xl font-semibold hover:bg-slate-50 transition"
                  >
                    Search again
                  </button>
                </div>
              </div>
            )}

            {attempted && !found && !searching && !searchError && (
              <div className="p-6 sm:p-8 bg-amber-50 border-b border-slate-100 space-y-3">
                <div className="flex items-center gap-2 text-amber-800 font-semibold">
                  <Info className="h-5 w-5" />
                  We couldn't find a registration matching "{searchTerm}"
                </div>
                <p className="text-sm text-amber-800">
                  Don't worry — you can still file a report using Step 2 below and describe
                  everything you saw.
                </p>
              </div>
            )}

            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">Step 2 — Or file a report without bike details</h2>
              <p className="text-sm text-slate-500 mb-5">
                If you don't have the plate or ID, just tell us everything you remember — the
                colour, direction of travel, timeline, and location. Officials will use the
                details to trace the motorcycle.
              </p>

              <div className="grid sm:grid-cols-3 gap-3 mb-6">
                {[
                  {
                    icon: <MapPin className="h-4 w-4" />,
                    label: 'Location',
                    desc: 'County, ward, road & landmark',
                  },
                  {
                    icon: <ShieldAlert className="h-4 w-4" />,
                    label: 'What happened',
                    desc: 'Type of incident, injuries, witnesses',
                  },
                  {
                    icon: <User className="h-4 w-4" />,
                    label: 'Phone check',
                    desc: 'OTP sent to your phone to confirm',
                  },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm mb-1">
                      <span className="w-6 h-6 rounded-md bg-white flex items-center justify-center text-emerald-600 border border-slate-200">
                        {icon}
                      </span>
                      {label}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={openReportUnregistered}
                className="group w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition shadow-md"
              >
                <AlertTriangle className="h-5 w-5" />
                Report without bike details
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">Your report is confidential.</p>
              <p className="text-blue-800">
                Only administrators and the police officers assigned to the case can see your
                contact information. False or malicious reports are traceable through the
                verified phone number and may attract legal action.
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="bg-slate-900 text-slate-400 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
            <p className="text-slate-600">&copy; {new Date().getFullYear()} BMS — Boda Management System. All rights reserved.</p>
            <p className="text-slate-600">
              Built by <span className="text-emerald-400 font-semibold">Hiram Technologies</span>
            </p>
          </div>
        </div>
      </footer>

      {showModal && (
        <IncidentReportModal
          motorcycleId={reportUnregistered ? undefined : found?.motorcycle?.id}
          riderId={reportUnregistered ? undefined : found?.rider?.id}
          ownerId={reportUnregistered ? undefined : found?.owner?.id}
          motorcycleReg={reportUnregistered ? undefined : found?.motorcycle?.registration_number}
          riderName={reportUnregistered ? undefined : found?.rider?.name}
          isUnregistered={reportUnregistered}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            resetSearch();
          }}
        />
      )}
    </div>
  );
}
