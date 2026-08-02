import React, { useMemo } from 'react';
import type { InboundGrnPostRackingPhotosMeta } from '../../lib/inboundGrnSourceDocs';
import {
  buildPostRackingPhotoStatusMessage,
  savedPostRackingPhotoCount,
  type PostRackingRackTarget,
} from '../../lib/grnPostRackingPhotos';
import StockCheckEvidenceCapture, { type EvidencePhoto } from './StockCheckEvidenceCapture';

type GrnPostRackingPhotosSectionProps = {
  racks: PostRackingRackTarget[];
  photosByRack: Record<string, EvidencePhoto[]>;
  savedMeta?: InboundGrnPostRackingPhotosMeta | null;
  disabled?: boolean;
  onPhotosByRackChange: React.Dispatch<React.SetStateAction<Record<string, EvidencePhoto[]>>>;
};

const GrnPostRackingPhotosSection: React.FC<GrnPostRackingPhotosSectionProps> = ({
  racks,
  photosByRack,
  savedMeta,
  disabled = false,
  onPhotosByRackChange,
}) => {
  const statusMessage = useMemo(
    () => buildPostRackingPhotoStatusMessage(racks, photosByRack, savedMeta),
    [photosByRack, racks, savedMeta],
  );

  return (
    <section className="rounded-xl border border-border bg-surface p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-ink">📷 Post-racking photos (required)</h3>
        <p className="text-[11px] text-ink-2 mt-1">
          Upload at least one photo per rack after physical put-away. Photos are linked to the GRN batch for traceability.
        </p>
      </div>

      {racks.length === 0 ? (
        <p className="text-xs text-warn bg-warn-soft border border-warn-soft rounded-lg px-3 py-2">
          Select rack location(s) in the put-away section above before uploading post-racking photos.
        </p>
      ) : (
        <div className="space-y-4">
          {racks.map((rack) => {
            const photos = photosByRack[rack.rackCode] ?? [];
            const savedCount = savedPostRackingPhotoCount(savedMeta, rack.rackCode);
            return (
              <div key={rack.rackCode} className="rounded-lg border border-border bg-surface-2/60 p-3">
                <p className="text-xs font-semibold text-ink mb-2">{rack.displayLabel}</p>
                <StockCheckEvidenceCapture
                  readOnly={disabled}
                  savedPhotoCount={savedCount}
                  photos={photos}
                  onPhotosChange={(updater) => {
                    onPhotosByRackChange((prev) => {
                      const current = prev[rack.rackCode] ?? [];
                      const next = typeof updater === 'function' ? updater(current) : updater;
                      return { ...prev, [rack.rackCode]: next };
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-ink-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
        {statusMessage}
      </p>
    </section>
  );
};

export default GrnPostRackingPhotosSection;
