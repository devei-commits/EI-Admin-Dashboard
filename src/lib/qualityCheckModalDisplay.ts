import type { GRNRecordFromApi } from '../services/grn.service';
import { resolveInboundWarehouseCode } from './inboundGrnTableDisplay';
import { displayInboundGrnNo } from './inboundGrnTableDisplay';
import {
  deriveGrnQcStatusFromSpecs,
  grnQcCompletionBlockers,
  isMandatoryTestPending,
  summarizeGrnQcTests,
  type GrnQcSpecsStored,
} from './grnQcSpecs';
import { deriveAutoPassedFromResult, grnQcVerdictLabel, isThirdPartyQcTest } from './grnQcAutoPass';
import {
  formatQualityApproverDisplay,
  formatQualityAssigneeShortName,
  formatQualityQuarantineDateTime,
  isQualityGrnMismatch,
  resolveQualitySection,
  type QualityOrderManagementInput,
} from './qualityOrderManagementTableDisplay';

export type QcWorkflowStage = 'QC INITIATED' | 'QC COMPLETED' | 'APPROVED' | 'CLOSED';

export type QualityCheckAttachmentRow = {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  source: 'grn-doc' | 'qc-upload';
};

export function buildQualityCheckHeaderTitle(grn: QualityOrderManagementInput): string {
  const line = grn.lineItems?.[0];
  const name = String(line?.item ?? '').trim() || String(line?.itemCode ?? '').trim() || 'Item';
  const code = String(line?.itemCode ?? '').trim();
  return `🧪 QC Check — ${name}${code ? ` ${code}` : ''}`;
}

export function buildQualityCheckHeaderSubtitle(grn: QualityOrderManagementInput): string {
  const line = grn.lineItems?.[0];
  const wh = resolveInboundWarehouseCode({ locationZone: grn.locationZone }, line ?? null);
  const section = resolveQualitySection(grn);
  const mismatch = isQualityGrnMismatch(grn) ? 'MISMATCH' : 'ROUTINE';
  const qty = line?.rcvdQty ?? line?.poQty;
  const unit = String(line?.unit ?? '').trim() || (section === 'PM' ? 'pcs' : 'kg');
  const qtyLabel = qty != null ? `${Number(qty).toLocaleString('en-IN')} ${unit} in Q` : '— in Q';
  return `${displayInboundGrnNo(grn.grnNo)} · ${wh} · ${qtyLabel} · OM · ${section} section · ${mismatch} source`;
}

export function buildQualityCheckCategorySection(grn: QualityOrderManagementInput): string {
  const section = resolveQualitySection(grn);
  return `OM${section}`;
}

export function resolveQcWorkflowStages(
  grn: QualityOrderManagementInput,
  qcSpecs: GrnQcSpecsStored | null,
): Record<QcWorkflowStage, { active: boolean; detail: string | null }> {
  const assigned = String(grn.assignedTo ?? '').trim();
  const initiatedAt = formatQualityQuarantineDateTime(grn.grnDate ?? grn.receivedDate);
  const assignLabel = assigned ? formatQualityAssigneeShortName(assigned) : '—';
  const summary = summarizeGrnQcTests(qcSpecs);
  const derived = deriveGrnQcStatusFromSpecs(qcSpecs);
  const status = String(grn.status ?? '').trim();
  const qcCompleted = summary.mandatory > 0 && summary.mandatoryPending === 0 && summary.failed === 0;
  const approved = derived === 'Passed' || grn.qcStatus === 'Passed' || grn.qcStatus === 'Pass';
  const closed = status === 'GRN Complete';

  return {
    'QC INITIATED': {
      active: Boolean(assigned || initiatedAt !== '—'),
      detail: initiatedAt !== '—' ? `${initiatedAt} by ${assignLabel}` : assignLabel !== '—' ? `by ${assignLabel}` : null,
    },
    'QC COMPLETED': {
      active: qcCompleted,
      detail: qcCompleted ? 'All mandatory parameters recorded' : '— pending',
    },
    APPROVED: {
      active: approved,
      detail: approved ? formatQualityApproverDisplay(String(grn.qcBy ?? '')) || 'Approved' : null,
    },
    CLOSED: {
      active: closed,
      detail: closed ? 'GRN completed' : null,
    },
  };
}

export function buildExpectedQcCompletion(grn: QualityOrderManagementInput): string {
  const raw = String(grn.grnDate ?? grn.receivedDate ?? '').trim();
  const d = raw ? new Date(raw) : new Date();
  d.setHours(18, 0, 0, 0);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
  const month = months[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}-${month}-${d.getFullYear()} ${hours}:${minutes}`;
}

export function buildChecklistProgressMessage(qcSpecs: GrnQcSpecsStored | null): string {
  const tests = (qcSpecs?.lines ?? []).flatMap((l) => l.tests ?? []);
  const mandatory = tests.filter((t) => t.mandatory);
  const complete = mandatory.filter((t) => !isMandatoryTestPending(t));
  const thirdPartyPending = tests.filter(
    (t) => isThirdPartyQcTest(t) && (!String(t.result ?? '').trim() || /^pending$/i.test(String(t.result))),
  );
  const parts = [`${complete.length} of ${mandatory.length} parameters complete`];
  if (thirdPartyPending.length > 0) {
    parts.push(`${thirdPartyPending.length} awaiting 3rd-party lab results`);
  }
  return `${parts.join(' · ')}. Complete QC button enables only when all mandatory parameters have results (pass or fail).`;
}

export function canCompleteQualityCheck(qcSpecs: GrnQcSpecsStored | null): boolean {
  return grnQcCompletionBlockers(qcSpecs).length === 0 && deriveGrnQcStatusFromSpecs(qcSpecs) === 'Passed';
}

export function buildChecklistVerdict(test: { result: string; passed: boolean | null }): {
  label: string;
  tone: 'pass' | 'fail' | 'pending';
} {
  const auto = deriveAutoPassedFromResult(test as Parameters<typeof deriveAutoPassedFromResult>[0]);
  const passed = test.passed ?? auto;
  if (passed === true) return { label: grnQcVerdictLabel(true), tone: 'pass' };
  if (passed === false) return { label: grnQcVerdictLabel(false), tone: 'fail' };
  return { label: grnQcVerdictLabel(null), tone: 'pending' };
}

export function buildQualityCheckAttachments(
  grn: GRNRecordFromApi | QualityOrderManagementInput,
  qcSpecs?: GrnQcSpecsStored | null,
): QualityCheckAttachmentRow[] {
  const rows: QualityCheckAttachmentRow[] = [];
  const docs = (grn as GRNRecordFromApi).sourceDocuments;
  if (docs && typeof docs === 'object') {
    const coa = docs.coa;
    if (coa?.fileName || coa?.ref) {
      rows.push({
        id: 'grn-doc-coa',
        name: String(coa.fileName ?? coa.ref ?? 'Vendor COA'),
        type: 'Vendor COA',
        uploadedAt: formatQualityQuarantineDateTime(coa.uploadedAt ?? grn.grnDate),
        source: 'grn-doc',
      });
    }
    const bill = docs.bill;
    if (bill?.fileName || bill?.ref) {
      rows.push({
        id: 'grn-doc-bill',
        name: String(bill.fileName ?? bill.ref ?? 'Bill'),
        type: 'Bill / GRN',
        uploadedAt: formatQualityQuarantineDateTime(bill.uploadedAt ?? grn.grnDate),
        source: 'grn-doc',
      });
    }
  }

  for (const att of qcSpecs?.attachments ?? []) {
    if (!att.fileName) continue;
    rows.push({
      id: att.id,
      name: att.fileName,
      type: att.type || 'Other',
      uploadedAt: formatQualityQuarantineDateTime(att.uploadedAt),
      source: 'qc-upload',
    });
  }

  return rows;
}

export function buildQualityCheckAttachmentSummary(rows: QualityCheckAttachmentRow[]): string {
  if (rows.length === 0) return 'No attachments uploaded yet';
  const byType = new Map<string, number>();
  for (const row of rows) {
    byType.set(row.type, (byType.get(row.type) ?? 0) + 1);
  }
  const parts = [...byType.entries()].map(([type, count]) => {
    if (count === 1) return `✓ ${type}`;
    return `✓ ${count} ${type}${count > 1 ? 's' : ''}`;
  });
  return `${parts.join(' · ')} uploaded`;
}

export function thirdPartyActionLabel(test: { method: string; result: string; acceptance?: string }): string | null {
  if (!isThirdPartyQcTest(test as Parameters<typeof isThirdPartyQcTest>[0])) return null;
  const poRef = String(test.acceptance ?? '').trim();
  if (poRef && /PO-/i.test(poRef)) return `3rd Party · ${poRef}`;
  const result = String(test.result ?? '').trim();
  if (!result || /^pending$/i.test(result)) return '🧫 Trigger 3rd-party';
  return null;
}
