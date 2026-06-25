import { describe, expect, it } from 'vitest';
import { emptyStageAssignees } from '../../constants/masterApprovalStatus';
import {
  canEditPrFormSubsection,
  canEditPrFormStage,
  prQualitySpecSectionEditable,
  resolvePrFormTeamRole,
} from '../prFormTeamAccess';
import { canEditPrTeamAssignSlot } from '../prMasterTeamApproval';

describe('prFormTeamAccess', () => {
  const rmAssignees = {
    ...emptyStageAssignees(),
    rm_team: { user_id: 10, display_name: 'RM User', role_name: null },
  };
  const packAssignees = {
    ...emptyStageAssignees(),
    pack_team: { user_id: 20, display_name: 'Pack User', role_name: null },
  };

  it('resolvePrFormTeamRole detects rm and pack', () => {
    expect(resolvePrFormTeamRole(true, 1, emptyStageAssignees())).toBe('admin');
    expect(resolvePrFormTeamRole(false, 10, rmAssignees)).toBe('rm_team');
    expect(resolvePrFormTeamRole(false, 20, packAssignees)).toBe('pack_team');
    expect(resolvePrFormTeamRole(false, 99, emptyStageAssignees())).toBe('unassigned');
  });

  it('primary and formula BOM editable by either team', () => {
    expect(canEditPrFormSubsection('rm_team', 'primary')).toBe(true);
    expect(canEditPrFormSubsection('pack_team', 'formulaBom')).toBe(true);
    expect(canEditPrFormSubsection('unassigned', 'primary')).toBe(false);
  });

  it('sku BOM is automatic (read-only)', () => {
    expect(canEditPrFormSubsection('rm_team', 'skuBom')).toBe(false);
    expect(canEditPrFormSubsection('admin', 'skuBom')).toBe(false);
  });

  it('pack BOM and packaging process steps are pack-team only', () => {
    expect(canEditPrFormSubsection('pack_team', 'packBom')).toBe(true);
    expect(canEditPrFormSubsection('rm_team', 'packBom')).toBe(false);
    expect(canEditPrFormSubsection('pack_team', 'processPackaging')).toBe(true);
    expect(canEditPrFormSubsection('rm_team', 'processProduction')).toBe(true);
  });

  it('quality sections split by team', () => {
    expect(prQualitySpecSectionEditable('rm_team', 'bulkClearance')).toBe(true);
    expect(prQualitySpecSectionEditable('rm_team', 'finalClearance')).toBe(false);
    expect(prQualitySpecSectionEditable('pack_team', 'dispatchSpecs')).toBe(true);
  });

  it('licensing blocked for non-admin', () => {
    expect(canEditPrFormSubsection('rm_team', 'licensing')).toBe(false);
    expect(canEditPrFormSubsection('admin', 'licensing')).toBe(true);
    expect(canEditPrFormStage('pack_team', 7)).toBe(false);
  });
});

describe('canEditPrTeamAssignSlot', () => {
  const base = emptyStageAssignees();
  const withRm = { ...base, rm_team: { user_id: 5, display_name: 'A', role_name: null } };
  const withPack = { ...base, pack_team: { user_id: 6, display_name: 'B', role_name: null } };

  it('admin and unassigned assign editors may edit any team column', () => {
    expect(canEditPrTeamAssignSlot('rm_team', true, 5, withPack, true)).toBe(true);
    expect(canEditPrTeamAssignSlot('pack_team', false, 99, withRm, true)).toBe(true);
  });

  it('rm assignee cannot edit pack column', () => {
    expect(canEditPrTeamAssignSlot('rm_team', false, 5, withRm, true)).toBe(true);
    expect(canEditPrTeamAssignSlot('pack_team', false, 5, withRm, true)).toBe(false);
  });

  it('pack assignee cannot edit rm column', () => {
    expect(canEditPrTeamAssignSlot('pack_team', false, 6, withPack, true)).toBe(true);
    expect(canEditPrTeamAssignSlot('rm_team', false, 6, withPack, true)).toBe(false);
  });
});
