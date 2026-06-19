import { api } from '../lib/apiClient';

export interface CustomizationRow {
  custom_id: number;
  name: string | null;
  concentration: string | null;
  description: string | null;
  active_composition: string | null;
  indications: string | null;
  how_to_use: string | null;
  specifications: string | null;
  cautions: string | null;
  frequently_asked_questions: string | null;
  category: string | null;
  incredients: string | null;
  care: string | null;
}

export interface CreateCustomizationPayload {
  name: string;
  concentration?: string;
  description?: string;
  active_composition?: string | Record<string, string>;
  indications?: string;
  how_to_use?: string;
  specifications?: string | Record<string, string>;
  cautions?: string;
  frequently_asked_questions?: string;
  category?: string;
  incredients?: string;
  care?: string;
}

export async function fetchCustomizations(): Promise<CustomizationRow[]> {
  return api.get<CustomizationRow[]>('/api/v1/customizations');
}

export async function createCustomization(payload: CreateCustomizationPayload): Promise<CustomizationRow> {
  return api.post<CustomizationRow>('/api/v1/customizations', payload);
}
