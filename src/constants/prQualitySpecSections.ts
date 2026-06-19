/** PR master quality-spec sections (tabular, one table per section). */
export const PR_QUALITY_SPEC_SECTIONS = [
  { key: 'bulkClearance', title: 'Bulk Clearance', emoji: '🥽' },
  { key: 'finalClearance', title: 'Final Clearance', emoji: '✅' },
  { key: 'dispatchSpecs', title: 'Dispatch Specs', emoji: '🚚' },
] as const;

export type PrQualitySpecSectionKey = (typeof PR_QUALITY_SPEC_SECTIONS)[number]['key'];

export const PR_QUALITY_SPEC_SECTION_KEYS: readonly PrQualitySpecSectionKey[] = PR_QUALITY_SPEC_SECTIONS.map(
  (s) => s.key
);

export function prQualitySpecSectionLabel(key: PrQualitySpecSectionKey): string {
  const section = PR_QUALITY_SPEC_SECTIONS.find((s) => s.key === key);
  return section ? `${section.emoji} ${section.title}` : key;
}
