import React, { useCallback, useEffect, useRef, useState } from 'react';

export type EvidencePhoto = {
  id: string;
  previewUrl: string;
  file: File;
  source: 'file' | 'camera';
};

type StockCheckEvidenceCaptureProps = {
  readOnly: boolean;
  savedPhotoCount: number;
  photos: EvidencePhoto[];
  onPhotosChange: React.Dispatch<React.SetStateAction<EvidencePhoto[]>>;
};

function buildEvidenceFile(blob: Blob, source: 'file' | 'camera'): File {
  const type = blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : 'jpg';
  return new File([blob], `audit-evidence-${source}-${Date.now()}.${ext}`, { type });
}

function filesToPhotos(files: FileList | File[]): EvidencePhoto[] {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
  return list.map((file) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    previewUrl: URL.createObjectURL(file),
    file,
    source: 'file' as const,
  }));
}

const StockCheckEvidenceCapture: React.FC<StockCheckEvidenceCaptureProps> = ({
  readOnly,
  savedPhotoCount,
  photos,
  onPhotosChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const appendPhotos = useCallback(
    (next: EvidencePhoto[]) => {
      if (next.length === 0) return;
      onPhotosChange((prev) => [...prev, ...next]);
    },
    [onPhotosChange],
  );

  const removePhoto = (id: string) => {
    onPhotosChange((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
    setCameraOpen(false);
    setCameraError(null);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera not supported in this browser. Use “Upload from files” or the device camera button.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setCameraReady(true);
      }
    } catch {
      setCameraError('Could not access camera. Check permissions or upload a photo from files instead.');
      stopCamera();
    }
  }, [stopCamera]);

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth <= 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = buildEvidenceFile(blob, 'camera');
        appendPhotos([
          {
            id: `${Date.now()}-camera`,
            previewUrl: URL.createObjectURL(file),
            file,
            source: 'camera',
          },
        ]);
        stopCamera();
      },
      'image/jpeg',
      0.92,
    );
  };

  useEffect(() => () => {
    stopCamera();
  }, [stopCamera]);

  const handleFileInput = (files: FileList | null) => {
    if (!files || readOnly) return;
    appendPhotos(filesToPhotos(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (readOnly) return;
    handleFileInput(e.dataTransfer.files);
  };

  if (readOnly) {
    const total = photos.length > 0 ? photos.length : savedPhotoCount;
    return (
      <p className="text-xs text-ink-2">
        {total > 0
          ? `${total} photo${total === 1 ? '' : 's'} uploaded`
          : 'No photos uploaded'}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
          dragActive
            ? 'border-brand bg-brand-soft'
            : 'border-border bg-surface-2 hover:border-border'
        }`}
      >
        <p className="text-xs text-ink-2">
          {photos.length > 0
            ? `✓ ${photos.length} photo${photos.length === 1 ? '' : 's'} added · drag & drop more`
            : 'Drag & drop evidence photos here'}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            Upload from files
          </button>
          <button
            type="button"
            onClick={() => void startCamera()}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            Use device camera
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-semibold text-ink-2 hover:bg-surface-2"
          >
            Open camera app
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          aria-label="Upload evidence photos from files"
          className="sr-only"
          onChange={(e) => handleFileInput(e.target.files)}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Capture evidence photo with device camera"
          className="sr-only"
          onChange={(e) => handleFileInput(e.target.files)}
        />
      </div>

      {cameraOpen ? (
        <div className="rounded-lg border border-border bg-ink p-3 space-y-3">
          {cameraError ? (
            <p className="text-xs text-err" role="alert">
              {cameraError}
            </p>
          ) : (
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full max-h-64 rounded bg-black object-contain"
            />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={captureFromCamera}
              disabled={!cameraReady}
              className="px-3 py-1.5 rounded-lg bg-surface text-xs font-semibold text-ink hover:bg-surface-2 disabled:opacity-50"
            >
              Capture photo
            </button>
            <button
              type="button"
              onClick={stopCamera}
              className="px-3 py-1.5 rounded-lg border border-ink-3 text-xs font-semibold text-white hover:bg-ink-2"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="relative rounded-lg border border-border overflow-hidden bg-surface">
              <img
                src={photo.previewUrl}
                alt={`Evidence ${photo.source}`}
                width={160}
                height={120}
                className="w-full h-24 object-cover"
              />
              <div className="px-2 py-1 flex items-center justify-between gap-1 bg-surface-2 border-t border-hairline">
                <span className="text-[10px] text-ink-3 truncate">
                  {photo.source === 'camera' ? 'Camera' : 'File'}
                </span>
                <button
                  type="button"
                  onClick={() => removePhoto(photo.id)}
                  className="text-[10px] font-semibold text-err hover:opacity-80"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : savedPhotoCount > 0 ? (
        <p className="text-[11px] text-ink-3">
          {savedPhotoCount} photo{savedPhotoCount === 1 ? '' : 's'} saved on a previous save (previews not stored).
        </p>
      ) : null}
    </div>
  );
};

export default StockCheckEvidenceCapture;
