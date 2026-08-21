import { CheckCircle, Download } from 'lucide-react';
import AuthHeader from './AuthHeader';
import Footer from './Footer';

type RegistrationSuccessProps = {
  qrCode: string;
  uniqueId: string;
  onNavigate: (page: string) => void;
};

export default function RegistrationSuccess({ qrCode, uniqueId, onNavigate }: RegistrationSuccessProps) {
  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.href = qrCode;
    link.download = `bms-qr-${uniqueId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>BMS Registration QR Code</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px;
              }
              h1 {
                color: #059669;
                margin-bottom: 20px;
              }
              .qr-container {
                border: 3px solid #059669;
                padding: 20px;
                border-radius: 10px;
                background: white;
              }
              .id {
                text-align: center;
                margin-top: 20px;
                font-size: 18px;
                font-weight: bold;
              }
              .instructions {
                margin-top: 30px;
                max-width: 600px;
                text-align: center;
                line-height: 1.6;
              }
            </style>
          </head>
          <body>
            <h1>BMS - Boda Management System</h1>
            <div class="qr-container">
              <img src="${qrCode}" alt="QR Code" />
            </div>
            <div class="id">Registration ID: ${uniqueId}</div>
            <div class="instructions">
              <p><strong>Important Instructions:</strong></p>
              <p>1. Display this QR code prominently on your motorcycle</p>
              <p>2. Keep this document safe as proof of registration</p>
              <p>3. Your registration is pending verification by admin</p>
              <p>4. You will be notified once verified</p>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white flex flex-col">
      <AuthHeader onNavigate={onNavigate} activePage="" />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="bg-emerald-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-emerald-600" />
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Registration Successful!
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Your bodaboda has been registered successfully. Your registration is now pending admin verification.
          </p>

          <div className="bg-slate-50 rounded-xl p-8 mb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Your QR Code</h2>
            <div className="bg-white p-6 rounded-lg inline-block border-4 border-emerald-600 mb-4">
              <img src={qrCode} alt="Registration QR Code" className="w-64 h-64" />
            </div>
            <p className="text-sm text-slate-600 font-mono bg-white px-4 py-2 rounded border border-slate-200 inline-block">
              {uniqueId}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={handleDownloadQR}
              className="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition flex items-center justify-center"
            >
              <Download className="h-5 w-5 mr-2" />
              Download QR Code
            </button>
            <button
              onClick={handlePrint}
              className="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 transition"
            >
              Print QR Code
            </button>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-left">
            <h3 className="font-bold text-amber-900 mb-3">Next Steps:</h3>
            <ol className="space-y-2 text-sm text-amber-800">
              <li>1. Download and print your QR code</li>
              <li>2. Display the QR code on your motorcycle in a visible location</li>
              <li>3. Wait for admin verification (you may check status by scanning the QR code)</li>
              <li>4. Once verified, your registration will be fully active</li>
              <li>5. Passengers and officials can scan the QR code to verify your details</li>
            </ol>
          </div>

          <button
            onClick={() => onNavigate('home')}
            className="mt-8 px-8 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
          >
            Return to Home
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
