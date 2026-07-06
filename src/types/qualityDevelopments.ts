export type QualityDevelopmentStatus =
  | 'Draft'
  | 'In Review'
  | 'Testing'
  | 'Approved'
  | 'On Hold';

export type QualityDevelopmentRow = {
  id: string;
  reference: string;
  itemCode: string;
  title: string;
  category: string;
  status: QualityDevelopmentStatus;
  assignee: string;
  requestedOn: string;
  targetDate: string;
  notes: string;
};

export type QualityDevelopmentSectionKey = 'rm' | 'pm' | 'pis';

export type QualityDevelopmentSectionConfig = {
  key: QualityDevelopmentSectionKey;
  routeId: string;
  navLabel: string;
  pageTitle: string;
  pageSubtitle: string;
  scopeLabel: string;
  rows: readonly QualityDevelopmentRow[];
};
