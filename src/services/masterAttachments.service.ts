import { api, getApiBaseUrl, getAuthToken } from '../lib/apiClient';

export type QualitySpecAttachmentUpload = {
  storedName: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
};

type UploadResponse = {
  success: boolean;
  message?: string;
  data: QualitySpecAttachmentUpload;
};

const MASTER_ATTACHMENT_PATH_PREFIX = '/api/v1/master-attachments/quality-spec/';

export function isMasterQualitySpecAttachmentUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.includes(MASTER_ATTACHMENT_PATH_PREFIX)) return true;
  try {
    const base = getApiBaseUrl();
    if (base && trimmed.startsWith(base) && trimmed.includes(MASTER_ATTACHMENT_PATH_PREFIX)) return true;
  } catch {
    // ignore
  }
  return false;
}

export function parseMasterQualitySpecStoredName(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(MASTER_ATTACHMENT_PATH_PREFIX);
  if (idx < 0) return null;
  const encoded = trimmed.slice(idx + MASTER_ATTACHMENT_PATH_PREFIX.length).split('?')[0] ?? '';
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

function resolveAttachmentFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = getApiBaseUrl();
  if (base) return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export async function uploadQualitySpecAttachment(file: File): Promise<QualitySpecAttachmentUpload> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.post<UploadResponse>('/api/v1/master-attachments/quality-spec', fd);
  if (!res?.data?.url) {
    throw new Error(res?.message ?? 'Upload failed');
  }
  return res.data;
}

export async function deleteQualitySpecAttachment(url: string): Promise<void> {
  const storedName = parseMasterQualitySpecStoredName(url);
  if (!storedName) return;
  await api.delete(`/api/v1/master-attachments/quality-spec/${encodeURIComponent(storedName)}`);
}

/** Open uploaded file in a new tab (authenticated fetch → blob URL). External links open directly. */
export async function openQualitySpecAttachment(url: string): Promise<void> {
  const trimmed = url.trim();
  if (!trimmed) return;

  if (!isMasterQualitySpecAttachmentUrl(trimmed)) {
    window.open(trimmed, '_blank', 'noopener,noreferrer');
    return;
  }

  const fetchUrl = resolveAttachmentFetchUrl(trimmed);
  const token = getAuthToken();
  const response = await fetch(fetchUrl, {
    method: 'GET',
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new Error(`Could not open file (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
