import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle2, AlertCircle, ArrowLeft, Loader2, ScanBarcode, User, Phone, CreditCard, Bike, Plus, RotateCcw, Type } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendOtp, verifyOtp } from '../lib/otp';

type Step = 'scan' | 'details' | 'duplicate' | 'otp' | 'registering' | 'success';

type ExistingOwner = {
  id: string;
  full_name: string;
  phone_number: string;
  national_id: string;
  bike_count: number;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect(source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap): Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function FieldRegistration({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [step, setStep] = useState<Step>('scan');
  const [serial, setSerial] = useState('');
  const [imei, setImei] = useState('');
  const [manualSerial, setManualSerial] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanMethod, setScanMethod] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(false);
  const intervalsRef = useRef<number[]>([]);
  const tesseractWorkerRef = useRef<any>(null);

  const [ownerName, setOwnerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');

  const [existingOwner, setExistingOwner] = useState<ExistingOwner | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [registerError, setRegisterError] = useState('');
  const [registeredData, setRegisteredData] = useState<{ ownerName: string; phone: string; plate: string; serial: string } | null>(null);

  const [detailsError, setDetailsError] = useState('');

  const cleanupScanner = () => {
    intervalsRef.current.forEach(id => clearInterval(id));
    intervalsRef.current = [];
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (tesseractWorkerRef.current) {
      try { tesseractWorkerRef.current.terminate(); } catch {}
      tesseractWorkerRef.current = null;
    }
  };

  const stopCamera = () => {
    cleanupScanner();
    setScanning(false);
    setScanMethod('');
  };

  useEffect(() => {
    return () => { cleanupScanner(); };
  }, []);

  const captureFrame = (): HTMLCanvasElement | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, vw, vh);
    return canvas;
  };

  const extractSerialFromOcrText = (text: string): string | null => {
    const lines = text.split(/\n/);
    for (const line of lines) {
      const cleaned = line.replace(/[^0-9a-zA-Z]/g, '');
      if (/^\d{8,15}$/.test(cleaned)) return cleaned;
      const digitRun = cleaned.match(/\d{8,15}/);
      if (digitRun) return digitRun[0];
    }
    const allDigits = text.replace(/[^0-9]/g, '');
    if (allDigits.length >= 8 && allDigits.length <= 20) {
      const match = allDigits.match(/\d{8,15}/);
      if (match) return match[0];
    }
    return null;
  };

  const startCamera = async () => {
    setScanError('');
    setScanMethod('Starting camera...');
    detectedRef.current = false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setScanning(true);

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const hasBarcodeApi = typeof window.BarcodeDetector !== 'undefined';

      if (hasBarcodeApi) {
        setScanMethod('Barcode scanner active');
        const detector = new window.BarcodeDetector!({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'upc_a', 'upc_e', 'codabar', 'qr_code', 'data_matrix'],
        });

        const barcodeInterval = window.setInterval(async () => {
          if (detectedRef.current) return;
          try {
            const results = await detector.detect(video);
            if (results.length > 0 && !detectedRef.current) {
              const value = results[0].rawValue.trim();
              if (value.length >= 4) {
                detectedRef.current = true;
                handleBarcodeDetected(value);
              }
            }
          } catch {}
        }, 400);
        intervalsRef.current.push(barcodeInterval);
      } else {
        setScanMethod('OCR reader active (no barcode API)');
      }

      let ocrBusy = false;
      const ocrInterval = window.setInterval(async () => {
        if (detectedRef.current || ocrBusy) return;
        const canvas = captureFrame();
        if (!canvas) return;

        ocrBusy = true;
        try {
          if (!tesseractWorkerRef.current) {
            const Tesseract = await import('tesseract.js');
            const worker = await Tesseract.createWorker('eng');
            await worker.setParameters({ tessedit_char_whitelist: '0123456789' });
            tesseractWorkerRef.current = worker;
          }

          const { data } = await tesseractWorkerRef.current.recognize(canvas);
          if (detectedRef.current) return;

          const found = extractSerialFromOcrText(data.text);
          if (found) {
            detectedRef.current = true;
            handleBarcodeDetected(found);
          }
        } catch {} finally {
          ocrBusy = false;
        }
      }, 2000);
      intervalsRef.current.push(ocrInterval);

      if (hasBarcodeApi) {
        setTimeout(() => {
          if (!detectedRef.current && scanning) {
            setScanMethod('Barcode + OCR active');
          }
        }, 4000);
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (/not allowed|permission|denied/i.test(msg)) {
        setScanError('Camera access denied. Please allow camera permissions in your browser settings, then try again.');
      } else {
        setScanError('Unable to access camera. Please enter the serial number manually.');
      }
      setScanning(false);
      setScanMethod('');
    }
  };

  const handleBarcodeDetected = (value: string) => {
    stopCamera();
    if (value.length >= 14) {
      setImei(value);
      const derivedSerial = value.length === 15 ? value.slice(4) : value;
      if (!serial) setSerial(derivedSerial);
    } else {
      setSerial(value);
    }
  };

  const handleManualEntry = () => {
    const trimmed = manualSerial.trim();
    if (trimmed.length < 4) {
      setScanError('Serial number must be at least 4 characters');
      return;
    }
    setSerial(trimmed);
    setScanError('');
  };

  const handleProceedToDetails = () => {
    if (!serial) {
      setScanError('Please scan or enter a serial number first');
      return;
    }
    setStep('details');
  };

  const normalizePhoneForLookup = (phone: string): string => {
    const stripped = phone.trim().replace(/\s+/g, '').replace(/^\+/, '');
    if (stripped.startsWith('0')) return '+254' + stripped.slice(1);
    if (stripped.startsWith('254')) return '+' + stripped;
    return '+254' + stripped;
  };

  const handleCheckAndProceed = async () => {
    setDetailsError('');

    if (!ownerName.trim()) { setDetailsError('Owner name is required'); return; }
    if (!phoneNumber.trim()) { setDetailsError('Phone number is required'); return; }
    if (!nationalId.trim()) { setDetailsError('National ID is required'); return; }
    if (!plateNumber.trim()) { setDetailsError('Plate number is required'); return; }

    const normalizedPhone = normalizePhoneForLookup(phoneNumber);

    const { data: existing } = await supabase
      .from('owners')
      .select('id, full_name, phone_number, national_id')
      .eq('phone_number', normalizedPhone)
      .maybeSingle();

    if (existing) {
      const { count } = await supabase
        .from('motorcycles')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', existing.id);

      setExistingOwner({
        ...existing,
        bike_count: count || 0,
      });
      setStep('duplicate');
    } else {
      setOtpSending(true);
      const result = await sendOtp(phoneNumber);
      setOtpSending(false);
      if (result.success) {
        setStep('otp');
      } else {
        setDetailsError(result.error || 'Failed to send verification code');
      }
    }
  };

  const handleAddToExisting = async () => {
    if (!existingOwner) return;
    await performRegistration(existingOwner.id);
  };

  const handleVerifyOtp = async () => {
    setOtpError('');
    if (otpCode.length !== 6) {
      setOtpError('Enter the 6-digit code');
      return;
    }

    setVerifying(true);
    const valid = await verifyOtp(phoneNumber, otpCode);
    setVerifying(false);

    if (!valid) {
      setOtpError('Invalid or expired code. Please try again.');
      return;
    }

    await performRegistration(null);
  };

  const handleResendOtp = async () => {
    setOtpError('');
    setOtpSending(true);
    const result = await sendOtp(phoneNumber);
    setOtpSending(false);
    if (!result.success) {
      setOtpError(result.error || 'Failed to resend code');
    }
  };

  const performRegistration = async (existingOwnerId: string | null) => {
    setStep('registering');
    setRegisterError('');

    try {
      let ownerId = existingOwnerId;
      const normalizedPhone = normalizePhoneForLookup(phoneNumber);

      if (!ownerId) {
        const { data: newOwner, error: ownerError } = await supabase
          .from('owners')
          .insert({
            full_name: ownerName.trim(),
            phone_number: normalizedPhone,
            national_id: nationalId.trim(),
            otp_verified: true,
            payment_status: 'pending',
            owner_type: 'individual',
          })
          .select('id')
          .single();

        if (ownerError) throw new Error('Failed to create owner account');
        ownerId = newOwner.id;
      }

      const paddedSerial = serial.length === 11 ? '0' + serial : serial;
      const unpaddedSerial = paddedSerial.startsWith('0') ? paddedSerial.slice(1) : paddedSerial;

      let existingDevice: { id: string } | null = null;
      const { data: d1 } = await supabase
        .from('tracking_devices')
        .select('id')
        .eq('device_id', paddedSerial)
        .maybeSingle();
      existingDevice = d1;

      if (!existingDevice) {
        const { data: d2 } = await supabase
          .from('tracking_devices')
          .select('id')
          .eq('device_id', unpaddedSerial)
          .maybeSingle();
        existingDevice = d2;
      }

      if (!existingDevice) {
        const { data: d3 } = await supabase
          .from('tracking_devices')
          .select('id')
          .eq('phone_number', paddedSerial)
          .maybeSingle();
        existingDevice = d3;
      }

      const { data: newMoto, error: motoError } = await supabase
        .from('motorcycles')
        .insert({
          owner_id: ownerId,
          registration_number: plateNumber.trim().toUpperCase(),
          tracking_device_id: paddedSerial,
          status: 'pending',
        })
        .select('id')
        .single();

      if (motoError) throw new Error('Failed to register motorcycle');

      if (existingDevice) {
        await supabase
          .from('tracking_devices')
          .update({
            device_id: paddedSerial,
            imei: imei || null,
            motorcycle_id: newMoto.id,
            status: 'registered',
          })
          .eq('id', existingDevice.id);
      } else {
        await supabase
          .from('tracking_devices')
          .insert({
            device_id: paddedSerial,
            phone_number: paddedSerial,
            imei: imei || null,
            motorcycle_id: newMoto.id,
            status: 'registered',
          });
      }

      setRegisteredData({
        ownerName: existingOwner?.full_name || ownerName.trim(),
        phone: normalizedPhone,
        plate: plateNumber.trim().toUpperCase(),
        serial: paddedSerial,
      });
      setStep('success');
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registration failed');
      setStep('details');
    }
  };

  const handleReset = () => {
    stopCamera();
    setStep('scan');
    setSerial('');
    setImei('');
    setManualSerial('');
    setOwnerName('');
    setPhoneNumber('');
    setNationalId('');
    setPlateNumber('');
    setOtpCode('');
    setExistingOwner(null);
    setRegisteredData(null);
    setRegisterError('');
    setDetailsError('');
    setOtpError('');
    setScanError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 px-4 py-3 flex items-center gap-3 sticky top-0 z-50">
        <button onClick={() => onNavigate('home')} className="text-slate-400 hover:text-white transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
            <ScanBarcode size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-semibold text-sm leading-tight">Field Registration</h1>
            <p className="text-slate-400 text-xs">Scan & Register</p>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {['scan', 'details', 'otp', 'success'].map((s, i) => (
            <div key={s} className="flex-1 flex items-center gap-1">
              <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                ['scan', 'details', 'duplicate', 'otp', 'registering', 'success'].indexOf(step) >= i
                  ? 'bg-emerald-500'
                  : 'bg-slate-700'
              }`} />
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-8">
        {/* SCAN STEP */}
        {step === 'scan' && (
          <div className="space-y-4 mt-4">
            <div className="text-center">
              <h2 className="text-white text-lg font-semibold">Scan Tracker Barcode</h2>
              <p className="text-slate-400 text-sm mt-1">Point camera at the barcode or printed serial number</p>
            </div>

            {/* Camera viewport */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] border border-slate-700">
              <video ref={videoRef} className={`w-full h-full object-cover ${scanning ? '' : 'hidden'}`} autoPlay playsInline muted />
              <canvas ref={canvasRef} className="hidden" />
              {scanning ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-24 border-2 border-emerald-400 rounded-lg opacity-70">
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2">
                        <p className="text-emerald-300/80 text-[10px] whitespace-nowrap flex items-center gap-1">
                          <Type size={10} />
                          {scanMethod || 'Initializing...'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="absolute top-3 right-3 bg-black/60 text-white px-3 py-1.5 rounded-full text-xs"
                  >
                    Stop
                  </button>
                </>
              ) : (
                <button
                  onClick={startCamera}
                  className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  <Camera size={48} className="opacity-60" />
                  <span className="text-sm font-medium">Tap to open camera</span>
                </button>
              )}
            </div>

            {serial && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                <div>
                  <p className="text-emerald-300 text-xs font-medium">Serial captured</p>
                  <p className="text-white font-mono text-lg">{serial}</p>
                  {imei && <p className="text-slate-400 text-xs mt-0.5">IMEI: {imei}</p>}
                </div>
              </div>
            )}

            {scanError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{scanError}</p>
              </div>
            )}

            {/* Manual entry */}
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <p className="text-slate-400 text-xs font-medium mb-2">Or enter serial manually</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualSerial}
                  onChange={e => setManualSerial(e.target.value)}
                  placeholder="e.g. 44062431433"
                  className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleManualEntry}
                  className="bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-600 transition-colors"
                >
                  Set
                </button>
              </div>
            </div>

            <button
              onClick={handleProceedToDetails}
              disabled={!serial}
              className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* DETAILS STEP */}
        {step === 'details' && (
          <div className="space-y-4 mt-4">
            <div className="text-center">
              <h2 className="text-white text-lg font-semibold">Owner & Bike Details</h2>
              <p className="text-slate-400 text-sm mt-1">Tracker: <span className="font-mono text-emerald-400">{serial}</span></p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  placeholder="Owner full name"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={e => setPhoneNumber(e.target.value)}
                  placeholder="Phone number (07xx xxx xxx)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="relative">
                <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={nationalId}
                  onChange={e => setNationalId(e.target.value)}
                  placeholder="National ID number"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div className="relative">
                <Bike size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={plateNumber}
                  onChange={e => setPlateNumber(e.target.value)}
                  placeholder="Plate number (e.g. KMXX 000X)"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>
            </div>

            {detailsError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{detailsError}</p>
              </div>
            )}

            {registerError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{registerError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setStep('scan')}
                className="flex-1 bg-slate-700 text-white py-3.5 rounded-xl font-medium text-sm hover:bg-slate-600 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCheckAndProceed}
                disabled={otpSending}
                className="flex-[2] bg-emerald-500 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-60 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                {otpSending ? <><Loader2 size={16} className="animate-spin" /> Sending OTP...</> : 'Register'}
              </button>
            </div>
          </div>
        )}

        {/* DUPLICATE STEP */}
        {step === 'duplicate' && existingOwner && (
          <div className="space-y-4 mt-6">
            <div className="text-center">
              <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle size={28} className="text-amber-400" />
              </div>
              <h2 className="text-white text-lg font-semibold">Account Already Exists</h2>
              <p className="text-slate-400 text-sm mt-1">This phone number is already registered</p>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Name</span>
                <span className="text-white text-sm font-medium">{existingOwner.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Phone</span>
                <span className="text-white text-sm font-mono">{existingOwner.phone_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">National ID</span>
                <span className="text-white text-sm font-mono">{existingOwner.national_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-sm">Bikes on account</span>
                <span className="text-emerald-400 text-sm font-semibold">{existingOwner.bike_count}</span>
              </div>
            </div>

            <p className="text-slate-300 text-sm text-center">
              Add motorcycle <span className="font-mono text-emerald-400">{plateNumber.toUpperCase()}</span> with tracker <span className="font-mono text-emerald-400">{serial}</span> to this account?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('details')}
                className="flex-1 bg-slate-700 text-white py-3.5 rounded-xl font-medium text-sm hover:bg-slate-600 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={handleAddToExisting}
                className="flex-[2] bg-emerald-500 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add to Account
              </button>
            </div>
          </div>
        )}

        {/* OTP STEP */}
        {step === 'otp' && (
          <div className="space-y-4 mt-6">
            <div className="text-center">
              <h2 className="text-white text-lg font-semibold">Verify Phone Number</h2>
              <p className="text-slate-400 text-sm mt-1">
                A 6-digit code was sent to <span className="text-emerald-400">{phoneNumber}</span>
              </p>
            </div>

            <div className="flex justify-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-48 text-center bg-slate-800 border border-slate-700 rounded-xl px-4 py-4 text-white text-2xl tracking-[0.3em] font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {otpError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{otpError}</p>
              </div>
            )}

            <button
              onClick={handleVerifyOtp}
              disabled={verifying || otpCode.length !== 6}
              className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              {verifying ? <><Loader2 size={16} className="animate-spin" /> Verifying...</> : 'Verify & Register'}
            </button>

            <button
              onClick={handleResendOtp}
              disabled={otpSending}
              className="w-full text-slate-400 text-sm hover:text-white transition-colors py-2"
            >
              {otpSending ? 'Resending...' : 'Resend code'}
            </button>

            <button
              onClick={() => setStep('details')}
              className="w-full text-slate-500 text-xs hover:text-slate-300 transition-colors"
            >
              Back to details
            </button>
          </div>
        )}

        {/* REGISTERING STEP */}
        {step === 'registering' && (
          <div className="flex flex-col items-center justify-center mt-20 space-y-4">
            <Loader2 size={40} className="text-emerald-400 animate-spin" />
            <p className="text-white text-sm font-medium">Registering...</p>
            <p className="text-slate-400 text-xs">Linking owner, motorcycle, and tracker</p>
          </div>
        )}

        {/* SUCCESS STEP */}
        {step === 'success' && registeredData && (
          <div className="space-y-5 mt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-emerald-400" />
              </div>
              <h2 className="text-white text-xl font-bold">Registration Complete</h2>
              <p className="text-slate-400 text-sm mt-1">All records have been linked successfully</p>
            </div>

            <div className="bg-slate-800/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Owner</span>
                <span className="text-white text-sm font-medium">{registeredData.ownerName}</span>
              </div>
              <div className="border-t border-slate-700" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Phone</span>
                <span className="text-white text-sm font-mono">{registeredData.phone}</span>
              </div>
              <div className="border-t border-slate-700" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Plate</span>
                <span className="text-white text-sm font-mono">{registeredData.plate}</span>
              </div>
              <div className="border-t border-slate-700" />
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">Tracker</span>
                <span className="text-emerald-400 text-sm font-mono">{registeredData.serial}</span>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="w-full bg-emerald-500 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={16} /> Register Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
