import { describe, expect, it } from 'vitest';
import { filterVendorClientsForTypeahead } from '../VendorClientNameTypeahead';
import type { VendorClientRecord } from '../../services/vendorClient.service';

function vendor(partial: Partial<VendorClientRecord> & { name: string }): VendorClientRecord {
  return {
    id: partial.id ?? '1',
    type: 'vendor',
    name: partial.name,
    email: '',
    phone: '',
    location: partial.location ?? '',
    country: '',
    category: '',
    status: 'active',
    paymentTerms: '',
    notes: '',
    rating: 0,
    moq: '',
    leadTime: '',
    createdAt: '',
    lastModified: '',
    data: partial.data ?? {},
    entityCode: partial.entityCode,
    ...partial,
  };
}

describe('filterVendorClientsForTypeahead', () => {
  const parties = [
    vendor({ id: '10', name: 'ACME Chemicals', entityCode: 'EI-VEN-00010', location: 'Mumbai' }),
    vendor({
      id: '11',
      name: 'Beta Supplies',
      data: { tradeName: 'ACME Fragrance House' },
    }),
    vendor({ id: '12', name: 'Gamma Oils', location: 'Delhi' }),
  ];

  it('matches by vendor name substring', () => {
    const hits = filterVendorClientsForTypeahead(parties, 'acme');
    expect(hits.map((h) => h.id)).toEqual(['10', '11']);
  });

  it('matches by entity code and trade name', () => {
    expect(filterVendorClientsForTypeahead(parties, 'EI-VEN-00010').map((h) => h.id)).toEqual(['10']);
    expect(filterVendorClientsForTypeahead(parties, 'fragrance').map((h) => h.id)).toEqual(['11']);
  });

  it('requires all tokens to match', () => {
    expect(filterVendorClientsForTypeahead(parties, 'acme mumbai').map((h) => h.id)).toEqual(['10']);
    expect(filterVendorClientsForTypeahead(parties, 'acme delhi')).toHaveLength(0);
  });
});
