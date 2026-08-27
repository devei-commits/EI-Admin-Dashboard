import { evaluateAgainstSpec } from './qcSpecConstraint';
import type { GrnQualitySpecOutputType, MasterQualitySpecDataType } from './qualitySpecDataType';
import { isNumberQualitySpecKind, parseGrnOutputType } from './qualitySpecDataType';
import type { GrnQcTestRow } from './grnQcSpecs';

function parseNumeric(value: string): number | null {
  const n = Number(String(value ?? '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function parseNumberRange(specLimit: string): { min: number; max: number } | null {
  const m = String(specLimit ?? '').match(/([\d.]+)\s*[–\-—to]+\s*([\d.]+)/i);
  if (!m) return null;
  const min = parseNumeric(m[1]);
  const max = parseNumeric(m[2]);
  if (min == null || max == null) return null;
  return { min, max };
}

function parseUpperLimit(specLimit: string): number | null {
  const m = String(specLimit ?? '').match(/(?:<|≤|<=)\s*([\d.]+)/);
  if (m) return parseNumeric(m[1]);
  const plain = parseNumeric(specLimit);
  return plain;
}

function parseLowerLimit(specLimit: string): number | null {
  const m = String(specLimit ?? '').match(/(?:>|≥|>=)\s*([\d.]+)/);
  if (m) return parseNumeric(m[1]);
  return null;
}

export function deriveAutoPassedFromResult(test: GrnQcTestRow): boolean | null {
  const result = String(test.result ?? '').trim();
  if (!result || /^pending$/i.test(result)) return null;

  const outputType = parseGrnOutputType(test.outputType) ?? 'text';

  // The spec STRING is authoritative when it states a numeric rule. Master-seeded tests mostly
  // carry no outputType, so "≥ 99.5%", "1100 - 1500" and "38 - 43" previously fell through to the
  // text branch where any non-empty entry passed — a viscosity of -1 reported PASS.
  // Skipped for output types that are explicitly non-numeric verdicts (pass-fail / boolean), where
  // the entry is a word rather than a measurement.
  if (outputType !== 'pass-fail' && outputType !== 'boolean') {
    const bySpec = evaluateAgainstSpec(test.specLimit, result, test.tolerance);
    if (bySpec !== undefined) return bySpec;
  }

  if (outputType === 'pass-fail') {
    if (/^pass$/i.test(result)) return true;
    if (/^fail$/i.test(result)) return false;
    return null;
  }

  if (outputType === 'boolean') {
    if (/^yes$/i.test(result)) return true;
    if (/^no$/i.test(result)) return false;
    return null;
  }

  if (outputType === 'text-match') {
    if (/match/i.test(result) || result.includes('✓')) return true;
    if (/fail|mismatch|reject/i.test(result)) return false;
    return result ? true : null;
  }

  if (isNumberQualitySpecKind(outputType as MasterQualitySpecDataType)) {
    const measured = parseNumeric(result);
    if (measured == null) return null;
    const spec = String(test.specLimit ?? '').trim();

    if (outputType === 'number-range') {
      const range = parseNumberRange(spec);
      if (range) return measured >= range.min && measured <= range.max;
    }
    if (outputType === 'number-le') {
      const limit = parseUpperLimit(spec);
      if (limit != null) return measured <= limit;
    }
    if (outputType === 'number-ge') {
      const limit = parseLowerLimit(spec) ?? parseNumeric(spec);
      if (limit != null) return measured >= limit;
    }
    if (outputType === 'number' || outputType === 'number-match') {
      const target = parseNumeric(spec);
      if (target != null) {
        const tol = parseNumeric(String(test.tolerance ?? '')) ?? 0;
        return Math.abs(measured - target) <= tol;
      }
    }
    return true;
  }

  if (outputType === 'select' || outputType === 'text' || outputType === 'textarea') {
    return result ? true : null;
  }

  return result ? true : null;
}

export function grnQcVerdictLabel(passed: boolean | null): string {
  if (passed === true) return '✓ PASS';
  if (passed === false) return '✗ FAIL';
  return 'awaiting';
}

export function resolveGrnQcResultOutputType(test: GrnQcTestRow): GrnQualitySpecOutputType {
  return parseGrnOutputType(test.outputType) ?? 'text';
}

export function isThirdPartyQcTest(test: GrnQcTestRow): boolean {
  const specId = String(test.specId ?? '').toLowerCase();
  if (specId.includes('3rd-party') || specId.includes('3rd_party')) return true;

  const signal = [test.method, test.acceptance, test.frequency]
    .map((part) => String(part ?? '').toLowerCase())
    .join(' ');

  return (
    signal.includes('external') ||
    signal.includes('3rd') ||
    signal.includes('third-party') ||
    signal.includes('third party') ||
    signal.includes('outsource')
  );
}
