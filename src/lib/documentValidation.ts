import { extractIdData, compareFields, type ExtractedIdData } from './ocrProcessor';
import { isPdfFile } from './pdfReader';
import { checkDocumentMarkers, type DocumentKind, type MarkerCheckResult } from './documentMarkers';
import { fetchSampleKeywords } from './documentSamples';

export type { DocumentKind } from './documentMarkers';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DocumentType =
  | 'national_id'
  | 'driving_license'
  | 'good_conduct'
  | 'logbook'
  | 'insurance_cover'
  | 'kra_pin_doc'
  | 'bike_photo_side'
  | 'bike_photo_back';

export type ValidationStatus =
  | 'pending'
  | 'validated'
  | 'mismatch'
  | 'expired'
  | 'unreadable';

export type FieldMatch = {
  match: boolean;
  similarity: number;
};

export type DocumentValidationResult = {
  status: ValidationStatus;
  extractedName: string;
  extractedIdNumber: string;
  extractedDateOfBirth: string;
  issueDate: string | null;
  expiryDate: string | null;
  ocrConfidence: number;
  fieldMatches: {
    name?: FieldMatch;
    idNumber?: FieldMatch;
    plateNumber?: FieldMatch;
  };
  summary: string;
  rawText: string;
  documentKind?: DocumentKind | null;
  markerCheck?: MarkerCheckResult;
};

export type StoredDocumentValidation = {
  id: string;
  user_type: 'rider' | 'owner';
  user_id: string;
  document_type: DocumentType;
  file_url: string;
  file_name: string | null;
  validation_status: ValidationStatus;
  extracted_name: string | null;
  extracted_id_number: string | null;
  extracted_date_of_birth: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  ocr_confidence: number | null;
  document_kind?: DocumentKind | null;
  field_matches: {
    name?: FieldMatch;
    idNumber?: FieldMatch;
    plateNumber?: FieldMatch;
  } | null;
  summary: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
};

// ── Document type metadata ────────────────────────────────────────────────────

export const DOCUMENT_LABELS: Record<DocumentType, string> = {
  national_id: 'National ID',
  driving_license: 'Driving License',
  good_conduct: 'Good Conduct Certificate',
  logbook: 'Logbook',
  insurance_cover: 'Insurance Cover Note',
  kra_pin_doc: 'KRA PIN Document',
  bike_photo_side: 'Bike Photo (Side)',
  bike_photo_back: 'Bike Photo (Back / Plate)',
};

export const DOCUMENT_ICONS: Record<DocumentType, string> = {
  national_id: 'CreditCard',
  driving_license: 'CreditCard',
  good_conduct: 'Award',
  logbook: 'BookOpen',
  insurance_cover: 'ShieldCheck',
  kra_pin_doc: 'FileText',
  bike_photo_side: 'Bike',
  bike_photo_back: 'Bike',
};

// ── Kenyan plate extraction ───────────────────────────────────────────────────

const extractPlateNumber = (text: string): string => {
  // Kenyan plate format: KXX 123X or KXX 123XX (e.g. KDA 123A, KME 123AB)
  // Also handles no-space variants: KDA123A
  const platePattern = /\b([A-Z]{1,3})\s?(\d{3})\s?([A-Z]{1,2})\b/gi;
  const matches = text.match(platePattern);
  if (matches && matches.length > 0) {
    // Return the first match, cleaned up
    return matches[0].replace(/\s+/g, ' ').trim().toUpperCase();
  }
  // Fallback: look for any short alphanumeric sequence that looks like a plate
  const shortPattern = /\b([A-Z]{2,3})\s?(\d{2,3})\s?([A-Z]{1,2})\b/gi;
  const fallbackMatches = text.match(shortPattern);
  if (fallbackMatches && fallbackMatches.length > 0) {
    return fallbackMatches[0].replace(/\s+/g, ' ').trim().toUpperCase();
  }
  return '';
};

// ── Date parsing helpers ─────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

const parseDate = (text: string): string | null => {
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const numericMatch = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (numericMatch) {
    let [, dd, mm, yy] = numericMatch;
    if (yy.length === 2) yy = `20${yy}`;
    const day = dd.padStart(2, '0');
    const month = mm.padStart(2, '0');
    return `${yy}-${month}-${day}`;
  }

  // 12 January 2020 / 12 Jan 2020
  const monthNameMatch = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/);
  if (monthNameMatch) {
    let [, dd, monthStr, yy] = monthNameMatch;
    const monthNum = MONTH_NAMES[monthStr.toLowerCase()];
    if (monthNum) {
      if (yy.length === 2) yy = `20${yy}`;
      return `${yy}-${String(monthNum).padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  return null;
};

const parseExpiryDate = (text: string): string | null => {
  const lower = text.toLowerCase();

  // Look for "expiry", "expires", "valid until", "exp" near a date
  const expiryPatterns = [
    /(?:expiry|expires|exp(?:iry)?\s*(?:date)?|valid\s+(?:until|till|to)|exp\.)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:expiry|expires|exp(?:iry)?\s*(?:date)?|valid\s+(?:until|till|to)|exp\.)\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
  /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*(?:expiry|expires|exp)/i,
  /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s*(?:expiry|expires|exp)/i,
  /valid\s+(?:until|till|to)\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  /valid\s+(?:until|till|to)\s+(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
  /exp(?:iry)?\s*(?:date)?\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  /exp(?:iry)?\s*(?:date)?\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
  /(?:date\s+of\s+expiry|date\s+of\s+expiration)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:date\s+of\s+expiry|date\s+of\s+expiration)\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
  ];

  for (const pattern of expiryPatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const parsed = parseDate(match[1]);
      if (parsed) return parsed;
    }
  }

  // Fallback: if text mentions "expiry" and there's only one date, use it
  if (lower.includes('expir') || lower.includes('valid until') || lower.includes('valid till')) {
    return parseDate(text);
  }

  return null;
};

const parseIssueDate = (text: string): string | null => {
  const lower = text.toLowerCase();

  const issuePatterns = [
    /(?:issue|issued|date\s+of\s+issue|date\s+issued)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /(?:issue|issued|date\s+of\s+issue|date\s+issued)\s*[:\-]?\s*(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/i,
    /(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*(?:issue|issued)/i,
    /(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})\s*(?:issue|issued)/i,
  ];

  for (const pattern of issuePatterns) {
    const match = lower.match(pattern);
    if (match && match[1]) {
      const parsed = parseDate(match[1]);
      if (parsed) return parsed;
    }
  }

  return null;
};

// ── Expiry status ────────────────────────────────────────────────────────────

export const getExpiryStatus = (expiryDate: string | null): 'valid' | 'expiring' | 'expired' | 'none' => {
  if (!expiryDate) return 'none';
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring';
  return 'valid';
};

export const formatDaysRemaining = (expiryDate: string | null): string => {
  if (!expiryDate) return '';
  const status = getExpiryStatus(expiryDate);
  const days = Math.abs(Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  if (status === 'expired') return `Expired ${days} day${days === 1 ? '' : 's'} ago`;
  if (status === 'expiring') return `Expiring in ${days} day${days === 1 ? '' : 's'}`;
  return `Valid for ${days} more day${days === 1 ? '' : 's'}`;
};

export const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Bike back photo plate validation ──────────────────────────────────────────

const validateBikeBackPhoto = async (
  file: File,
  expectedPlateNumber?: string,
  onProgress?: (p: number) => void,
): Promise<DocumentValidationResult> => {
  const ocrResult = await extractIdData(file, onProgress);

  if (!ocrResult.success || !ocrResult.data) {
    return {
      status: 'unreadable',
      extractedName: '',
      extractedIdNumber: '',
      extractedDateOfBirth: '',
      issueDate: null,
      expiryDate: null,
      ocrConfidence: 0,
      fieldMatches: {},
      summary: `Could not read the back photo. OCR error: ${ocrResult.error ?? 'unknown'}. Please ensure the number plate is clearly visible and well-lit.`,
      rawText: '',
    };
  }

  const rawText = ocrResult.data.rawText;
  const extractedPlate = extractPlateNumber(rawText);
  const confidence = ocrResult.data.confidence;

  const fieldMatches: DocumentValidationResult['fieldMatches'] = {};

  if (expectedPlateNumber && extractedPlate) {
    fieldMatches.plateNumber = compareFields(expectedPlateNumber, extractedPlate);
  }

  let status: ValidationStatus = 'validated';
  if (fieldMatches.plateNumber && !fieldMatches.plateNumber.match) {
    status = 'mismatch';
  }

  const summaryParts: string[] = [];
  if (extractedPlate) {
    summaryParts.push(`Plate detected: ${extractedPlate}`);
  } else {
    summaryParts.push('No plate number detected');
  }
  if (expectedPlateNumber) {
    summaryParts.push(`Expected: ${expectedPlateNumber.toUpperCase()}`);
  }
  if (fieldMatches.plateNumber) {
    summaryParts.push(fieldMatches.plateNumber.match ? 'Plate matches registration' : 'Plate mismatch');
  }
  summaryParts.push(`OCR confidence: ${Math.round(confidence)}%`);

  return {
    status,
    extractedName: '',
    extractedIdNumber: extractedPlate,
    extractedDateOfBirth: '',
    issueDate: null,
    expiryDate: null,
    ocrConfidence: confidence,
    fieldMatches,
    summary: summaryParts.join(' · '),
    rawText,
  };
};

// ── Core validation function ──────────────────────────────────────────────────

export type ValidateDocumentOptions = {
  documentType: DocumentType;
  file: File;
  expectedName?: string;
  expectedIdNumber?: string;
  expectedPlateNumber?: string;
  knownExpiryDate?: string | null;
  documentKind?: DocumentKind | null;
};

export const validateDocument = async (
  opts: ValidateDocumentOptions,
  onProgress?: (progress: number) => void,
): Promise<DocumentValidationResult> => {
  const { documentType, file, expectedName, expectedIdNumber, expectedPlateNumber, knownExpiryDate, documentKind } = opts;

  // Side photo — visual only, no OCR needed
  if (documentType === 'bike_photo_side') {
    return {
      status: 'validated',
      extractedName: '',
      extractedIdNumber: '',
      extractedDateOfBirth: '',
      issueDate: null,
      expiryDate: null,
      ocrConfidence: 0,
      fieldMatches: {},
      summary: 'Side photo uploaded. Visual document — no OCR validation required.',
      rawText: '',
    };
  }

  // Back photo with plate — run OCR to extract and validate the plate number
  if (documentType === 'bike_photo_back') {
    return validateBikeBackPhoto(file, expectedPlateNumber, onProgress);
  }

  // Run OCR
  const ocrResult = await extractIdData(file, onProgress);

  if (!ocrResult.success || !ocrResult.data) {
    return {
      status: 'unreadable',
      extractedName: '',
      extractedIdNumber: '',
      extractedDateOfBirth: '',
      issueDate: null,
      expiryDate: null,
      ocrConfidence: 0,
      fieldMatches: {},
      summary: `Could not read document. OCR error: ${ocrResult.error ?? 'unknown'}. Please ensure the image is clear and well-lit.`,
      rawText: '',
    };
  }

  const data: ExtractedIdData = ocrResult.data;
  const rawText = data.rawText;

  const extraKeywords = await fetchSampleKeywords(documentType, documentKind ?? null).catch(() => []);
  const markerCheck = checkDocumentMarkers(documentType, documentKind ?? null, rawText, data.confidence, extraKeywords);

  // Parse dates from raw text
  let issueDate = parseIssueDate(rawText);
  let expiryDate = parseExpiryDate(rawText);

  // Use known expiry date if parsing failed (e.g. from profile form)
  if (!expiryDate && knownExpiryDate) {
    expiryDate = knownExpiryDate;
  }

  // For driving license, if no expiry found, try to find any date that's in the future
  if (!expiryDate && documentType === 'driving_license') {
    const allDates = rawText.match(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b/g) || [];
    for (const dateStr of allDates) {
      const parsed = parseDate(dateStr);
      if (parsed) {
        const future = new Date(parsed).getTime() > Date.now();
        if (future) {
          expiryDate = parsed;
          break;
        }
      }
    }
  }

  // Field matching
  const fieldMatches: DocumentValidationResult['fieldMatches'] = {};

  if (expectedName && data.fullName) {
    fieldMatches.name = compareFields(expectedName, data.fullName);
  }
  if (expectedIdNumber && data.idNumber) {
    fieldMatches.idNumber = compareFields(expectedIdNumber, data.idNumber);
  }

  // Determine status
  let status: ValidationStatus = 'validated';

  const hasMismatch =
    (fieldMatches.name && !fieldMatches.name.match) ||
    (fieldMatches.idNumber && !fieldMatches.idNumber.match);

  if (hasMismatch) {
    status = 'mismatch';
  } else if (expiryDate && getExpiryStatus(expiryDate) === 'expired') {
    status = 'expired';
  }

  // Build summary
  const summaryParts: string[] = [];

  if (documentType === 'national_id') {
    if (data.fullName) summaryParts.push(`Name: ${data.fullName}`);
    if (data.idNumber) summaryParts.push(`ID No: ${data.idNumber}`);
    if (data.dateOfBirth) summaryParts.push(`DOB: ${data.dateOfBirth}`);
  } else if (documentType === 'driving_license') {
    if (data.fullName) summaryParts.push(`Name: ${data.fullName}`);
    if (data.idNumber) summaryParts.push(`License No: ${data.idNumber}`);
    if (issueDate) summaryParts.push(`Issued: ${formatDate(issueDate)}`);
    if (expiryDate) summaryParts.push(`Expires: ${formatDate(expiryDate)}`);
  } else if (documentType === 'good_conduct') {
    if (data.fullName) summaryParts.push(`Name: ${data.fullName}`);
    if (data.idNumber) summaryParts.push(`Certificate No: ${data.idNumber}`);
    if (issueDate) summaryParts.push(`Issued: ${formatDate(issueDate)}`);
    if (expiryDate) summaryParts.push(`Valid until: ${formatDate(expiryDate)}`);
  } else if (documentType === 'insurance_cover') {
    if (data.idNumber) summaryParts.push(`Policy No: ${data.idNumber}`);
    if (issueDate) summaryParts.push(`Issued: ${formatDate(issueDate)}`);
    if (expiryDate) summaryParts.push(`Expires: ${formatDate(expiryDate)}`);
  } else if (documentType === 'logbook') {
    if (data.idNumber) summaryParts.push(`Reg No: ${data.idNumber}`);
    if (issueDate) summaryParts.push(`Registered: ${formatDate(issueDate)}`);
  } else if (documentType === 'kra_pin_doc') {
    if (data.idNumber) summaryParts.push(`KRA PIN: ${data.idNumber}`);
    if (data.fullName) summaryParts.push(`Name: ${data.fullName}`);
  }

  if (fieldMatches.name) {
    summaryParts.push(fieldMatches.name.match ? 'Name matches profile' : 'Name mismatch');
  }
  if (fieldMatches.idNumber) {
    summaryParts.push(fieldMatches.idNumber.match ? 'ID matches profile' : 'ID mismatch');
  }

  if (expiryDate) {
    const expStatus = getExpiryStatus(expiryDate);
    if (expStatus === 'expired') {
      summaryParts.push('DOCUMENT EXPIRED');
    } else if (expStatus === 'expiring') {
      summaryParts.push('Expiring soon');
    }
  }

  if (summaryParts.length === 0) {
    summaryParts.push(`OCR confidence: ${Math.round(data.confidence)}%. Document uploaded for manual review.`);
  } else {
    summaryParts.push(`OCR confidence: ${Math.round(data.confidence)}%`);
  }

  return {
    status,
    extractedName: data.fullName,
    extractedIdNumber: data.idNumber,
    extractedDateOfBirth: data.dateOfBirth,
    issueDate,
    expiryDate,
    ocrConfidence: data.confidence,
    fieldMatches,
    summary: summaryParts.join(' · '),
    rawText,
    documentKind: documentKind ?? null,
    markerCheck,
  };
};

// ── Supabase persistence ─────────────────────────────────────────────────────

import { supabase } from './supabase';

export const saveDocumentValidation = async (
  userType: 'rider' | 'owner',
  userId: string,
  documentType: DocumentType,
  fileUrl: string,
  fileName: string,
  result: DocumentValidationResult,
): Promise<StoredDocumentValidation | null> => {
  const { data, error } = await supabase
    .from('document_validations')
    .insert({
      user_type: userType,
      user_id: userId,
      document_type: documentType,
      file_url: fileUrl,
      file_name: fileName,
      validation_status: result.status,
      extracted_name: result.extractedName || null,
      extracted_id_number: result.extractedIdNumber || null,
      extracted_date_of_birth: result.extractedDateOfBirth || null,
      issue_date: result.issueDate,
      expiry_date: result.expiryDate,
      ocr_confidence: result.ocrConfidence || null,
      field_matches: result.fieldMatches,
      summary: result.summary,
      raw_text: result.rawText || null,
      document_kind: result.documentKind ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save document validation:', error);
    return null;
  }

  return data as unknown as StoredDocumentValidation;
};

export const fetchDocumentValidations = async (
  userType: 'rider' | 'owner',
  userId: string,
): Promise<StoredDocumentValidation[]> => {
  const { data, error } = await supabase
    .from('document_validations')
    .select('*')
    .eq('user_type', userType)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch document validations:', error);
    return [];
  }

  return (data ?? []) as unknown as StoredDocumentValidation[];
};

export const deleteDocumentValidation = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('document_validations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete document validation:', error);
    return false;
  }

  return true;
};

// ── Revalidate existing document ─────────────────────────────────────────────

export type RevalidateOptions = {
  userType: 'rider' | 'owner';
  userId: string;
  documentType: DocumentType;
  fileUrl: string;
  fileName: string;
  expectedName?: string;
  expectedIdNumber?: string;
  expectedPlateNumber?: string;
  knownExpiryDate?: string | null;
};

export type RevalidateResult = {
  success: boolean;
  result?: DocumentValidationResult;
  stored?: StoredDocumentValidation;
  error?: string;
};

const fetchFileFromUrl = async (url: string, fileName: string): Promise<File | null> => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new File([blob], fileName, { type: blob.type });
  } catch {
    return null;
  }
};

export const revalidateDocument = async (
  opts: RevalidateOptions,
  onProgress?: (p: number) => void,
): Promise<RevalidateResult> => {
  const file = await fetchFileFromUrl(opts.fileUrl, opts.fileName || 'document');
  if (!file) {
    return { success: false, error: 'Failed to download the document file for re-validation.' };
  }

  const result = await validateDocument({
    documentType: opts.documentType,
    file,
    expectedName: opts.expectedName,
    expectedIdNumber: opts.expectedIdNumber,
    expectedPlateNumber: opts.expectedPlateNumber,
    knownExpiryDate: opts.knownExpiryDate,
  }, onProgress);

  // Delete old validation records for this doc type, then save the new one
  await supabase
    .from('document_validations')
    .delete()
    .eq('user_type', opts.userType)
    .eq('user_id', opts.userId)
    .eq('document_type', opts.documentType);

  const stored = await saveDocumentValidation(
    opts.userType, opts.userId, opts.documentType, opts.fileUrl, opts.fileName, result,
  );

  return { success: true, result, stored: stored ?? undefined };
};

// ── Pre-upload gate ───────────────────────────────────────────────────────────
// Runs OCR + marker check WITHOUT uploading. Callers use this to reject
// obviously wrong documents (screenshots, unrelated PDFs) before they hit storage.

export type PreflightResult = {
  ok: boolean;
  markerCheck: MarkerCheckResult;
  ocrConfidence: number;
  extractedText: string;
  isPdf: boolean;
  fileType: string;
  reason?: string;
};

export const preflightDocument = async (
  documentType: DocumentType,
  file: File,
  documentKind: DocumentKind | null = null,
  onProgress?: (progress: number) => void,
): Promise<PreflightResult> => {
  const isPdf = isPdfFile(file);
  const acceptedImage = /^image\/(jpe?g|png|webp|heic|heif)$/i.test(file.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

  if (!isPdf && !acceptedImage) {
    return {
      ok: false,
      markerCheck: {
        passed: false, matchedMarkers: [], missingMarkers: [], hasIdentifier: false,
        identifierValue: null, identifierLabel: null,
        reason: 'File type not supported',
      },
      ocrConfidence: 0, extractedText: '',
      isPdf, fileType: file.type,
      reason: 'Only JPG, PNG, WEBP and PDF files are accepted.',
    };
  }

  const ocr = await extractIdData(file, onProgress);
  if (!ocr.success || !ocr.data) {
    return {
      ok: false,
      markerCheck: {
        passed: false, matchedMarkers: [], missingMarkers: [], hasIdentifier: false,
        identifierValue: null, identifierLabel: null,
        reason: ocr.error ?? 'Could not read the document',
      },
      ocrConfidence: 0, extractedText: '',
      isPdf, fileType: file.type,
      reason: ocr.error ?? 'Could not read the document. Try a clearer scan.',
    };
  }

  const rawText = ocr.data.rawText;
  const extraKeywords = await fetchSampleKeywords(documentType, documentKind).catch(() => []);
  const markerCheck = checkDocumentMarkers(documentType, documentKind, rawText, ocr.data.confidence, extraKeywords);

  return {
    ok: markerCheck.passed,
    markerCheck,
    ocrConfidence: ocr.data.confidence,
    extractedText: rawText,
    isPdf,
    fileType: file.type,
    reason: markerCheck.passed ? undefined : markerCheck.reason,
  };
};