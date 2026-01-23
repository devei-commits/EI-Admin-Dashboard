/**
 * Services Index
 * Central export point for all service modules
 * 
 * IMPORTANT: These are placeholder service functions for future backend integration.
 * UI components should import from this file, not directly from backend implementations.
 */

export * from './order.service';
export * from './user.service';
export * from './master.service';
export * from './auth.service';
export * from './ticket.service';
export * as taskService from './task.service';

// Re-export common types from api.types
export type { ServiceResult, PaginatedResponse, QueryParams } from '../types/api.types';
