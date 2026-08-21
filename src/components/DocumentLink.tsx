import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import DocumentViewerModal from './DocumentViewerModal';
import { supabase } from '../lib/supabase';
import type { DocumentType, StoredDocumentValidation } from '../lib/documentValidation';

type DocumentLinkProps = {
  fileUrl: string | null | undefined;
  label: string;
  fileName?: string | null;
  userType?: 'rider' | 'owner';
  userId?: string;
  documentType?: DocumentType;
  className?: string;
  iconOnly?: boolean;
};

export default function DocumentLink({
  fileUrl, label, fileName, userType, userId, documentType, className, iconOnly,
}: DocumentLinkProps) {
  const [open, setOpen] = useState(false);
  const [validation, setValidation] = useState<StoredDocumentValidation | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded || !userType || !userId || !documentType) return;
    let cancelled = false;
    const key = userType === 'rider' ? 'rider_id' : 'owner_id';
    supabase
      .from('document_validations')
      .select('*')
      .eq(key, userId)
      .eq('document_type', documentType)
      .order('validated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) {
          setValidation((data as unknown as StoredDocumentValidation) ?? null);
          setLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [open, loaded, userType, userId, documentType]);

  if (!fileUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? 'flex items-center gap-2 text-emerald-600 hover:text-emerald-700 text-sm font-medium'}
      >
        <FileText className="h-4 w-4" />
        {!iconOnly && <span>{label}</span>}
      </button>
      <DocumentViewerModal
        open={open}
        onClose={() => setOpen(false)}
        fileUrl={fileUrl}
        fileName={fileName}
        title={label}
        documentType={documentType}
        validation={validation}
      />
    </>
  );
}
