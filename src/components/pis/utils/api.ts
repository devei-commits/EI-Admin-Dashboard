// API Configuration
// Set USE_MOCK_DATA to true to use mock data only (no API calls)
export const USE_MOCK_DATA = true;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/v1';

export function getApiBaseUrl(): string {
  return API_URL;
}

export function getServerBaseUrl(): string {
  return API_URL.replace(/\/?api\/v1\/?$/, '');
}

// Types
export interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: number;
      email: string;
      firstName: string | null;
      lastName: string | null;
      role: string | null;
      status: string;
      department: string | null;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface ApiError {
  success: false;
  error: {
    message: string;
    details?: any;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    [key: string]: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

// Helper functions
export function getAccessToken(): string | null {
  return localStorage.getItem('accessToken');
}

export function getRefreshToken(): string | null {
  return localStorage.getItem('refreshToken');
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

// API Request helper with automatic token refresh
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAccessToken();

  const isFormDataBody =
    typeof FormData !== 'undefined' && options.body instanceof FormData;

  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  // Only force JSON content-type when we're not sending FormData.
  // Browsers must set multipart boundaries themselves.
  if (!isFormDataBody && !(headers as any)['Content-Type']) {
    (headers as any)['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    let response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include', // Include credentials (cookies) for CORS
    });

    // Handle token expiration - try to refresh
    if (response.status === 401 && token) {
      try {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const refreshResponse = await apiRequest<LoginResponse>('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshResponse.success && refreshResponse.data) {
            setTokens(refreshResponse.data.accessToken, refreshResponse.data.refreshToken);
            
            // Retry original request with new token
            headers['Authorization'] = `Bearer ${refreshResponse.data.accessToken}`;
            response = await fetch(`${API_URL}${endpoint}`, {
              ...options,
              headers,
            });
          }
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and throw
        clearTokens();
        throw new Error('Session expired. Please login again.');
      }
    }
    // Read raw text once, then try to parse JSON. This avoids
    // "Unexpected token" errors when the backend (or a proxy)
    // returns HTML/text instead of JSON.
    const rawText = await response.text();

    let parsed: any = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred';

      // Prefer structured API error when available
      if (parsed && typeof parsed === 'object') {
        const error: ApiError = parsed;
        errorMessage = error.error?.message || (error as any).message || errorMessage;
      } else if (rawText?.trim()) {
        // Fallback to raw text (e.g. "Too many requests" or HTML snippet)
        errorMessage = rawText.trim();
      }

      // Provide user-friendly messages for specific status codes
      if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please login again.';
      } else if (response.status === 403) {
        errorMessage = 'You do not have permission to perform this action.';
      } else if (response.status === 404) {
        errorMessage = 'The requested resource was not found.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      }

      throw new Error(errorMessage);
    }

    // Successful response
    if (parsed !== null) {
      return parsed as T;
    }

    // If server returned no/invalid JSON but status is OK, surface raw text
    // so callers still get something meaningful.
    return (rawText as unknown) as T;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error('Network error. Please check your connection and try again.');
    }
    throw error;
  }
}

// Auth API
export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiRequest<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.data) {
      setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  },

  async refreshToken(): Promise<LoginResponse> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await apiRequest<LoginResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.success && response.data) {
      setTokens(response.data.accessToken, response.data.refreshToken);
    }

    return response;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    
    try {
      if (refreshToken) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearTokens();
    }
  },

  async getMe(): Promise<LoginResponse> {
    return apiRequest<LoginResponse>('/auth/me');
  },
};

// PIS API
export const pisApi = {
  async getAll(filters?: {
    page?: number;
    limit?: number;
    stage?: string;
    status?: string;
    customerId?: string;
    productId?: string;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.stage) params.append('stage', filters.stage);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.customerId) params.append('customerId', filters.customerId);
    if (filters?.productId) params.append('productId', filters.productId);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiRequest(`/pis${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}`);
  },

  async create(data: any): Promise<ApiResponse<any>> {
    return apiRequest('/pis', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}`, {
      method: 'DELETE',
    });
  },

  async transitionStage(
    id: string,
    toStage: string,
    decision: 'APPROVED' | 'REJECTED',
    comments?: string
  ): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ toStage, decision, comments }),
    });
  },

  async terminate(id: string, reason: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async makeWayForwardDecision(
    id: string,
    decision: 'PROCEED' | 'HOLD' | 'DROP',
    comments?: string
  ): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${id}/way-forward`, {
      method: 'POST',
      body: JSON.stringify({ decision, comments }),
    });
  },

  // Client portal
  async confirmClientMilestone(
    pisId: string,
    milestone: 'BRIEF_ACCEPTED' | 'SAMPLE_RECEIVED' | 'ARTWORK_APPROVED',
    comments?: string
  ): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${pisId}/client/confirm`, {
      method: 'POST',
      body: JSON.stringify({ milestone, comments }),
    });
  },

  async uploadClientAttachment(
    pisId: string,
    file: File,
    description?: string
  ): Promise<ApiResponse<any>> {
    const form = new FormData();
    form.append('file', file);
    if (description) form.append('description', description);

    return apiRequest(`/pis/${pisId}/client/attachments`, {
      method: 'POST',
      body: form,
    });
  },

  async listAttachments(pisId: string): Promise<ApiResponse<any[]>> {
    return apiRequest(`/pis/${pisId}/attachments`);
  },

  async listPendingClientAttachments(): Promise<ApiResponse<any[]>> {
    return apiRequest('/pis/attachments/pending');
  },

  async moderateClientAttachment(
    attachmentId: string,
    action: 'APPROVE' | 'REJECT',
    comments?: string
  ): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/attachments/${attachmentId}/moderate`, {
      method: 'POST',
      body: JSON.stringify({ action, comments }),
    });
  },

  // Message/Chat methods
  async getMessages(pisId: string): Promise<ApiResponse<any[]>> {
    return apiRequest(`/pis/${pisId}/messages`);
  },

  async createMessage(pisId: string, message: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${pisId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  async updateMessage(pisId: string, messageId: string, message: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${pisId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ message }),
    });
  },

  async deleteMessage(pisId: string, messageId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/pis/${pisId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  },
};

// Customers API
export const customersApi = {
  async getAll(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiRequest(`/customers${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/customers/${id}`);
  },

  async create(data: any): Promise<ApiResponse<any>> {
    return apiRequest('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiRequest(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/customers/${id}`, {
      method: 'DELETE',
    });
  },
};

// Products API
export const productsApi = {
  async getAll(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    category?: string;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiRequest(`/products${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/products/${id}`);
  },

  async create(data: any): Promise<ApiResponse<any>> {
    return apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiRequest(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/products/${id}`, {
      method: 'DELETE',
    });
  },
};

// Tasks API
export const tasksApi = {
  async getAll(filters?: {
    page?: number;
    limit?: number;
    status?: string;
    priority?: string;
    pisId?: string;
    assignedToId?: number;
    myTasks?: boolean;
  }): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.pisId) params.append('pisId', filters.pisId);
    if (filters?.assignedToId) params.append('assignedToId', filters.assignedToId.toString());
    if (filters?.myTasks) params.append('myTasks', 'true');

    const query = params.toString();
    return apiRequest(`/tasks${query ? `?${query}` : ''}`);
  },

  async getById(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/tasks/${id}`);
  },

  async create(data: any): Promise<ApiResponse<any>> {
    return apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any): Promise<ApiResponse<any>> {
    return apiRequest(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<ApiResponse<any>> {
    return apiRequest(`/tasks/${id}`, {
      method: 'DELETE',
    });
  },
};

// Users API
export const usersApi = {
  async getAll(filters?: {
    page?: number;
    limit?: number;
    role?: string;
    status?: string;
    department?: string;
    search?: string;
  }): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.department) params.append('department', filters.department);
    if (filters?.search) params.append('search', filters.search);

    const query = params.toString();
    return apiRequest(`/users${query ? `?${query}` : ''}`);
  },

  async getById(id: number): Promise<ApiResponse<any>> {
    return apiRequest(`/users/${id}`);
  },

  async create(data: any): Promise<ApiResponse<any>> {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: number, data: any): Promise<ApiResponse<any>> {
    return apiRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: number): Promise<ApiResponse<any>> {
    return apiRequest(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};

// Dashboard API
export const dashboardApi = {
  async getStats(): Promise<ApiResponse<any>> {
    return apiRequest('/dashboard/stats');
  },
};

// Roles API
export const rolesApi = {
  async getAll(): Promise<ApiResponse<any[]>> {
    return apiRequest('/roles');
  },

  async getById(id: number): Promise<ApiResponse<any>> {
    return apiRequest(`/roles/${id}`);
  },
};

// Helper to convert API PIS to frontend format
export function convertApiPISToFrontend(apiPis: any): any {
  return {
    id: apiPis.id,
    pisCode: apiPis.pisCode,
    formulation: apiPis.formulation,

    // Source / origin
    originType: apiPis.originType,
    enquiryReference: apiPis.enquiryReference,
    customizationRef: apiPis.customizationRef,

    // Customer & product
    customer: apiPis.customerName || apiPis.customer?.name || '',
    customerId: apiPis.customerId || apiPis.customer?.id,
    costName: apiPis.costName || apiPis.product?.name || '',
    productId: apiPis.productId || apiPis.product?.id,
    productCode: apiPis.product?.code,

    // Core workflow fields
    rdStaff: apiPis.rdStaff || '',
    stage: apiPis.stage,
    status: apiPis.status,

    // Stage indicators
    m1: apiPis.m1 || false,
    v1: apiPis.v1 || false,
    rdO1: apiPis.rdO1 || false,
    regulatory: apiPis.regulatory || false,
    inventory: apiPis.inventory || false,
    formLabel: apiPis.formLabel || '',
    sop: apiPis.sop || false,
    ac: apiPis.ac || false,
    oc: apiPis.oc || false,
    mop: apiPis.mop || false,
    coa: apiPis.coa || false,
    pre: apiPis.pre || false,
    stabilityMatch: apiPis.stabilityMatch || false,
    prs: apiPis.prs || false,
    sensory: apiPis.sensory || false,

    // Stage 1: BD Intake
    productDosageSkinType: apiPis.productDosageSkinType,
    packConfiguration: apiPis.packConfiguration,
    claimsMustHave: apiPis.claimsMustHave,
    activesRequested: apiPis.activesRequested,
    targetCost: apiPis.targetCost,
    moq: apiPis.moq,
    requestedTimeline: apiPis.requestedTimeline
      ? new Date(apiPis.requestedTimeline)
      : undefined,
    bdNotesRisks: apiPis.bdNotesRisks,
    crrChecklist:
      typeof apiPis.crrChecklist === 'string'
        ? JSON.parse(apiPis.crrChecklist)
        : apiPis.crrChecklist,
    bdIntakeCompletedAt: apiPis.bdIntakeCompletedAt
      ? new Date(apiPis.bdIntakeCompletedAt)
      : undefined,

    // Stage 2: Alignment
    dosageAgreed: apiPis.dosageAgreed,
    activeDirectionAgreed: apiPis.activeDirectionAgreed,
    keyClaimsAgreed: apiPis.keyClaimsAgreed,
    specsRangeAgreed: apiPis.specsRangeAgreed,
    packagingDirectionAgreed: apiPis.packagingDirectionAgreed,
    timelineAgreed: apiPis.timelineAgreed,
    alignmentNotes: apiPis.alignmentNotes,
    alignmentCompletedAt: apiPis.alignmentCompletedAt
      ? new Date(apiPis.alignmentCompletedAt)
      : undefined,
    alignmentChecklist:
      typeof apiPis.alignmentChecklist === 'string'
        ? JSON.parse(apiPis.alignmentChecklist)
        : apiPis.alignmentChecklist,

    // Stage 3: Agreement & Handover
    projectCode: apiPis.projectCode,
    agreementSigned: apiPis.agreementSigned,
    agreementSignedAt: apiPis.agreementSignedAt
      ? new Date(apiPis.agreementSignedAt)
      : undefined,
    agreementSignedBy: apiPis.agreementSignedBy,
    agreementDocumentUrl: apiPis.agreementDocumentUrl,
    finalPisLocked: apiPis.finalPisLocked,
    packagingTrackTriggered: apiPis.packagingTrackTriggered,
    kickoffNotes: apiPis.kickoffNotes,
    handoverCompletedAt: apiPis.handoverCompletedAt
      ? new Date(apiPis.handoverCompletedAt)
      : undefined,
    agreementChecklist:
      typeof apiPis.agreementChecklist === 'string'
        ? JSON.parse(apiPis.agreementChecklist)
        : apiPis.agreementChecklist,

    // R&D Lead Review
    activeCompositionConfirmed: apiPis.activeCompositionConfirmed,
    dosageFormConfirmed: apiPis.dosageFormConfirmed,
    claimsFeasibilityConfirmed: apiPis.claimsFeasibilityConfirmed,
    specificationsConfirmed: apiPis.specificationsConfirmed,
    rndLeadReviewNotes: apiPis.rndLeadReviewNotes,
    rndLeadReviewCompletedAt: apiPis.rndLeadReviewCompletedAt
      ? new Date(apiPis.rndLeadReviewCompletedAt)
      : undefined,
    rndLeadReviewChecklist:
      typeof apiPis.rndLeadReviewChecklist === 'string'
        ? JSON.parse(apiPis.rndLeadReviewChecklist)
        : apiPis.rndLeadReviewChecklist,

    // Stage 5: Development Execution
    keyRawMaterialsSourced: apiPis.keyRawMaterialsSourced,
    formulaFrozenForSample: apiPis.formulaFrozenForSample,
    inProcessChecksDone: apiPis.inProcessChecksDone,
    stabilitySamplesInitiated: apiPis.stabilitySamplesInitiated,
    sampleReadyForQC: apiPis.sampleReadyForQC,
    developmentNotes: apiPis.developmentNotes,
    developmentCompletedAt: apiPis.developmentCompletedAt
      ? new Date(apiPis.developmentCompletedAt)
      : undefined,
    bdTeam: apiPis.bdTeam,
    assignedBdRole: apiPis.assignedBdRole,
    assignedBdStaffId: apiPis.assignedBdStaffId,
    rndLeadAssignment: apiPis.rndLeadAssignment,
    rndStaffAssignment: apiPis.rndStaffAssignment,
    qaAssignment: apiPis.qaAssignment,
    pkgDesignAssignment: apiPis.pkgDesignAssignment,
    pkgProductSubmission: apiPis.pkgProductSubmission,
    pkgLabelSubmission: apiPis.pkgLabelSubmission,
    sampleDispatchPreparation: apiPis.sampleDispatchPreparation,
    wfp: typeof apiPis.wfp === 'string' ? JSON.parse(apiPis.wfp) : apiPis.wfp,
    sampleSubmission: typeof apiPis.sampleSubmission === 'string' 
      ? JSON.parse(apiPis.sampleSubmission) 
      : apiPis.sampleSubmission,
    bdIntakeChecklist: typeof apiPis.bdIntakeChecklist === 'string'
      ? JSON.parse(apiPis.bdIntakeChecklist)
      : apiPis.bdIntakeChecklist,
    rndDevelopmentChecklist: typeof apiPis.rndDevelopmentChecklist === 'string'
      ? JSON.parse(apiPis.rndDevelopmentChecklist)
      : apiPis.rndDevelopmentChecklist,
    qaChecklist:
      typeof apiPis.qaChecklist === 'string'
        ? JSON.parse(apiPis.qaChecklist)
        : apiPis.qaChecklist,

    // Packaging track
    packagingLeadReview: apiPis.packagingLeadReview,
    packagingPossibilities: apiPis.packagingPossibilities,
    packagingLimitations: apiPis.packagingLimitations,
    packagingAligned: apiPis.packagingAligned,
    packagingCatalogueLink: apiPis.packagingCatalogueLink,
    packagingCompletedAt: apiPis.packagingCompletedAt
      ? new Date(apiPis.packagingCompletedAt)
      : undefined,
    packagingChecklist:
      typeof apiPis.packagingChecklist === 'string'
        ? JSON.parse(apiPis.packagingChecklist)
        : apiPis.packagingChecklist,

    // Way Forward
    wayForwardDecision: apiPis.wayForwardDecision,
    wayForwardDecidedAt: apiPis.wayForwardDecidedAt
      ? new Date(apiPis.wayForwardDecidedAt)
      : undefined,
    wayForwardDecidedBy: apiPis.wayForwardDecidedBy,
    holdReason: apiPis.holdReason,
    dropReason: apiPis.dropReason,
    commercializationStarted: apiPis.commercializationStarted,

    // Analytics
    loopCount: apiPis.loopCount || 0,
    rejectionCount: apiPis.rejectionCount || 0,

    // History / audit trail
    history: apiPis.history?.map((h: any) => ({
      id: h.id,
      timestamp: new Date(h.timestamp),
      actorName: h.actorName,
      actorRole: h.actorRole,
      fromStage: h.fromStage,
      toStage: h.toStage,
      action: h.action,
      decision: h.decision,
      comments: h.comments,
    })) || [],
    // Timeline
    createdAt: new Date(apiPis.createdAt),
    updatedAt: new Date(apiPis.updatedAt),
    tentativeTimeline: apiPis.tentativeTimeline
      ? new Date(apiPis.tentativeTimeline)
      : undefined,
    qcSubmittedAt: apiPis.qcSubmittedAt
      ? new Date(apiPis.qcSubmittedAt)
      : undefined,
    sampleDispatchedAt: apiPis.sampleDispatchedAt
      ? new Date(apiPis.sampleDispatchedAt)
      : undefined,
    clientFeedbackReceivedAt: apiPis.clientFeedbackReceivedAt
      ? new Date(apiPis.clientFeedbackReceivedAt)
      : undefined,
    completedAt: apiPis.completedAt ? new Date(apiPis.completedAt) : undefined,
    terminatedAt: apiPis.terminatedAt ? new Date(apiPis.terminatedAt) : undefined,
    terminationReason: apiPis.terminationReason,

    // Client feedback / order
    clientFeedback: apiPis.clientFeedback,
    clientApproved: apiPis.clientApproved,
    convertedToOrder: apiPis.convertedToOrder || false,
    orderReference: apiPis.orderReference,

    // Creator / access
    createdById: apiPis.createdById?.toString() || apiPis.createdBy?.id?.toString(),
    createdBy: apiPis.createdBy ? {
      id: apiPis.createdBy.id,
      firstName: apiPis.createdBy.firstName,
      lastName: apiPis.createdBy.lastName,
      email: apiPis.createdBy.email,
      role: apiPis.createdBy.role,
    } : undefined,
    clientAccess: apiPis.clientAccess || [],
  };
}

// Helper to convert frontend PIS to API format
export function convertFrontendPISToApi(pis: any): any {
  return {
    pisCode: pis.pisCode,
    formulation: pis.formulation,
    customerId: pis.customerId,
    customerName: pis.customer && !pis.customerId ? pis.customer : undefined,
    productId: pis.productId,
    costName: pis.costName && !pis.productId ? pis.costName : undefined,
    rdStaff: pis.rdStaff,
    tentativeTimeline: pis.tentativeTimeline
      ? (pis.tentativeTimeline instanceof Date
          ? pis.tentativeTimeline.toISOString()
          : pis.tentativeTimeline)
      : undefined,

    // Source / origin
    originType: pis.originType,
    enquiryReference: pis.enquiryReference,
    customizationRef: pis.customizationRef,

    // Stage 1: BD Intake
    productDosageSkinType: pis.productDosageSkinType,
    packConfiguration: pis.packConfiguration,
    claimsMustHave: pis.claimsMustHave,
    activesRequested: pis.activesRequested,
    targetCost: pis.targetCost,
    moq: pis.moq,
    requestedTimeline: pis.requestedTimeline
      ? (pis.requestedTimeline instanceof Date
          ? pis.requestedTimeline.toISOString()
          : pis.requestedTimeline)
      : undefined,
    bdNotesRisks: pis.bdNotesRisks,
    // JSON blobs
    wfp: pis.wfp,
    sampleSubmission: pis.sampleSubmission,
    crrChecklist: pis.crrChecklist,
    alignmentChecklist: pis.alignmentChecklist,
    agreementChecklist: pis.agreementChecklist,
    rndLeadReviewChecklist: pis.rndLeadReviewChecklist,
    rndDevelopmentChecklist: pis.rndDevelopmentChecklist,
    qaChecklist: pis.qaChecklist,
    packagingChecklist: pis.packagingChecklist,
    bdIntakeChecklist: pis.bdIntakeChecklist,
    m1: pis.m1,
    v1: pis.v1,
    rdO1: pis.rdO1,
    regulatory: pis.regulatory,
    inventory: pis.inventory,
    formLabel: pis.formLabel,
    sop: pis.sop,
    ac: pis.ac,
    oc: pis.oc,
    mop: pis.mop,
    coa: pis.coa,
    pre: pis.pre,
    stabilityMatch: pis.stabilityMatch,
    prs: pis.prs,
    sensory: pis.sensory,
    bdTeam: pis.bdTeam,
    assignedBdRole: pis.assignedBdRole,
    assignedBdStaffId: pis.assignedBdStaffId,
    rndLeadAssignment: pis.rndLeadAssignment,
    rndStaffAssignment: pis.rndStaffAssignment,
    qaAssignment: pis.qaAssignment,
    pkgLeadAssignment: pis.pkgLeadAssignment,
    pkgDesignAssignment: pis.pkgDesignAssignment,
    pkgProductSubmission: pis.pkgProductSubmission,
    pkgLabelSubmission: pis.pkgLabelSubmission,
    sampleDispatchPreparation: pis.sampleDispatchPreparation,
    clientFeedback: pis.clientFeedback,
    clientApproved: pis.clientApproved,
  };
}
