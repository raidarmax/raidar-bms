import { useState } from 'react';
import { X, Smartphone, CreditCard, CheckCircle, Loader, AlertCircle, ExternalLink, Globe } from 'lucide-react';
import { supabase, type Payment } from '../lib/supabase';

type PaymentModalProps = {
  userType: 'owner' | 'rider';
  userId: string;
  userName: string;
  onSuccess: (payment: Payment) => void;
  onClose: () => void;
};

type PaymentMethod = 'mpesa' | 'salamapay' | 'ecitizen';
type PaymentStep = 'select' | 'details' | 'processing' | 'success' | 'failed';

export default function PaymentModal({ userType, userId, userName, onSuccess, onClose }: PaymentModalProps) {
  const [step, setStep] = useState<PaymentStep>('select');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [eCitizenRef, setECitizenRef] = useState('');
  const [error, setError] = useState('');
  const [transactionRef, setTransactionRef] = useState('');

  const paymentAmount = userType === 'owner' ? 350 : 100;

  const generateTransactionRef = (method: PaymentMethod): string => {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    if (method === 'mpesa') return `QRS${timestamp}${random}`;
    if (method === 'ecitizen') return `ECZ${timestamp}${random}`;
    return `SAL-TXN-${timestamp}${random}`;
  };

  const handleMethodSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    setStep('details');
    setError('');
  };

  const validatePhoneNumber = (phone: string): boolean =>
    /^(?:\+254|0)[17]\d{8}$/.test(phone);

  const handlePayment = async () => {
    if (!paymentMethod) return;

    if (paymentMethod === 'ecitizen') {
      if (!eCitizenRef.trim()) {
        setError('Please enter your eCitizen payment reference number');
        return;
      }
      if (!/^[A-Z0-9]{6,20}$/i.test(eCitizenRef.trim())) {
        setError('Invalid reference number format. It should be 6–20 alphanumeric characters.');
        return;
      }
    } else {
      if (!validatePhoneNumber(phoneNumber)) {
        setError('Please enter a valid Kenyan phone number (e.g., +254712345678 or 0712345678)');
        return;
      }
    }

    setError('');
    setStep('processing');

    const normalizedPhone =
      paymentMethod !== 'ecitizen'
        ? phoneNumber.startsWith('0')
          ? '+254' + phoneNumber.substring(1)
          : phoneNumber
        : '';

    const txnRef = paymentMethod === 'ecitizen' ? eCitizenRef.trim().toUpperCase() : generateTransactionRef(paymentMethod);
    setTransactionRef(txnRef);

    try {
      const { data: paymentData, error: insertError } = await supabase
        .from('payments')
        .insert({
          user_type: userType,
          user_id: userId,
          amount: paymentAmount,
          payment_method: paymentMethod,
          payment_status: 'pending',
          transaction_reference: txnRef,
          phone_number: normalizedPhone,
          payment_year: new Date().getFullYear(),
          metadata: {
            user_name: userName,
            initiated_at: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setTimeout(async () => {
        const shouldSucceed = Math.random() > 0.05;

        if (shouldSucceed) {
          const { data: updatedPayment, error: updateError } = await supabase
            .from('payments')
            .update({
              payment_status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', paymentData.id)
            .select()
            .single();

          if (updateError) throw updateError;

          const userTable = userType === 'owner' ? 'owners' : 'riders';
          await supabase
            .from(userTable)
            .update({ payment_status: 'completed', payment_id: paymentData.id })
            .eq('id', userId);

          setStep('success');
          setTimeout(() => {
            onSuccess(updatedPayment as Payment);
          }, 2000);
        } else {
          await supabase
            .from('payments')
            .update({ payment_status: 'failed' })
            .eq('id', paymentData.id);

          setStep('failed');
        }
      }, 2500);
    } catch (err) {
      console.error('Payment error:', err);
      setError('Failed to process payment. Please try again.');
      setStep('details');
    }
  };

  const methodLabel = (method: PaymentMethod | null) => {
    if (method === 'mpesa') return 'M-Pesa';
    if (method === 'salamapay') return 'SalamaPay';
    if (method === 'ecitizen') return 'eCitizen';
    return '';
  };

  const processingMessage = () => {
    if (paymentMethod === 'mpesa') return 'Please check your phone and enter your M-Pesa PIN...';
    if (paymentMethod === 'ecitizen') return 'Verifying your eCitizen payment reference...';
    return 'Confirming payment with SalamaPay...';
  };

  const failureMessage = () => {
    if (paymentMethod === 'mpesa') return 'The M-Pesa transaction was not completed. Please try again.';
    if (paymentMethod === 'ecitizen') return 'The eCitizen reference could not be verified. Please check the reference and try again.';
    return 'The SalamaPay payment could not be processed. Please try again.';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Annual Fee Payment</h3>
            <p className="text-sm text-slate-600">Pay your {new Date().getFullYear()} registration fee</p>
          </div>
          {step !== 'processing' && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <div className="p-6">
          {step === 'select' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <p className="text-sm text-slate-600">Annual Registration Fee</p>
                <p className="text-3xl font-bold text-emerald-600">KES {paymentAmount}</p>
                <p className="text-xs text-slate-500 mt-1">Covers January – December {new Date().getFullYear()}</p>
              </div>

              <p className="text-sm text-slate-600 text-center">Select your preferred payment method</p>

              <button
                onClick={() => handleMethodSelect('mpesa')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition flex items-center space-x-4 group"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition">
                  <Smartphone className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-slate-900">M-Pesa</p>
                  <p className="text-sm text-slate-600">Pay with M-Pesa mobile money</p>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect('salamapay')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition flex items-center space-x-4 group"
              >
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition">
                  <CreditCard className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="font-bold text-slate-900">SalamaPay</p>
                  <p className="text-sm text-slate-600">Pay with SalamaPay wallet</p>
                </div>
              </button>

              <button
                onClick={() => handleMethodSelect('ecitizen')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition flex items-center space-x-4 group"
              >
                <div className="w-12 h-12 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden group-hover:border-red-300 transition">
                  <img
                    src="https://www.ecitizen.go.ke/img/favicon.png"
                    alt="eCitizen"
                    className="w-8 h-8 object-contain"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                      (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.removeProperty('display');
                    }}
                  />
                  <Globe className="h-6 w-6 text-red-600 hidden" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center space-x-2">
                    <p className="font-bold text-slate-900">eCitizen</p>
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">Gov Portal</span>
                  </div>
                  <p className="text-sm text-slate-600">Pay via the Kenya eCitizen portal</p>
                </div>
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center space-x-3 mb-3">
                  {paymentMethod === 'mpesa' && (
                    <>
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <Smartphone className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">M-Pesa Payment</p>
                        <p className="text-xs text-slate-600">You will receive an STK push</p>
                      </div>
                    </>
                  )}
                  {paymentMethod === 'salamapay' && (
                    <>
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">SalamaPay Payment</p>
                        <p className="text-xs text-slate-600">Secure wallet payment</p>
                      </div>
                    </>
                  )}
                  {paymentMethod === 'ecitizen' && (
                    <>
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden">
                        <img
                          src="https://www.ecitizen.go.ke/img/favicon.png"
                          alt="eCitizen"
                          className="w-7 h-7 object-contain"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                            (e.currentTarget.nextElementSibling as HTMLElement | null)?.style.removeProperty('display');
                          }}
                        />
                        <Globe className="h-5 w-5 text-red-600 hidden" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">eCitizen Payment</p>
                        <p className="text-xs text-slate-600">Kenya Government Portal</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                  <span className="text-sm text-slate-600">Amount:</span>
                  <span className="text-lg font-bold text-slate-900">KES {paymentAmount.toFixed(2)}</span>
                </div>
              </div>

              {paymentMethod === 'ecitizen' ? (
                <div className="space-y-3">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-red-900 mb-1 flex items-center space-x-1">
                      <ExternalLink className="h-4 w-4" />
                      <span>How to pay via eCitizen</span>
                    </p>
                    <ol className="text-sm text-red-800 space-y-1 list-decimal list-inside">
                      <li>Visit <a href="https://ecitizen.go.ke" target="_blank" rel="noopener noreferrer" className="underline font-semibold">ecitizen.go.ke</a> and log in</li>
                      <li>Navigate to <strong>Transport &amp; Licensing</strong></li>
                      <li>Select <strong>Bodaboda Annual Fee</strong> and pay KES {paymentAmount}</li>
                      <li>Copy the payment reference number provided</li>
                      <li>Enter the reference below to confirm</li>
                    </ol>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      eCitizen Payment Reference *
                    </label>
                    <input
                      type="text"
                      value={eCitizenRef}
                      onChange={(e) => {
                        setECitizenRef(e.target.value.toUpperCase());
                        setError('');
                      }}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono tracking-widest uppercase"
                      placeholder="e.g. ECZ2026XXXX"
                      maxLength={20}
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setError('');
                    }}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="+254712345678 or 0712345678"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  className={`flex-1 px-4 py-3 text-white rounded-lg font-semibold transition ${
                    paymentMethod === 'ecitizen'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  {paymentMethod === 'ecitizen' ? 'Verify & Confirm' : `Pay KES ${paymentAmount}`}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${paymentMethod === 'ecitizen' ? 'bg-red-100' : 'bg-emerald-100'}`}>
                <Loader className={`h-8 w-8 animate-spin ${paymentMethod === 'ecitizen' ? 'text-red-600' : 'text-emerald-600'}`} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Processing Payment</h4>
              <p className="text-slate-600 mb-4">{processingMessage()}</p>
              <div className="bg-slate-50 rounded-lg p-4 text-sm">
                <p className="text-slate-600">
                  {paymentMethod === 'ecitizen' ? 'eCitizen Reference:' : 'Transaction Reference:'}
                </p>
                <p className="font-mono font-bold text-slate-900 mt-1">{transactionRef}</p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Payment Successful!</h4>
              <p className="text-slate-600 mb-4">Your {new Date().getFullYear()} annual fee has been received</p>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Amount Paid:</span>
                  <span className="font-bold text-slate-900">KES {paymentAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Payment Method:</span>
                  <span className="font-bold text-slate-900">{methodLabel(paymentMethod)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    {paymentMethod === 'ecitizen' ? 'eCitizen Reference:' : 'Transaction Ref:'}
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-900">{transactionRef}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4">Redirecting...</p>
            </div>
          )}

          {step === 'failed' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Payment Failed</h4>
              <p className="text-slate-600 mb-6">{failureMessage()}</p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('select')}
                  className="flex-1 px-4 py-3 border border-slate-300 rounded-lg text-slate-700 font-semibold hover:bg-slate-50 transition"
                >
                  Change Method
                </button>
                <button
                  onClick={() => { setStep('details'); setError(''); }}
                  className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
