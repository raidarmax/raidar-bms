import { useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  Shield,
  Copy,
  Calendar,
  Hash,
  User as UserIcon,
  CreditCard,
  Phone,
} from 'lucide-react';
import type { Payment } from '../lib/supabase';

type Props = {
  payment: Payment;
  payerName: string;
  onClose: () => void;
};

const METHOD_LABEL: Record<string, string> = {
  mpesa: 'M-Pesa',
  salamapay: 'SalamaPay',
  ecitizen: 'eCitizen',
};

function formatKES(n: number) {
  return `KES ${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-KE', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function PaymentReceiptModal({ payment, payerName, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const receiptNo = useMemo(() => {
    const short = payment.id.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `RCT-${short}`;
  }, [payment.id]);

  const feeLabel = payment.user_type === 'owner'
    ? 'Owner Annual Registration'
    : 'Rider Annual Registration';

  const copyReceipt = async () => {
    try {
      await navigator.clipboard.writeText(receiptNo);
    } catch { /* ignore */ }
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl relative">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Payment Receipt</h3>
              <p className="text-[11px] text-slate-500">Official system-generated record</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyReceipt}
              className="text-xs font-medium text-slate-600 hover:text-slate-900 inline-flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100"
              title="Copy receipt number"
            >
              <Copy className="h-3.5 w-3.5" /> Copy #
            </button>
            <button
              onClick={handlePrint}
              className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
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
              <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-6 py-5 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">
                    Boda Management System
                  </p>
                  <h2 className="text-xl font-bold mt-0.5">Registration Payment Receipt</h2>
                  <p className="text-xs text-emerald-50 mt-1">
                    Republic of Kenya — Motorcycle Registry
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-emerald-100">Receipt No.</p>
                  <p className="text-lg font-mono font-bold">{receiptNo}</p>
                  <p className="text-[11px] text-emerald-50 mt-1">
                    {formatDateTime(payment.completed_at || payment.created_at)}
                  </p>
                </div>
              </div>

              <div className="px-6 pt-5">
                <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-emerald-800">
                      Amount Paid
                    </p>
                    <p className="text-3xl font-bold text-emerald-700 leading-tight">
                      {formatKES(payment.amount)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-emerald-800">
                      Coverage Year
                    </p>
                    <p className="text-3xl font-bold text-slate-900 leading-tight">{payment.payment_year}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Valid Jan 1 – Dec 31, {payment.payment_year}
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <Field icon={<UserIcon className="h-3.5 w-3.5" />} label="Payer">
                  <p className="text-sm font-semibold text-slate-900">{payerName}</p>
                  <p className="text-[11px] text-slate-500 capitalize">
                    {payment.user_type} · {feeLabel}
                  </p>
                </Field>
                <Field icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
                  <p className="text-sm font-mono text-slate-800">{payment.phone_number}</p>
                </Field>
                <Field icon={<CreditCard className="h-3.5 w-3.5" />} label="Payment Method">
                  <p className="text-sm font-semibold text-slate-900">
                    {METHOD_LABEL[payment.payment_method] ?? payment.payment_method}
                  </p>
                </Field>
                <Field icon={<Hash className="h-3.5 w-3.5" />} label="Transaction Reference">
                  <p className="text-sm font-mono text-slate-800 break-all">
                    {payment.transaction_reference}
                  </p>
                </Field>
                <Field icon={<Calendar className="h-3.5 w-3.5" />} label="Initiated">
                  <p className="text-sm text-slate-800">{formatDateTime(payment.created_at)}</p>
                </Field>
                <Field icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Completed">
                  <p className="text-sm text-slate-800">
                    {formatDateTime(payment.completed_at)}
                  </p>
                </Field>
              </div>

              <div className="px-6 pb-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
                      <Shield className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                      <p className="font-semibold text-slate-800 mb-0.5">Verified Payment</p>
                      This is an official system-generated receipt from the Boda
                      Management System. Present receipt number
                      <span className="font-mono font-semibold text-slate-800"> {receiptNo}</span>
                      {' '}for verification. No signature required.
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">
                  Ministry of Interior · Kenya
                </p>
                <p className="text-[10px] font-mono text-slate-400">{payment.id}</p>
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
