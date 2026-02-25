import { useEffect, useMemo, useRef, useState } from 'react';
import { PISRecord, PISStage } from '../types/pis';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from './ui/select';
import { usePIS } from '../context/PISContext';

export type TemplateStageKey =
 | 'S0'
 | 'S1'
 | 'S2'
 | 'S3'
 | 'S4'
 | 'S5'
 | 'S6'
 | 'S7'
 | 'P1'
 | 'P2'
 | 'P3';

type StageTemplatesState = {
 meta: {
  project_code: string;
  client_name: string;
  brand: string;
  bd_owner: string;
  rd_lead: string;
  date_initiated: string;
 };
 current?: TemplateStageKey;
 S0?: Record<string, any>;
 S1?: Record<string, any>;
 S2?: Record<string, any>;
 S3?: Record<string, any>;
 S4?: Record<string, any>;
 S5?: Record<string, any>;
 S6?: Record<string, any>;
 S7?: Record<string, any>;
 P1?: Record<string, any>;
 P2?: Record<string, any>;
 P3?: Record<string, any>;
};

const STAGES: Array<{ key: TemplateStageKey; title: string; hint: string; track?: 'main' | 'packaging' }> = [
 { key: 'S0', title: '0 Client Request Capture', hint: 'Mandatory intake + client selections', track: 'main' },
 { key: 'S1', title: '1) BD + Client + R&D Alignment', hint: 'Alignment checklist + decisions', track: 'main' },
 { key: 'S2', title: '2) Agreement & Handover', hint: 'Agreement status + PIS handover', track: 'main' },
 { key: 'S3', title: '3) R&D Lead Review & Assignment', hint: 'Confirm/Update composition, claims, specs + assign', track: 'main' },
 { key: 'S4', title: '4) Development Execution', hint: 'Timelines + sourcing/formulation/stability tracking', track: 'main' },
 { key: 'S5', title: '5) Sample Ready → Push to Quality', hint: 'Formulation details + client share payload + sample distribution', track: 'main' },
 { key: 'S6', title: '6) Quality Validation', hint: 'QC checklist vs client sheet + physical sample', track: 'main' },
 { key: 'S7', title: '7) Dispatch Handover', hint: 'Dispatch checklist + tracking IDs', track: 'main' },
 { key: 'P1', title: 'P1) Packaging Lead Review', hint: 'Possibilities/limitations + feedback to BD', track: 'packaging' },
 { key: 'P2', title: 'P2) Packaging Alignment', hint: '3-way alignment + final selection', track: 'packaging' },
 { key: 'P3', title: 'P3) Packaging Catalogue', hint: 'Catalogue options + approvals + final lock', track: 'packaging' },
];

export function defaultStageTemplates(): StageTemplatesState {
 return {
  meta: {
   project_code: '',
   client_name: '',
   brand: '',
   bd_owner: '',
   rd_lead: '',
   date_initiated: '',
  },
  S0: {},
  S1: {},
  S2: {},
  S3: {},
  S4: {},
  S5: {},
  S6: {},
  S7: {},
  P1: {},
  P2: {},
  P3: {},
  current: 'S0',
 };
}

function getIn(obj: any, path: string, fallback: any) {
 const parts = path.split('.');
 let cur = obj;
 for (const p of parts) {
  if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
  else return fallback;
 }
 return cur;
}

function setIn(obj: any, path: string, value: any) {
 const parts = path.split('.');
 const out = { ...(obj ?? {}) };
 let cur: any = out;
 for (let i = 0; i < parts.length - 1; i++) {
  const p = parts[i];
  const next = cur[p];
  cur[p] = typeof next === 'object' && next !== null ? { ...next } : {};
  cur = cur[p];
 }
 cur[parts[parts.length - 1]] = value;
 return out;
}

function stageKeyFromWorkflowStage(stage: PISStage): TemplateStageKey {
 switch (stage) {
  case 'BD_INTAKE':
   return 'S0';
  case 'AGREEMENT':
   return 'S2';
  case 'RND_LEAD_REVIEW':
   return 'S3';
  case 'RND_DEVELOPMENT':
   return 'S4';
  case 'QUALITY_REVIEW':
   return 'S6';
  case 'SAMPLE_DISPATCH':
   return 'S7';
  case 'PACKAGING':
   return 'P1';
  default:
   return 'S0';
 }
}

export function StageTemplatesForm({
 pis,
 disabled,
}: {
 pis: PISRecord;
 disabled?: boolean;
}) {
 const { updatePIS } = usePIS();

 const initialStageKey = useMemo(() => {
  const existing = (pis as any).stageTemplates?.current as TemplateStageKey | undefined;
  return existing ?? stageKeyFromWorkflowStage(pis.stage);
 }, [pis.id, pis.stage]);

 const [selectedStage, setSelectedStage] = useState<TemplateStageKey>(initialStageKey);
 const [templates, setTemplates] = useState<StageTemplatesState>(
  (pis as any).stageTemplates ?? defaultStageTemplates()
 );

 const saveTimer = useRef<number | null>(null);

 useEffect(() => {
  const fromRecord = ((pis as any).stageTemplates as StageTemplatesState | undefined) ?? defaultStageTemplates();
  setTemplates(fromRecord);
  setSelectedStage((fromRecord.current as TemplateStageKey | undefined) ?? stageKeyFromWorkflowStage(pis.stage));
 }, [pis.id]);

 const persist = (next: StageTemplatesState) => {
  if (saveTimer.current) {
   window.clearTimeout(saveTimer.current);
  }
  saveTimer.current = window.setTimeout(() => {
   const payload = { ...next, current: selectedStage };
   void Promise.resolve(updatePIS(pis.id, { stageTemplates: payload } as any)).catch(() => {
    // keep UI responsive even if save fails
   });
  }, 400);
 };

 const updateMeta = (key: keyof StageTemplatesState['meta'], value: string) => {
  const next = {
   ...templates,
   meta: {
    ...templates.meta,
    [key]: value,
   },
   current: selectedStage,
  };
  setTemplates(next);
  persist(next);
 };

 const updateField = (stageKey: TemplateStageKey, path: string, value: any) => {
  const currentStageObj = (templates as any)[stageKey] ?? {};
  const updatedStageObj = setIn(currentStageObj, path, value);
  const next = { ...templates, [stageKey]: updatedStageObj, current: selectedStage } as StageTemplatesState;
  setTemplates(next);
  persist(next);
 };

 const exportJson = () => {
  const payload = JSON.stringify({ ...templates, current: selectedStage }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${templates.meta.project_code || pis.pisCode || 'ei_pis'}_templates_state.json`;
  a.click();
  URL.revokeObjectURL(a.href);
 };

 const importJson = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.onchange = async () => {
   const file = input.files?.[0];
   if (!file) return;
   const txt = await file.text();
   try {
    const parsed = JSON.parse(txt);
    const next = {
     ...defaultStageTemplates(),
     ...parsed,
    } as StageTemplatesState;
    setTemplates(next);
    const stage = (next.current as TemplateStageKey | undefined) ?? 'S0';
    setSelectedStage(stage);
    void Promise.resolve(updatePIS(pis.id, { stageTemplates: next } as any)).catch(() => { });
   } catch {
    // ignore
   }
  };
  input.click();
 };

 const resetAll = () => {
  if (!confirm('Reset all template fields for this PIS?')) return;
  const next = defaultStageTemplates();
  setTemplates(next);
  setSelectedStage('S0');
  void Promise.resolve(updatePIS(pis.id, { stageTemplates: next } as any)).catch(() => { });
 };

 const metaDisabled = Boolean(disabled);
 const fieldsDisabled = Boolean(disabled);

 const stageInfo = STAGES.find((s) => s.key === selectedStage);

 const renderMeta = () => (
  <Card className="p-4">
   <div className="flex items-center justify-between gap-3 flex-wrap">
    <div>
     <div className="text-sm font-medium">Project Meta (Common)</div>
     <div className="text-xs text-muted-foreground">Stored inside this PIS as stageTemplates.meta</div>
    </div>
    <div className="flex gap-2">
     <Button type="button" variant="outline" size="sm" onClick={exportJson} disabled={fieldsDisabled}>
      Export JSON
     </Button>
     <Button type="button" variant="outline" size="sm" onClick={importJson} disabled={fieldsDisabled}>
      Import JSON
     </Button>
     <Button type="button" variant="destructive" size="sm" onClick={resetAll} disabled={fieldsDisabled}>
      Reset All
     </Button>
    </div>
   </div>

   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Project Code</div>
     <Input
      value={templates.meta.project_code || ''}
      onChange={(e) => updateMeta('project_code', e.target.value)}
      placeholder="EI-PIS-XXXX"
      disabled={metaDisabled}
     />
    </div>
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Date Initiated</div>
     <Input
      type="date"
      value={templates.meta.date_initiated || ''}
      onChange={(e) => updateMeta('date_initiated', e.target.value)}
      disabled={metaDisabled}
     />
    </div>
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Client Name</div>
     <Input
      value={templates.meta.client_name || ''}
      onChange={(e) => updateMeta('client_name', e.target.value)}
      placeholder="Client / Company"
      disabled={metaDisabled}
     />
    </div>
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Brand / Product Line</div>
     <Input
      value={templates.meta.brand || ''}
      onChange={(e) => updateMeta('brand', e.target.value)}
      placeholder="Brand name"
      disabled={metaDisabled}
     />
    </div>
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">BD Owner</div>
     <Input
      value={templates.meta.bd_owner || ''}
      onChange={(e) => updateMeta('bd_owner', e.target.value)}
      placeholder="BD POC"
      disabled={metaDisabled}
     />
    </div>
    <div>
     <div className="text-xs font-medium uppercase text-muted-foreground mb-1">R&D Lead</div>
     <Input
      value={templates.meta.rd_lead || ''}
      onChange={(e) => updateMeta('rd_lead', e.target.value)}
      placeholder="R&D Lead name"
      disabled={metaDisabled}
     />
    </div>
   </div>
  </Card>
 );

 const renderCheckbox = (stageKey: TemplateStageKey, path: string, label: string, helper?: string) => {
  const checked = Boolean(getIn((templates as any)[stageKey] ?? {}, path, false));
  return (
   <div className="flex items-start gap-3 rounded-md border p-3">
    <Checkbox
     checked={checked}
     onCheckedChange={(v) => updateField(stageKey, path, Boolean(v))}
     disabled={fieldsDisabled}
    />
    <div className="min-w-0">
     <div className="text-sm font-medium">{label}</div>
     {helper ? <div className="text-xs text-muted-foreground">{helper}</div> : null}
    </div>
   </div>
  );
 };

 const renderSelect = (
  stageKey: TemplateStageKey,
  path: string,
  label: string,
  options: string[],
  placeholder = 'Select'
 ) => {
  const value = String(getIn((templates as any)[stageKey] ?? {}, path, ''));
  return (
   <div>
    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">{label}</div>
    <Select
     value={value}
     onValueChange={(v) => updateField(stageKey, path, v)}
     disabled={fieldsDisabled}
    >
     <SelectTrigger>
      <SelectValue placeholder={placeholder} />
     </SelectTrigger>
     <SelectContent>
      {options.map((opt) => (
       <SelectItem key={opt} value={opt}>
        {opt}
       </SelectItem>
      ))}
     </SelectContent>
    </Select>
   </div>
  );
 };

 const renderInput = (
  stageKey: TemplateStageKey,
  path: string,
  label: string,
  placeholder?: string,
  type: 'text' | 'date' = 'text'
 ) => {
  const value = String(getIn((templates as any)[stageKey] ?? {}, path, ''));
  return (
   <div>
    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">{label}</div>
    <Input
     type={type}
     value={value}
     onChange={(e) => updateField(stageKey, path, e.target.value)}
     placeholder={placeholder}
     disabled={fieldsDisabled}
    />
   </div>
  );
 };

 const renderTextarea = (stageKey: TemplateStageKey, path: string, label: string, placeholder?: string) => {
  const value = String(getIn((templates as any)[stageKey] ?? {}, path, ''));
  return (
   <div>
    <div className="text-xs font-medium uppercase text-muted-foreground mb-1">{label}</div>
    <Textarea
     value={value}
     onChange={(e) => updateField(stageKey, path, e.target.value)}
     placeholder={placeholder}
     disabled={fieldsDisabled}
    />
   </div>
  );
 };

 const renderStageBody = (k: TemplateStageKey) => {
  if (k === 'S0') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Client Request Details</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderSelect('S0', 'product_category', 'Product Category', [
        'Face wash / Cleanser',
        'Moisturizer / Cream',
        'Sunscreen',
        'Serum',
        'Shampoo / Haircare',
        'Body lotion / Body cream',
        'Other',
       ])}
       {renderSelect('S0', 'dosage_form_client', 'Dosage Form (Client asked)', [
        'Gel',
        'Cream',
        'Lotion',
        'Serum',
        'Foam',
        'Solution',
        'Spray',
        'Stick',
       ])}
       {renderInput('S0', 'target_audience', 'Target Audience / Skin Type', 'oily / dry / sensitive etc')}
       {renderInput('S0', 'pack_sizes', 'Pack Size(s)', '50g, 100g, 250ml')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Requested Claims (select all)</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Dermatologist tested',
         'Non-comedogenic',
         'Fragrance free',
         'Paraben free',
         'Sulphate free',
         'Sensitive skin safe',
         'SPF/PA claim',
         'Water resistant',
         'Oil control / matte',
         'Hydrating / barrier repair',
         'Anti-itch / soothing',
         'Brightening / tone even',
        ].map((c, i) => (
         <div key={c}>
          {renderCheckbox('S0', `claims.c${i}`, c, 'Client requested / must-have')}
         </div>
        ))}
       </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderTextarea('S0', 'active_requests', 'Active Ingredients Requested', 'List actives + % if shared')}
       {renderTextarea('S0', 'budget_notes', 'Budget / Target Price / MOQ notes', 'Target costing, MOQ, timelines')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Attachments Received</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Reference product photos',
         'Reference formula sheet',
         'Competitor sample',
         'Artwork / label reference',
         'Regulatory constraints list',
         'Stability expectations',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S0', `attach.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>

     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Actionable Gate</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
       {[
        'All mandatory fields filled',
        'Client claims captured',
        'Initial feasibility flagged',
        'Alignment meeting scheduled',
       ].map((c, i) => (
        <div key={c}>{renderCheckbox('S0', `gate.c${i}`, c)}</div>
       ))}
      </div>
      <div className="mt-4">{renderTextarea('S0', 'bd_notes', 'BD Notes / Risks', 'Risks: impossible claims, unrealistic timelines, cost')}</div>
     </Card>
    </div>
   );
  }

  if (k === 'S1') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Alignment (BD + Client + R&D)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S1', 'meeting_date', 'Meeting Date', undefined, 'date')}
       {renderSelect('S1', 'result', 'Result', [
        'Aligned – proceed',
        'Partially aligned – revise PIS',
        'Not feasible – close',
       ])}
      </div>
      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Decision Checklist</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Dosage form agreed',
         'Active ingredient direction agreed',
         'Key claims agreed',
         'Specs range agreed',
         'Packaging direction agreed',
         'Timeline agreed',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S1', `decisions.c${i}`, c)}</div>
        ))}
       </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderTextarea('S1', 'open_points', 'Open Points', 'List open items + owner')}
       {renderTextarea('S1', 'finalized_summary', 'Finalized PIS Summary', 'Final dosage, actives, claims, specs, pack')}
      </div>
     </Card>

     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Gate</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
       {[
        'Client sign-off',
        'R&D feasibility sign-off',
        'BD ready for agreement',
        'Packaging lead review needed (if any)',
       ].map((c, i) => (
        <div key={c}>{renderCheckbox('S1', `gate.c${i}`, c)}</div>
       ))}
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'S2') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Agreement (BD)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderSelect('S2', 'agreement.type', 'Agreement Type', [
        'NDA',
        'Sample Development Agreement',
        'Master Service Agreement',
        'Commercial Terms Email Confirmation',
       ])}
       {renderSelect('S2', 'agreement.status', 'Status', [
        'Drafting',
        'Shared to client',
        'Negotiation',
        'Signed',
       ])}
       {renderInput('S2', 'agreement.signed_date', 'Signed Date', undefined, 'date')}
       {renderInput('S2', 'agreement.fee', 'Deposit / Fee (if any)', '₹ / terms')}
      </div>
      <div className="mt-4">{renderTextarea('S2', 'agreement.notes', 'Agreement Notes', 'Clauses, exceptions, approvals')}</div>
     </Card>

     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Handover to R&D Lead</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
       {[
        'Final PIS locked',
        'Agreement signed',
        'Project code created',
        'Assigned to R&D lead',
        'Packaging track triggered',
       ].map((c, i) => (
        <div key={c}>{renderCheckbox('S2', `handover.c${i}`, c)}</div>
       ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderInput('S2', 'handover_date', 'Handover Date', undefined, 'date')}
       {renderTextarea('S2', 'kickoff_notes', 'Kickoff Notes', 'Constraints, priority, timelines')}
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'S3') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">R&D Lead Review – Confirm / Update</div>
      <div className="text-xs text-muted-foreground mb-2">Active Composition – line item confirmation</div>
      <div className="overflow-x-auto">
       <table className="w-full text-sm">
        <thead>
         <tr className="text-left text-xs text-muted-foreground">
          <th className="p-2">Active</th>
          <th className="p-2">% / Range</th>
          <th className="p-2">Confirm?</th>
          <th className="p-2">Update Needed</th>
         </tr>
        </thead>
        <tbody>
         {[1, 2, 3, 4, 5].map((i) => (
          <tr key={i} className="border-t">
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).S3 ?? {}, `actives.a${i}.name`, ''))}
             onChange={(e) => updateField('S3', `actives.a${i}.name`, e.target.value)}
             placeholder={`Active ${i}`}
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).S3 ?? {}, `actives.a${i}.pct`, ''))}
             onChange={(e) => updateField('S3', `actives.a${i}.pct`, e.target.value)}
             placeholder="% / range"
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Select
             value={String(getIn((templates as any).S3 ?? {}, `actives.a${i}.confirm`, ''))}
             onValueChange={(v) => updateField('S3', `actives.a${i}.confirm`, v)}
             disabled={fieldsDisabled}
            >
             <SelectTrigger>
              <SelectValue placeholder="Select" />
             </SelectTrigger>
             <SelectContent>
              {['Confirmed', 'Needs Update', 'Remove'].map((opt) => (
               <SelectItem key={opt} value={opt}>
                {opt}
               </SelectItem>
              ))}
             </SelectContent>
            </Select>
           </td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).S3 ?? {}, `actives.a${i}.update`, ''))}
             onChange={(e) => updateField('S3', `actives.a${i}.update`, e.target.value)}
             placeholder="What to change"
             disabled={fieldsDisabled}
            />
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderSelect('S3', 'dosage_form_confirmed', 'Dosage Form (confirm)', [
        'Gel',
        'Cream',
        'Lotion',
        'Serum',
        'Foam',
        'Solution',
        'Spray',
        'Stick',
       ])}
       {renderTextarea('S3', 'claims_confirmed', 'Claims (confirm)', 'Confirm claims + feasibility notes')}
      </div>

      <div className="mt-4">{renderTextarea('S3', 'specs', 'Specifications (very specific)', 'pH, viscosity, SPF/PA method, appearance, odor, microbial, etc')}</div>
      <div className="mt-4">{renderTextarea('S3', 'updations', 'Updations Required + Owner', 'What to update + who will do')}</div>
     </Card>

     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Assignment</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S3', 'assigned_to', 'Assigned To', 'Name')}
       {renderSelect('S3', 'assignment_type', 'Assignment Type', ['Self', 'Team Member'])}
       {renderInput('S3', 'target_sample_date', 'Target Sample Ready Date', undefined, 'date')}
       {renderSelect('S3', 'priority', 'Priority', ['High', 'Normal', 'Low'])}
      </div>
      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Actives confirmed/updated',
         'Dosage confirmed',
         'Claims confirmed',
         'Specs confirmed',
         'Task assigned',
         'Packaging triggered (if applicable)',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S3', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'S4') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Development Updates</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S4', 'expected_timeline', 'Expected Timeline', 'e.g., 15 days / 4 weeks')}
       {renderInput('S4', 'latest_update_date', 'Latest Update Date', undefined, 'date')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       <div>
        {renderSelect('S4', 'internal.sourcing', 'Sourcing', ['Not started', 'In progress', 'Done', 'Blocked'])}
        <div className="mt-3">{renderTextarea('S4', 'internal.sourcing_notes', 'Sourcing Notes')}</div>
       </div>
       <div>
        {renderSelect('S4', 'internal.formulation', 'Formulation', ['Not started', 'In progress', 'Done', 'Blocked'])}
        <div className="mt-3">{renderTextarea('S4', 'internal.formulation_notes', 'Formulation Notes')}</div>
       </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       <div>
        {renderSelect('S4', 'internal.stability', 'Stability', [
         'Not started',
         'In progress',
         'Running',
         'Done',
         'Blocked',
        ])}
        <div className="mt-3">{renderTextarea('S4', 'internal.stability_notes', 'Stability Notes')}</div>
       </div>
       <div>{renderTextarea('S4', 'risks', 'Risks / Deviations')}</div>
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Key raw materials sourced',
         'Formula frozen for sample',
         'In-process checks done',
         'Stability samples planned',
         'PIS updated',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S4', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'S5') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Formulation Details (for QC)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderTextarea('S5', 'active_final', 'Active Composition (final)')}
       {renderTextarea('S5', 'full_comp', 'Full Composition Table (final)')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderTextarea('S5', 'spec_mapping', 'Specs Mapping: Client vs Final')}
       {renderTextarea('S5', 'claims_mapping', 'Claims Mapping')}
      </div>
      <div className="mt-4">{renderTextarea('S5', 'comments', 'R&D Comments')}</div>
     </Card>

     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Sample Production & Distribution</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S5', 'samples.count', 'No. Samples Produced')}
       {renderInput('S5', 'samples.weight', 'Sample Weight / Fill')}
       {renderInput('S5', 'samples.mfg_date', 'Mfg Date', undefined, 'date')}
       {renderInput('S5', 'samples.lab_ref', 'Lab Ref No.')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       <div>
        {renderInput('S5', 'dist.customer', 'Customer')}
        <div className="mt-3">{renderInput('S5', 'dist.control', 'Control')}</div>
       </div>
       <div>
        {renderInput('S5', 'dist.stability', 'Stability')}
        <div className="mt-3">{renderInput('S5', 'dist.marketing', 'Marketing/Other')}</div>
       </div>
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Active + full comp updated',
         'Specs mapping completed',
         'Claims mapping completed',
         'Labels ready (mfg/ref)',
         'Distribution logged',
         'Pushed to QC',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S5', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="mt-4">{renderTextarea('S5', 'client_sheet_payload', 'Client Share Sheet Payload', 'Client-facing summary to share for sample review')}</div>
     </Card>
    </div>
   );
  }

  if (k === 'S6') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Quality Validation</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S6', 'qc_reviewer', 'QC Reviewer')}
       {renderInput('S6', 'review_date', 'Review Date', undefined, 'date')}
       {renderSelect('S6', 'outcome', 'Outcome', ['Approved → Dispatch', 'Rejected → Back to R&D'])}
       {renderInput('S6', 'loop_count', 'Rejection Count', '0,1,2...')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Match Client Sheet vs Physical Sample</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Product name/code matches',
         'Mfg date matches',
         'Fill/qty matches',
         'Appearance ok',
         'Odor ok',
         'Label info correct',
         'Pack integrity ok',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S6', `match.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
       {renderTextarea('S6', 'obs', 'QC Observations')}
       {renderTextarea('S6', 'reject_reason', 'If Rejected – Reason + Action')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {['All checks passed', 'Docs complete', 'Sample accepted', 'Sent to dispatch'].map((c, i) => (
         <div key={c}>{renderCheckbox('S6', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'S7') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Dispatch Handover</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('S7', 'dispatch_owner', 'Dispatch Owner')}
       {renderInput('S7', 'dispatch_date', 'Dispatch Date', undefined, 'date')}
       {renderInput('S7', 'courier', 'Courier')}
       {renderInput('S7', 'tracking', 'Tracking ID')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Dispatch Checklist</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'QC approved',
         'Packing slip prepared',
         'Address confirmed',
         'Qty matches',
         'Stability/control retained',
         'Dispatch proof uploaded',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('S7', `chk.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="mt-4">{renderTextarea('S7', 'notes', 'Notes')}</div>
     </Card>
    </div>
   );
  }

  if (k === 'P1') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Packaging Lead Review</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('P1', 'lead', 'Packaging Lead')}
       {renderInput('P1', 'date', 'Review Date', undefined, 'date')}
       {renderSelect('P1', 'outcome', 'Outcome', [
        'Possible – proceed',
        'Possible with constraints',
        'Not possible – suggest alternatives',
       ])}
       {renderSelect('P1', 'pack_type', 'Pack Type Direction', [
        'Tube',
        'Jar',
        'Bottle',
        'Airless',
        'Pump',
        'Sachet',
       ])}
      </div>
      <div className="mt-4">{renderTextarea('P1', 'poss_limits', 'Possibilities / Limitations (to BD)')}</div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Testing Needs</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Compatibility test',
         'Leak test',
         'Label adhesion test',
         'Stability in pack',
         'Pump output calibration',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('P1', `tests.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {['Feedback shared to BD', 'Alternatives suggested', 'Move to alignment'].map((c, i) => (
         <div key={c}>{renderCheckbox('P1', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'P2') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Packaging Alignment (BD + Client + Packaging)</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('P2', 'date', 'Alignment Date', undefined, 'date')}
       {renderTextarea('P2', 'direction', 'Final Direction')}
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Selection Points</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Pack type locked',
         'Volume locked',
         'Material locked',
         'Decoration locked',
         'MOQ/lead time accepted',
         'Cost accepted',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('P2', `sel.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="mt-4">{renderTextarea('P2', 'minutes', 'Minutes')}</div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Gate</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {['All 3 aligned', 'Assigned to packaging team/self', 'Proceed to catalogue'].map((c, i) => (
         <div key={c}>{renderCheckbox('P2', `gate.c${i}`, c)}</div>
        ))}
       </div>
      </div>
     </Card>
    </div>
   );
  }

  if (k === 'P3') {
   return (
    <div className="space-y-4">
     <Card className="p-4">
      <div className="text-sm font-medium mb-3">Packaging Catalogue</div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
       {renderInput('P3', 'assigned_to', 'Assigned To')}
       {renderInput('P3', 'due_date', 'Due Date', undefined, 'date')}
      </div>

      <div className="mt-4 text-xs text-muted-foreground">Catalogue Options</div>
      <div className="overflow-x-auto mt-2">
       <table className="w-full text-sm">
        <thead>
         <tr className="text-left text-xs text-muted-foreground">
          <th className="p-2">Option</th>
          <th className="p-2">Pack</th>
          <th className="p-2">MOQ</th>
          <th className="p-2">Lead time</th>
          <th className="p-2">Cost</th>
          <th className="p-2">Status</th>
         </tr>
        </thead>
        <tbody>
         {[1, 2, 3, 4, 5].map((i) => (
          <tr key={i} className="border-t">
           <td className="p-2 font-mono text-xs">OPT-{i}</td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).P3 ?? {}, `items.i${i}.pack`, ''))}
             onChange={(e) => updateField('P3', `items.i${i}.pack`, e.target.value)}
             placeholder="100ml HDPE bottle"
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).P3 ?? {}, `items.i${i}.moq`, ''))}
             onChange={(e) => updateField('P3', `items.i${i}.moq`, e.target.value)}
             placeholder="10,000"
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).P3 ?? {}, `items.i${i}.lt`, ''))}
             onChange={(e) => updateField('P3', `items.i${i}.lt`, e.target.value)}
             placeholder="30 days"
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Input
             value={String(getIn((templates as any).P3 ?? {}, `items.i${i}.cost`, ''))}
             onChange={(e) => updateField('P3', `items.i${i}.cost`, e.target.value)}
             placeholder="₹"
             disabled={fieldsDisabled}
            />
           </td>
           <td className="p-2">
            <Select
             value={String(getIn((templates as any).P3 ?? {}, `items.i${i}.sel`, ''))}
             onValueChange={(v) => updateField('P3', `items.i${i}.sel`, v)}
             disabled={fieldsDisabled}
            >
             <SelectTrigger>
              <SelectValue placeholder="Select" />
             </SelectTrigger>
             <SelectContent>
              {['Shortlisted', 'Finalized', 'Rejected'].map((opt) => (
               <SelectItem key={opt} value={opt}>
                {opt}
               </SelectItem>
              ))}
             </SelectContent>
            </Select>
           </td>
          </tr>
         ))}
        </tbody>
       </table>
      </div>

      <div className="mt-4">
       <div className="text-xs font-medium uppercase text-muted-foreground mb-2">Approvals</div>
       <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {[
         'Packaging lead approved',
         'BD approved to share',
         'Client approved final pack',
         'Compatibility test planned',
        ].map((c, i) => (
         <div key={c}>{renderCheckbox('P3', `appr.c${i}`, c)}</div>
        ))}
       </div>
      </div>

      <div className="mt-4">{renderTextarea('P3', 'final_pack', 'Final Locked Packaging Summary')}</div>
     </Card>
    </div>
   );
  }

  return (
   <Card className="p-4">
    <div className="text-sm text-muted-foreground">Unknown stage</div>
   </Card>
  );
 };

 const mainStages = STAGES.filter((s) => s.track === 'main');
 const packagingStages = STAGES.filter((s) => s.track === 'packaging');

 const stageHeader = (s?: { title: string; hint: string }) => {
  if (!s) return null;
  return (
   <div className="flex items-center gap-2 flex-wrap">
    <div className="text-base font-semibold">{s.title}</div>
    {s.hint ? (
     <Badge variant="secondary" className="text-xs">
      {s.hint}
     </Badge>
    ) : null}
   </div>
  );
 };

 return (
  <div className="space-y-4">
   {selectedStage === 'S0' ? <Card className="p-4">{stageHeader(stageInfo)}</Card> : null}
   {renderMeta()}

   <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
    <Card className="p-3">
     <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Stages</div>
     <div className="space-y-1">
      {mainStages.map((s) => (
       <Button
        key={s.key}
        type="button"
        variant={selectedStage === s.key ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => {
         setSelectedStage(s.key);
         const next = { ...templates, current: s.key };
         setTemplates(next);
         void Promise.resolve(updatePIS(pis.id, { stageTemplates: next } as any)).catch(() => { });
        }}
       >
        {s.title}
       </Button>
      ))}
     </div>

     <div className="text-xs font-semibold uppercase text-muted-foreground mt-4 mb-2">Packaging Track</div>
     <div className="space-y-1">
      {packagingStages.map((s) => (
       <Button
        key={s.key}
        type="button"
        variant={selectedStage === s.key ? 'default' : 'ghost'}
        className="w-full justify-start"
        onClick={() => {
         setSelectedStage(s.key);
         const next = { ...templates, current: s.key };
         setTemplates(next);
         void Promise.resolve(updatePIS(pis.id, { stageTemplates: next } as any)).catch(() => { });
        }}
       >
        {s.title}
       </Button>
      ))}
     </div>
    </Card>

    <div className="space-y-2">
     {selectedStage !== 'S0' ? stageHeader(stageInfo) : null}
     {renderStageBody(selectedStage)}
    </div>
   </div>
  </div>
 );
}
