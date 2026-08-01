import React, { useEffect, useState } from 'react';
import type { ThirdPartyPoPreviewInput } from '../../lib/thirdPartyLabTest';

type ThirdPartyPoPdfPreviewProps = {
  poInput: ThirdPartyPoPreviewInput;
};

const ThirdPartyPoPdfPreview: React.FC<ThirdPartyPoPdfPreviewProps> = ({ poInput }) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    void import('../../lib/thirdPartyTestPoPdf')
      .then((mod) => {
        if (cancelled) return;
        objectUrl = mod.createThirdPartyTestPoPdfBlobUrl(poInput);
        setPdfUrl(objectUrl);
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not render PDF preview');
        setPdfUrl(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [poInput]);

  if (error) {
    return (
      <p className="text-xs text-rose-700 py-4 text-center" role="alert">
        {error}
      </p>
    );
  }

  if (!pdfUrl) {
    return <p className="text-xs text-ink-3 py-8 text-center">Generating PDF preview…</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface-3 overflow-hidden">
      <iframe
        title={`PO preview ${poInput.poNo}`}
        src={pdfUrl}
        className="w-full h-[min(70vh,520px)] bg-surface"
      />
    </div>
  );
};

export default ThirdPartyPoPdfPreview;
