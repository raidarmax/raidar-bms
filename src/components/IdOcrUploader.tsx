import { useState } from 'react';
import { Upload, Loader, CheckCircle, AlertCircle, Eye, X } from 'lucide-react';
import { extractIdData, compareFields, type ExtractedIdData } from '../lib/ocrProcessor';

type IdOcrUploaderProps = {
  onDataExtracted: (data: ExtractedIdData) => void;
  currentValues?: {
    fullName?: string;
    idNumber?: string;
  };
  disabled?: boolean;
};

export default function IdOcrUploader({ onDataExtracted, currentValues, disabled }: IdOcrUploaderProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedData, setExtractedData] = useState<ExtractedIdData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.match(/^image\/(jpeg|jpg|png)$/)) {
      setError('Please upload a JPEG or PNG image');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    setExtractedData(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleProcessImage = async () => {
    if (!file) return;

    setProcessing(true);
    setProgress(0);
    setError(null);

    const result = await extractIdData(file, (progressValue) => {
      setProgress(progressValue);
    });

    setProcessing(false);

    if (result.success && result.data) {
      setExtractedData(result.data);
      onDataExtracted(result.data);
    } else {
      setError(result.error || 'Failed to extract data from ID');
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setExtractedData(null);
    setError(null);
    setProgress(0);
  };

  const getVerificationStatus = (field: 'name' | 'id') => {
    if (!extractedData || !currentValues) return null;

    const ocrValue = field === 'name' ? extractedData.fullName : extractedData.idNumber;
    const currentValue = field === 'name' ? currentValues.fullName : currentValues.idNumber;

    if (!ocrValue || !currentValue) return null;

    const comparison = compareFields(currentValue, ocrValue);
    return comparison;
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Upload className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-blue-900 text-sm">Auto-fill from ID Document</h3>
            <p className="text-xs text-blue-700 mt-1">
              Upload a photo of your National ID to automatically fill in your details.
              The system will extract your name and ID number.
            </p>
          </div>
        </div>
      </div>

      {!file ? (
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-emerald-500 transition">
          <Upload className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 mb-2">Upload National ID Photo</p>
          <p className="text-xs text-slate-500 mb-4">
            Supports JPEG and PNG (Max 10MB)
          </p>
          <input
            type="file"
            accept="image/jpeg,image/jpg,image/png"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
            id="id-upload"
          />
          <label
            htmlFor="id-upload"
            className={`inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition cursor-pointer ${
              disabled ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Choose File
          </label>
        </div>
      ) : (
        <div className="border border-slate-300 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Upload className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPreview(true)}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                title="Preview"
              >
                <Eye className="h-5 w-5" />
              </button>
              <button
                onClick={handleReset}
                disabled={processing}
                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                title="Remove"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {!extractedData && !processing && !error && (
            <button
              onClick={handleProcessImage}
              disabled={processing}
              className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
            >
              Extract Data from ID
            </button>
          )}

          {processing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-700 font-medium">Processing ID...</span>
                <span className="text-emerald-600 font-semibold">{progress}%</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-center space-x-2 text-slate-600 py-2">
                <Loader className="h-4 w-4 animate-spin" />
                <span className="text-xs">Reading text from document...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">Extraction Failed</p>
                <p className="text-xs text-red-700 mt-1">{error}</p>
                <button
                  onClick={handleProcessImage}
                  className="text-xs text-red-600 hover:text-red-800 font-semibold mt-2 underline"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {extractedData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-emerald-600" />
                <p className="text-sm font-semibold text-emerald-900">Data Extracted Successfully</p>
              </div>

              <div className="space-y-2 text-sm">
                {extractedData.fullName && (
                  <div className="flex items-start justify-between py-2 border-b border-emerald-100">
                    <div>
                      <p className="text-xs text-emerald-700 font-medium">Full Name</p>
                      <p className="text-slate-900 font-semibold">{extractedData.fullName}</p>
                    </div>
                    {currentValues?.fullName && (
                      <VerificationBadge status={getVerificationStatus('name')} />
                    )}
                  </div>
                )}

                {extractedData.idNumber && (
                  <div className="flex items-start justify-between py-2 border-b border-emerald-100">
                    <div>
                      <p className="text-xs text-emerald-700 font-medium">ID Number</p>
                      <p className="text-slate-900 font-semibold">{extractedData.idNumber}</p>
                    </div>
                    {currentValues?.idNumber && (
                      <VerificationBadge status={getVerificationStatus('id')} />
                    )}
                  </div>
                )}

                {extractedData.dateOfBirth && (
                  <div className="py-2">
                    <p className="text-xs text-emerald-700 font-medium">Date of Birth</p>
                    <p className="text-slate-900 font-semibold">{extractedData.dateOfBirth}</p>
                  </div>
                )}

                <div className="pt-2">
                  <p className="text-xs text-emerald-700">
                    Confidence: {Math.round(extractedData.confidence)}%
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-200">
                <p className="text-xs text-emerald-700">
                  ✓ Data has been auto-filled into the form. Please review and correct if needed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {showPreview && preview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">ID Preview</h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <img src={preview} alt="ID Preview" className="w-full rounded-lg" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationBadge({ status }: { status: { match: boolean; similarity: number } | null }) {
  if (!status) return null;

  if (status.match) {
    return (
      <div className="flex items-center space-x-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-semibold">
        <CheckCircle className="h-3 w-3" />
        <span>Verified</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-semibold">
      <AlertCircle className="h-3 w-3" />
      <span>Check</span>
    </div>
  );
}
