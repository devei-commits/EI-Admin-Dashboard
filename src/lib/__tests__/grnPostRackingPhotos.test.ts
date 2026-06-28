import { describe, expect, it } from 'vitest';
import {
  buildPostRackingPhotoStatusMessage,
  extractPostRackingRackTargets,
  postRackingPhotoBlockers,
} from '../grnPostRackingPhotos';

describe('grnPostRackingPhotos', () => {
  it('extracts unique rack codes from location prefix and label payloads', () => {
    const racks = extractPostRackingRackTargets({
      locationPrefix: 'D08-A1',
      warehouseCode: 'MW',
      generatedLabels: [
        {
          boxIndex: 1,
          qrPayload: JSON.stringify({ toRack: 'D08-A2' }),
          qrImageDataUrl: '',
        },
      ],
    });
    expect(racks.map((r) => r.rackCode)).toEqual(['D08-A1', 'D08-A2']);
    expect(racks[0]?.displayLabel).toBe('MW · Rack-D08-A1');
  });

  it('builds status message when all racks have photos', () => {
    const racks = extractPostRackingRackTargets({ locationPrefix: 'D08-A1', warehouseCode: 'MW' });
    const msg = buildPostRackingPhotoStatusMessage(racks, { 'D08-A1': { length: 2 } });
    expect(msg).toContain('✓ Rack D08-A1');
    expect(msg).toContain('2 photos uploaded');
  });

  it('blocks completion when a rack has no photos', () => {
    const racks = extractPostRackingRackTargets({
      locationPrefix: 'D08-A1',
      generatedLabels: [
        { boxIndex: 1, qrPayload: JSON.stringify({ rack: 'D08-A2' }), qrImageDataUrl: '' },
      ],
    });
    const blockers = postRackingPhotoBlockers(racks, { 'D08-A1': { length: 1 } });
    expect(blockers.some((b) => b.includes('D08-A2'))).toBe(true);
  });
});
