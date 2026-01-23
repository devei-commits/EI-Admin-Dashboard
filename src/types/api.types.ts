/**
 * API-related type definitions
 * Types for API requests, responses, and error handling
 * Prepared for future backend integration
 */

// ==================== HTTP Types ====================
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
}

// ==================== Response Types ====================
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  success: boolean;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
  timestamp: string;
  path?: string;
}

// ==================== Query Types ====================
export interface QueryParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  search?: string;
  filters?: Record<string, string | number | boolean | string[]>;
}

export interface MutationOptions {
  onSuccess?: () => void;
  onError?: (error: ApiError) => void;
  invalidateQueries?: string[];
}

// ==================== Endpoint Configuration ====================
export interface EndpointConfig {
  baseUrl: string;
  version: string;
  timeout: number;
}

// ==================== Service Response Types ====================
export interface ServiceResult<T> {
  success: boolean;
  data?: T | null;
  error?: ApiError | null;
}

export interface BatchOperationResult {
  successful: string[];
  failed: Array<{
    id: string;
    error: string;
  }>;
  totalProcessed: number;
}

// ==================== File Upload Types ====================
export interface FileUploadResponse {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// ==================== Export Types ====================
export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'json';

export interface ExportOptions {
  format: ExportFormat;
  columns?: string[];
  filters?: Record<string, unknown>;
  filename?: string;
}

export interface ExportResult {
  downloadUrl: string;
  fileName: string;
  expiresAt: string;
}
