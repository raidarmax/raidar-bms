import { useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Shield,
  Copy,
  Calendar,
  Hash,
  User as UserIcon,
  MapPin,
  Landmark,
  Ban,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
} from 'lucide-react';

export type FineReceiptData = {
  id: string;
  fine_reference: string | null;
  fine_amount: number;
  status: string;
  issued_at: string;
  paid_at: string | null;
  due_date?: string | null;
  payment_reference: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  rider_national_id?: string | null;
  location_description: string | null;
  notes: string | null;
  officer_name?: string | null;
  officer_rank?: string | null;
  officer_badge?: string | null;
  station_name?: string | null;
  offence_name?: string | null;
  offence_code?: string | null;
};

type Props = {
  fine: FineReceiptData;
  onClose: () => void;
};

function formatKES(n: number) {
  return `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_STYLE: Record<string, { pill: string; ring: string; label: string; accentFrom: string; accentTo: string; icon: JSX.Element }> = {
  paid: {
    pill: 'bg-emerald-100 text-emerald-800',
    ring: 'ring-emerald-200',
    label: 'PAID',
    accentFrom: 'from-emerald-600',
    accentTo: 'to-emerald-700',
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  issued: {
    pill: 'bg-blue-100 text-blue-800',
    ring: 'ring-blue-200',
    label: 'OUTSTANDING',
    accentFrom: 'from-blue-700',
    accentTo: 'to-blue-800',
    icon: <Clock className="h-4 w-4" />,
  },
  overdue: {
    pill: 'bg-red-100 text-red-800',
    ring: 'ring-red-200',
    label: 'OVERDUE',
    accentFrom: 'from-red-600',
    accentTo: 'to-red-700',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  disputed: {
    pill: 'bg-amber-100 text-amber-800',
    ring: 'ring-amber-200',
    label: 'DISPUTED',
    accentFrom: 'from-amber-600',
    accentTo: 'to-amber-700',
    icon: <AlertCircle className="h-4 w-4" />,
  },
  cancelled: {
    pill: 'bg-slate-200 text-slate-700',
    ring: 'ring-slate-200',
    label: 'CANCELLED',
    accentFrom: 'from-slate-600',
    accentTo: 'to-slate-700',
    icon: <Ban className="h-4 w-4" />,
  },
};

export default function FineReceiptModal({ fine, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const style = STATUS_STYLE[fine.status] ?? STATUS_STYLE.issued;
  const receiptNo = useMemo(() => {
    if (fine.fine_reference) return fine.fine_reference;
    const short = fine.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `FIN-${short}`;
  }, [fine.id, fine.fine_reference]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const copyReceipt = async () => {
    try { await navigator.clipboard.writeText(receiptNo); } catch { /* ignore */ }
  };

  const handlePrint = () => {
    const node = printRef.current;
    if (!node) return;
    const win = window.open('', '_blank', 'width=760,height=900');
    if (!win) return;
    win.document.write(`
      <!doctype html><html><head><title>${receiptNo}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @page { size: A5; margin: 12mm; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
      </style>
      </head><body>${node.outerHTML}
      <script>window.onload=()=>{setTimeout(()=>{window.print();},250);};</script>
      </body></html>
    `);
    win.document.close();
  };

  const isPaid = fine.status === 'paid';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <FileText className="h-4 w-4 text-slate-700" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {isPaid ? 'Fine Payment Receipt' : 'Traffic Fine Notice'}
              </h3>
              <p className="text-[11px] text-slate-500">Official system-generated record</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyReceipt}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100"
              title="Copy reference"
            >
              <Copy className="h-3.5 w-3.5" /> Copy #
            </button>
            <button
              onClick={handlePrint}
              className="text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
            >
              <Printer className="h-3.5 w-3.5" /> Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="h-4 w-4 text-slate-500" />
            </button>
          </div>
        </div>

        <div className="p-5 max-h-[80vh] overflow-y-auto">
          <div ref={printRef} className="bg-white">
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className={`bg-gradient-to-r ${style.accentFrom} ${style.accentTo} text-white px-6 py-5 flex items-start justify-between`}>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                    National Police Service · Kenya
                  </p>
                  <h2 className="text-xl font-bold mt-0.5">
                    {isPaid ? 'Traffic Fine — Payment Receipt' : 'Traffic Fine Notice'}
                  </h2>
                  <p className="text-xs text-white/80 mt-1">
                    Boda Management System — Enforcement
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-white/80">Reference</p>
                  <p className="text-lg font-mono font-bold">{receiptNo}</p>
                  <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.pill} ring-1 ${style.ring}`}>
                    {style.icon}
                    {style.label}
                  </div>
                </div>
              </div>

              <div className="px-6 pt-5">
                <div className={`rounded-xl bg-slate-50 border border-slate-200 px-5 py-4 flex items-center justify-between`}>
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600">
                      Fine Amount
                    </p>
                    <p className="text-3xl font-bold text-slate-900 leading-tight">
                      {formatKES(fine.fine_amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-600">
                      {isPaid ? 'Paid On' : 'Due By'}
                    </p>
                    <p className="text-lg font-bold text-slate-900 leading-tight">
                      {isPaid ? formatDateTime(fine.paid_at) : formatDateTime(fine.due_date)}
                    </p>
                    {isPaid && fine.payment_reference && (
                      <p className="text-[11px] text-emerald-700 mt-0.5 font-mono">
                        {fine.payment_reference}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Field icon={<UserIcon className="h-3.5 w-3.5" />} label="Rider">
                  <p className="text-sm font-semibold text-slate-900">{fine.rider_name || 'Unknown'}</p>
                  {fine.rider_national_id && (
                    <p className="text-[11px] text-slate-500 font-mono">ID {fine.rider_national_id}</p>
                  )}
                </Field>
                <Field icon={<Hash className="h-3.5 w-3.5" />} label="Contact">
                  <p className="text-sm font-mono text-slate-800">{fine.rider_phone || '—'}</p>
                </Field>

                <Field icon={<Ban className="h-3.5 w-3.5" />} label="Offence">
                  <p className="text-sm font-semibold text-slate-900">
                    {fine.offence_name || 'Traffic Violation'}
                  </p>
                  {fine.offence_code && (
                    <p className="text-[11px] text-slate-500 font-mono">Code {fine.offence_code}</p>
                  )}
                </Field>
                <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Issued">
                  <p className="text-sm text-slate-800">{formatDateTime(fine.issued_at)}</p>
                </Field>

                <Field icon={<Shield className="h-3.5 w-3.5" />} label="Issuing Officer">
                  <p className="text-sm font-semibold text-slate-900">
                    {fine.officer_name
                      ? `${fine.officer_rank ?? 'Officer'} ${fine.officer_name}`.trim()
                      : 'Unknown officer'}
                  </p>
                  {fine.officer_badge && (
                    <p className="text-[11px] text-slate-500 font-mono">Badge #{fine.officer_badge}</p>
                  )}
                </Field>
                <Field icon={<Landmark className="h-3.5 w-3.5" />} label="Station">
                  <p className="text-sm text-slate-800">{fine.station_name || '—'}</p>
                </Field>

                {fine.location_description && (
                  <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Location">
                    <p className="text-sm text-slate-800">{fine.location_description}</p>
                  </Field>
                )}
                {fine.notes && (
                  <Field icon={<FileText className="h-3.5 w-3.5" />} label="Notes">
                    <p className="text-sm text-slate-700 leading-snug">{fine.notes}</p>
                  </Field>
                )}
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Shield className={`h-4 w-4 ${isPaid ? 'text-emerald-600' : 'text-slate-700'}`} />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-800 mb-0.5">
                        {isPaid ? 'Verified Payment' : 'Official Notice'}
                      </p>
                      {isPaid
                        ? <>Payment received and reconciled by the Boda Management System. Present reference <span className="font-mono font-semibold text-slate-800">{receiptNo}</span> as proof of payment.</>
                        : <>Pay this fine before the due date to avoid escalation. Present reference <span className="font-mono font-semibold text-slate-800">{receiptNo}</span> at any accepted payment channel.</>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Ministry of Interior · Republic of Kenya
                </p>
                <p className="text-[10px] font-mono text-slate-400">{fine.id}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
        <span className="text-slate-400">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}
