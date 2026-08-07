import { supabase } from './supabase';
import type { DocumentType } from './documentValidation';
import type { DocumentKind } from './documentMarkers';

export type DocumentSample = {
  id: string;
  document_type: DocumentType;
  document_kind: DocumentKind | null;
  label: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  keywords: string[];
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const keywordCache = new Map<string, { keywords: string[]; ts: number }>();
const CACHE_TTL_MS = 60_000;

const cacheKey = (docType: DocumentType, kind: DocumentKind | null) => `${docType}::${kind ?? 'default'}`;

export const fetchSampleKeywords = async (
  documentType: DocumentType,
  documentKind: DocumentKind | null,
): Promise<string[]> => {
  const key = cacheKey(documentType, documentKind);
  const cached = keywordCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.keywords;

  let query = supabase
    .from('document_samples')
    .select('keywords, document_kind')
    .eq('document_type', documentType)
    .eq('active', true);

  const { data, error } = await query;
  if (error || !data) return [];

  const keywords = new Set<string>();
  for (const row of data) {
    if (documentKind && row.document_kind && row.document_kind !== documentKind) continue;
    for (const kw of (row.keywords ?? [])) {
      const trimmed = String(kw).trim();
      if (trimmed) keywords.add(trimmed);
    }
  }
  const list = Array.from(keywords);
  keywordCache.set(key, { keywords: list, ts: Date.now() });
  return list;
};

export const invalidateSampleKeywordCache = () => keywordCache.clear();

export const fetchAllSamples = async (): Promise<DocumentSample[]> => {
  const { data, error } = await supabase
    .from('document_samples')
    .select('*')
    .order('document_type')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as DocumentSample[];
};

export const upsertSample = async (
  sample: Omit<DocumentSample, 'id' | 'created_at' | 'updated_at'> & { id?: string },
): Promise<DocumentSample | null> => {
  invalidateSampleKeywordCache();
  const payload = {
    document_type: sample.document_type,
    document_kind: sample.document_kind,
    label: sample.label,
    description: sample.description,
    file_url: sample.file_url,
    file_name: sample.file_name,
    keywords: sample.keywords,
    active: sample.active,
    created_by: sample.created_by,
    updated_at: new Date().toISOString(),
  };

  if (sample.id) {
    const { data, error } = await supabase
      .from('document_samples')
      .update(payload)
      .eq('id', sample.id)
      .select()
      .maybeSingle();
    if (error) { console.error(error); return null; }
    return data as unknown as DocumentSample | null;
  }

  const { data, error } = await supabase
    .from('document_samples')
    .insert(payload)
    .select()
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data as unknown as DocumentSample | null;
};

export const deleteSample = async (id: string): Promise<boolean> => {
  invalidateSampleKeywordCache();
  const { error } = await supabase.from('document_samples').delete().eq('id', id);
  return !error;
};
