import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

type BMSCardProps = {
  bmsId: string;
  riderName: string;
  idNumber: string;
  phoneNumber: string;
  countyReg: string | null;
  photoUrl: string | null;
  motorcycle?: string | null;
  owner?: string | null;
};

export default function BMSCard({
  bmsId,
  riderName,
  idNumber,
  phoneNumber,
  countyReg,
  photoUrl,
  motorcycle,
  owner,
}: BMSCardProps) {
  const [qrCode, setQrCode] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = `BMS:${bmsId}|ID:${idNumber}|NAME:${riderName}`;
        const qrCodeUrl = await QRCode.toDataURL(qrData, {
          width: 200,
          margin: 1,
        });
        setQrCode(qrCodeUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQR();
  }, [bmsId, idNumber, riderName]);

  return (
    <div
      ref={cardRef}
      id="bms-card"
      className="bg-white border-4 border-emerald-600 rounded-xl p-6 w-full max-w-2xl mx-auto"
      style={{ aspectRatio: '1.586/1' }}
    >
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-4 pb-3 border-b-2 border-emerald-600">
          <div className="flex items-center space-x-3">
            <img
              src="/government-of-kenya-emblem-gok-logo-png_seeklogo-318197 (1).png"
              alt="Government of Kenya"
              className="h-16 w-16 object-contain"
            />
            <div>
              <h2 className="text-xl font-bold text-slate-900">BODABODA MANAGEMENT</h2>
              <p className="text-sm text-slate-600">RIDER IDENTIFICATION CARD</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-600">ID Number</p>
            <p className="text-lg font-bold text-emerald-600">{bmsId}</p>
          </div>
        </div>

        <div className="flex flex-1 space-x-6">
          <div className="flex flex-col items-center space-y-3">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={riderName}
                className="w-32 h-32 rounded-lg object-cover border-2 border-slate-300"
              />
            ) : (
              <div className="w-32 h-32 rounded-lg bg-slate-200 flex items-center justify-center border-2 border-slate-300">
                <p className="text-slate-500 text-xs text-center">No Photo</p>
              </div>
            )}
            {qrCode && (
              <img
                src={qrCode}
                alt="QR Code"
                className="w-24 h-24"
              />
            )}
          </div>

          <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-slate-600 font-semibold mb-1">FULL NAME</p>
              <p className="font-bold text-slate-900">{riderName}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold mb-1">NATIONAL ID</p>
              <p className="font-bold text-slate-900">{idNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold mb-1">PHONE NUMBER</p>
              <p className="font-bold text-slate-900">{phoneNumber}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 font-semibold mb-1">COUNTY REG</p>
              <p className="font-bold text-slate-900">{countyReg || 'N/A'}</p>
            </div>
            {motorcycle && (
              <div>
                <p className="text-xs text-slate-600 font-semibold mb-1">MOTORCYCLE</p>
                <p className="font-bold text-slate-900">{motorcycle}</p>
              </div>
            )}
            {owner && (
              <div>
                <p className="text-xs text-slate-600 font-semibold mb-1">OWNER</p>
                <p className="font-bold text-slate-900">{owner}</p>
              </div>
            )}
            <div className="col-span-2 pt-2 border-t border-slate-200">
              <p className="text-xs text-slate-600 font-semibold mb-1">ISSUED DATE</p>
              <p className="font-bold text-slate-900">{new Date().toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t-2 border-emerald-600">
          <p className="text-xs text-center text-slate-600">
            This card is property of the Government of Kenya and must be carried at all times while operating a motorcycle.
          </p>
        </div>
      </div>
    </div>
  );
}
