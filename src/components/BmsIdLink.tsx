import { useState } from 'react';
import { X } from 'lucide-react';
import BMSCard from './BMSCard';

type BmsIdLinkProps = {
  bmsId: string;
  riderName: string;
  idNumber: string;
  phoneNumber: string;
  countyReg: string | null;
  photoUrl: string | null;
  motorcycle?: string | null;
  owner?: string | null;
  className?: string;
};

export default function BmsIdLink({
  bmsId,
  riderName,
  idNumber,
  phoneNumber,
  countyReg,
  photoUrl,
  motorcycle,
  owner,
  className = '',
}: BmsIdLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`font-mono text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-600 transition-colors cursor-pointer ${className}`}
      >
        {bmsId}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-2xl animate-in fade-in zoom-in-95">
            <button
              onClick={() => setOpen(false)}
              className="absolute -top-3 -right-3 z-10 p-2 rounded-full bg-white border border-slate-200 shadow-lg text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
            <BMSCard
              bmsId={bmsId}
              riderName={riderName}
              idNumber={idNumber}
              phoneNumber={phoneNumber}
              countyReg={countyReg}
              photoUrl={photoUrl}
              motorcycle={motorcycle}
              owner={owner}
            />
          </div>
        </div>
      )}
    </>
  );
}
