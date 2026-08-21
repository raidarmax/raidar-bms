import type { DocumentType } from './documentValidation';

export type DocumentKind = 'national_id' | 'passport';

export type MarkerRule = {
  label: string;
  patterns: RegExp[];
};

export type DocumentRule = {
  minMarkers: number;
  minConfidence: number;
  markers: MarkerRule[];
  identifierRegex?: RegExp;
  identifierLabel?: string;
  alternativeSets?: DocumentRule[];
};

const anyOf = (...patterns: string[]): RegExp[] => patterns.map(p => new RegExp(p, 'i'));

export const DOCUMENT_RULES: Record<string, DocumentRule> = {
  national_id: {
    minMarkers: 3,
    minConfidence: 35,
    markers: [
      { label: 'Republic of Kenya header', patterns: anyOf('republic\\s+of\\s+kenya', 'jamhuri\\s+ya\\s+kenya') },
      { label: 'ID / Serial number field', patterns: anyOf('serial\\s+number', 'id\\s+number', 'identity\\s+card', 'nambari\\s+ya\\s+kitambulisho') },
      { label: 'Full names field', patterns: anyOf('full\\s+names?', 'majina\\s+kamili') },
      { label: 'Date of birth field', patterns: anyOf('date\\s+of\\s+birth', 'd\\.o\\.b', 'tarehe\\s+ya\\s+kuzaliwa') },
      { label: 'Sex / Gender field', patterns: anyOf('\\bsex\\b', '\\bgender\\b', 'jinsia') },
      { label: 'District of birth', patterns: anyOf('district\\s+of\\s+birth', 'place\\s+of\\s+issue', 'place\\s+of\\s+birth') },
    ],
    identifierRegex: /\b\d{7,9}\b/,
    identifierLabel: '7–9 digit ID number',
  },

  passport: {
    minMarkers: 3,
    minConfidence: 30,
    markers: [
      { label: 'Passport label', patterns: anyOf('\\bpassport\\b', 'pasi\\s+ya\\s+kusafiria') },
      { label: 'Republic of Kenya', patterns: anyOf('republic\\s+of\\s+kenya', 'jamhuri\\s+ya\\s+kenya') },
      { label: 'Surname field', patterns: anyOf('surname', 'jina\\s+la\\s+ukoo') },
      { label: 'Given names', patterns: anyOf('given\\s+names?', 'other\\s+names?') },
      { label: 'Nationality', patterns: anyOf('nationality', 'kenyan') },
      { label: 'Machine-readable zone', patterns: [/P<KEN/i, /[A-Z0-9<]{30,}/] },
      { label: 'Date of expiry', patterns: anyOf('date\\s+of\\s+expiry', 'expiry\\s+date') },
    ],
    identifierRegex: /\b[A-Z]{1,2}\d{6,8}\b/,
    identifierLabel: 'Passport number (e.g. A1234567)',
  },

  driving_license: {
    minMarkers: 2,
    minConfidence: 30,
    markers: [
      { label: 'Driving Licence header', patterns: anyOf('driving\\s+licen[cs]e', 'driver.?s\\s+licen[cs]e') },
      { label: 'Republic of Kenya', patterns: anyOf('republic\\s+of\\s+kenya', 'ntsa', 'national\\s+transport') },
      { label: 'License classes', patterns: anyOf('\\bclass(es)?\\b', 'categor(y|ies)', '\\bBCE\\b', '\\bFG\\b') },
      { label: 'Date of expiry', patterns: anyOf('date\\s+of\\s+expiry', 'expiry', 'valid\\s+(until|till|to)') },
      { label: 'Licence number', patterns: anyOf('licen[cs]e\\s+(no|number)', 'dl\\s+no') },
    ],
    identifierRegex: /\b\d{6,12}\b/,
    identifierLabel: 'License number',
    alternativeSets: [
      {
        minMarkers: 3,
        minConfidence: 30,
        markers: [
          { label: 'NTSA header', patterns: anyOf('national\\s+transport\\s+and\\s+safety\\s+authority', 'ntsa') },
          { label: 'Payment / Receipt', patterns: anyOf('receipt', 'payment', 'paid', 'amount\\s+paid', 'bill\\s+reference') },
          { label: 'Driving licence service', patterns: anyOf('driving\\s+licen[cs]e', 'renewal', 'application\\s+no') },
          { label: 'Government portal', patterns: anyOf('ntsa\\.go\\.ke', 'tims', 'ecitizen') },
          { label: 'Applicant / Payer', patterns: anyOf('applicant', 'payer', 'name') },
        ],
        identifierRegex: /\b[A-Z0-9]{6,}\b/,
        identifierLabel: 'Receipt / Reference number',
      },
    ],
  },

  good_conduct: {
    minMarkers: 2,
    minConfidence: 30,
    markers: [
      { label: 'Certificate title', patterns: anyOf('certificate\\s+of\\s+good\\s+conduct', 'police\\s+clearance') },
      { label: 'Directorate of Criminal Investigations', patterns: anyOf('directorate\\s+of\\s+criminal\\s+investigations', '\\bDCI\\b') },
      { label: 'Republic of Kenya', patterns: anyOf('republic\\s+of\\s+kenya') },
      { label: 'Certificate number', patterns: anyOf('certificate\\s+(no|number)', 'ref(erence)?\\s+(no|number)') },
      { label: 'Date of issue', patterns: anyOf('date\\s+of\\s+issue', 'issued\\s+on', 'valid\\s+(until|till|to)') },
    ],
    identifierRegex: /\b[A-Z0-9\-\/]{6,}\b/,
    identifierLabel: 'Certificate number',
  },

  logbook: {
    minMarkers: 2,
    minConfidence: 30,
    markers: [
      { label: 'Republic of Kenya', patterns: anyOf('republic\\s+of\\s+kenya') },
      { label: 'Motor vehicle registration', patterns: anyOf('motor\\s+vehicle', 'registration\\s+book', 'logbook') },
      { label: 'Chassis / Engine number', patterns: anyOf('chassis\\s+(no|number)', 'engine\\s+(no|number)') },
      { label: 'Make / Model', patterns: anyOf('\\bmake\\b', '\\bmodel\\b', 'body\\s+type') },
      { label: 'Owner', patterns: anyOf('owner', 'registered\\s+(owner|to)') },
    ],
    identifierRegex: /\b([A-Z]{2,3})\s?(\d{3})\s?([A-Z]{1,2})\b/,
    identifierLabel: 'Vehicle registration plate',
  },

  insurance_cover: {
    minMarkers: 2,
    minConfidence: 30,
    markers: [
      { label: 'Insurance / Cover note', patterns: anyOf('cover\\s+note', 'insurance\\s+(certificate|policy)', 'certificate\\s+of\\s+insurance') },
      { label: 'Policy number', patterns: anyOf('policy\\s+(no|number)', 'cover\\s+note\\s+no') },
      { label: 'Insured / Insurer', patterns: anyOf('\\binsured\\b', '\\binsurer\\b', 'the\\s+company') },
      { label: 'Period of cover', patterns: anyOf('period\\s+of\\s+(insurance|cover)', 'from', 'to') },
      { label: 'Vehicle plate', patterns: anyOf('registration\\s+(no|number)', 'chassis') },
    ],
    identifierRegex: /\b[A-Z0-9\-\/]{6,}\b/,
    identifierLabel: 'Policy number',
  },

  kra_pin_doc: {
    minMarkers: 2,
    minConfidence: 30,
    markers: [
      { label: 'KRA branding', patterns: anyOf('kenya\\s+revenue\\s+authority', '\\bKRA\\b') },
      { label: 'PIN Certificate', patterns: anyOf('pin\\s+certificate', 'personal\\s+identification\\s+number', 'taxpayer') },
      { label: 'PIN identifier', patterns: [/\bP\d{9}[A-Z]\b/i, /\bA\d{9}[A-Z]\b/i] },
      { label: 'Registration date', patterns: anyOf('registration\\s+date', 'issued\\s+on') },
    ],
    identifierRegex: /\b[PA]\d{9}[A-Z]\b/i,
    identifierLabel: 'KRA PIN (e.g. A123456789Z)',
  },

  bike_photo_side: {
    minMarkers: 0,
    minConfidence: 0,
    markers: [],
  },

  bike_photo_back: {
    minMarkers: 0,
    minConfidence: 0,
    markers: [],
  },
};

export type MarkerCheckResult = {
  passed: boolean;
  matchedMarkers: string[];
  missingMarkers: string[];
  hasIdentifier: boolean;
  identifierValue: string | null;
  identifierLabel: string | null;
  reason: string;
};

const evaluateRule = (rule: DocumentRule, text: string): MarkerCheckResult => {
  const matched: string[] = [];
  const missing: string[] = [];
  for (const m of rule.markers) {
    const hit = m.patterns.some(p => p.test(text));
    if (hit) matched.push(m.label);
    else missing.push(m.label);
  }
  let identifierValue: string | null = null;
  if (rule.identifierRegex) {
    const match = text.match(rule.identifierRegex);
    identifierValue = match ? match[0] : null;
  }
  const hasIdentifier = !rule.identifierRegex || !!identifierValue;
  const passed = matched.length >= rule.minMarkers && hasIdentifier;

  const reason = passed
    ? `Matched ${matched.length}/${rule.markers.length} expected markers`
    : `Only ${matched.length}/${rule.minMarkers} required markers found${!hasIdentifier ? `; ${rule.identifierLabel} not detected` : ''}`;

  return {
    passed,
    matchedMarkers: matched,
    missingMarkers: missing,
    hasIdentifier,
    identifierValue,
    identifierLabel: rule.identifierLabel ?? null,
    reason,
  };
};

export const checkDocumentMarkers = (
  documentType: DocumentType,
  documentKind: DocumentKind | null,
  rawText: string,
  ocrConfidence: number,
  extraKeywords: string[] = [],
): MarkerCheckResult => {
  const ruleKey = documentType === 'national_id' && documentKind === 'passport' ? 'passport' : documentType;
  const rule = DOCUMENT_RULES[ruleKey];

  if (!rule || rule.minMarkers === 0) {
    return {
      passed: true,
      matchedMarkers: [],
      missingMarkers: [],
      hasIdentifier: true,
      identifierValue: null,
      identifierLabel: null,
      reason: 'No marker validation required',
    };
  }

  const text = rawText.toLowerCase();

  const augmentedRule: DocumentRule = extraKeywords.length
    ? {
        ...rule,
        markers: [
          ...rule.markers,
          ...extraKeywords.map(kw => ({ label: `Admin keyword: "${kw}"`, patterns: [new RegExp(kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i')] })),
        ],
      }
    : rule;

  const primary = evaluateRule(augmentedRule, text);

  const alternatives = rule.alternativeSets ?? [];
  if (!primary.passed && alternatives.length > 0) {
    for (const alt of alternatives) {
      const altResult = evaluateRule(alt, text);
      if (altResult.passed && ocrConfidence >= alt.minConfidence) {
        return { ...altResult, reason: `${altResult.reason} (matched as alternative document)` };
      }
    }
  }

  if (ocrConfidence < rule.minConfidence) {
    return {
      ...primary,
      passed: false,
      reason: `OCR confidence too low (${Math.round(ocrConfidence)}% < ${rule.minConfidence}%). ${primary.reason}`,
    };
  }

  return primary;
};
