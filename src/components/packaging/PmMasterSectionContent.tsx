import React from 'react';
import type { PmCommercialVendor } from '../VendorCommercialEditor';
import VendorCommercialEditor, { type VendorTierDraft } from '../VendorCommercialEditor';
import { MasterLinkedPrProductsPanel } from '../masters/MasterLinkedPrProductsPanel';
import { MasterCustomQualitySpecsSection } from '../masters/MasterCustomQualitySpecsSection';
import PmSchemaFieldRenderer from './PmSchemaFieldRenderer';
import { MasterSelectWithOptions } from '../masters/MasterSelectWithOptions';
import type { PmMasterModuleSlug } from '../../constants/pmMasterFieldSchema';
import type { PmMasterFieldContext } from '../../lib/pmMasterFieldVisibility';
import type { QualitySpecTableRow } from '../../types/qualitySpecTable';
import type { VendorClientRecord } from '../../services/vendorClient.service';

type FormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

type InputFieldProps = {
  label: string;
  id: string;
  value: string;
  onChange: FormChangeHandler;
  placeholder?: string;
  requiredMark?: boolean;
  error?: string;
  readOnly?: boolean;
};

type SelectFieldProps = InputFieldProps & {
  options: readonly string[] | { value: string; label: string }[];
  emptyLabel?: string;
  disabled?: boolean;
};

type TextareaFieldProps = {
  label: string;
  id: string;
  value: string;
  onChange: FormChangeHandler;
  placeholder?: string;
};

export type PmMasterSectionContentProps = {
  sectionIndex: number;
  moduleSlug: PmMasterModuleSlug;
  fieldContext: PmMasterFieldContext;
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  isNewPm: boolean;
  pmUsesFunctionalTaxonomy: boolean;
  pmDetailSubCategoryRequired: boolean;
  pmSubSubCategoryRequired: boolean;
  pmFunctionalCategoryLabel: string;
  pmFunctionalSubCategoryLabel: string;
  pmDetailSubCategoryOptions: { value: string; label: string }[];
  pmSubSubCategoryOptions: { value: string; label: string }[];
  pmSkuCategorySelectOptions: { value: string; label: string }[];
  pmSkuCategoryOptions: readonly string[];
  pmLinkedProductCodes: string[];
  taxIsTaxable: boolean;
  showPmQualitySpecTable: boolean;
  canEditPmQualityCategory: boolean;
  showPmQualitySubSpecTable: boolean;
  pmQualitySpecResolved: { categoryDisplayLabel: string; functionalSub: string };
  currentPmSubSpecRows: QualitySpecTableRow[];
  onPmQualitySpecRowsChange: (rows: QualitySpecTableRow[]) => void;
  onPmQualitySubSpecRowsChange: (rows: QualitySpecTableRow[]) => void;
  customFieldsTaxonomyLabel: string;
  onTradeCommercialNameChange: (value: string) => void;
  vendorClientList: VendorClientRecord[];
  tempVendor: Record<string, string>;
  tempVendorTiers: VendorTierDraft[];
  onPmVendorTempFieldChange: (field: string, value: string) => void;
  onTempVendorTierChange: (index: number, field: string, value: string) => void;
  onAddTempVendorTierRow: () => void;
  onAddVendor: () => void;
  onRemoveVendor: (index: number) => void;
  onVendorsChange: (vendors: PmCommercialVendor[]) => void;
  InputField: React.FC<InputFieldProps>;
  SelectField: React.FC<SelectFieldProps>;
  TextareaField: React.FC<TextareaFieldProps>;
  onRemoveCustomFieldValue?: (formKey: string) => void;
};

const str = (v: unknown): string => String(v ?? '');

const PmMasterSectionContent: React.FC<PmMasterSectionContentProps> = (props) => {
  const {
    sectionIndex,
    moduleSlug,
    fieldContext,
    formData,
    errors,
    onChange,
    isNewPm,
    pmUsesFunctionalTaxonomy,
    pmDetailSubCategoryRequired,
    pmSubSubCategoryRequired,
    pmFunctionalCategoryLabel,
    pmFunctionalSubCategoryLabel,
    pmDetailSubCategoryOptions,
    pmSubSubCategoryOptions,
    pmSkuCategorySelectOptions,
    pmSkuCategoryOptions,
    pmLinkedProductCodes,
    taxIsTaxable,
    showPmQualitySpecTable,
    canEditPmQualityCategory,
    showPmQualitySubSpecTable,
    pmQualitySpecResolved,
    currentPmSubSpecRows,
    onPmQualitySpecRowsChange,
    onPmQualitySubSpecRowsChange,
    customFieldsTaxonomyLabel,
    onTradeCommercialNameChange,
    vendorClientList,
    tempVendor,
    tempVendorTiers,
    onPmVendorTempFieldChange,
    onTempVendorTierChange,
    onAddTempVendorTierRow,
    onAddVendor,
    onRemoveVendor,
    onVendorsChange,
    InputField,
    SelectField,
    TextareaField,
    onRemoveCustomFieldValue,
  } = props;

  const fd = formData as Record<string, string | undefined>;
  const schemaRendererProps = {
    context: fieldContext,
    formData: fd,
    errors,
    onChange,
    taxonomyLabel: customFieldsTaxonomyLabel,
    onRemoveCustomFieldValue,
  };

  if (sectionIndex === 0) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            {pmUsesFunctionalTaxonomy
              ? 'SKU series, category & sub-category'
              : 'Category, sub-category & sub-sub category'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MasterSelectWithOptions
              label={pmUsesFunctionalTaxonomy ? 'SKU series' : 'Category'}
              fieldLabel={pmUsesFunctionalTaxonomy ? 'SKU series' : 'Category'}
              id="pmSkuCategory"
              value={str(formData.pmSkuCategory)}
              onChange={onChange}
              options={pmSkuCategorySelectOptions}
              requiredMark
              error={errors.pmSkuCategory}
            />
            {formData.pmSkuCategory &&
            !pmSkuCategoryOptions.includes(String(formData.pmSkuCategory)) ? (
              <p className="text-[10px] text-amber-800 mt-1 col-span-2">
                Legacy category &quot;{String(formData.pmSkuCategory)}&quot; — pick a PPM / SPM / TPM option.
              </p>
            ) : null}
            {pmDetailSubCategoryRequired ? (
              <MasterSelectWithOptions
                label={pmFunctionalCategoryLabel}
                fieldLabel={pmFunctionalCategoryLabel}
                id="optionalPmSubCategory"
                value={str(formData.optionalPmSubCategory)}
                onChange={onChange}
                options={pmDetailSubCategoryOptions}
                error={errors.optionalPmSubCategory}
                disabled={!str(formData.pmSkuCategory).trim()}
                emptyLabel="Select sub-category…"
              />
            ) : (
              <InputField
                label={pmFunctionalCategoryLabel}
                id="optionalPmSubCategory"
                value={str(formData.optionalPmSubCategory)}
                onChange={onChange}
                placeholder="Select a category first"
                error={errors.optionalPmSubCategory}
                readOnly={!str(formData.pmSkuCategory).trim()}
              />
            )}
            {pmSubSubCategoryRequired ? (
              <MasterSelectWithOptions
                label={pmFunctionalSubCategoryLabel}
                fieldLabel={pmFunctionalSubCategoryLabel}
                id="optionalPmSubSubCategory"
                value={str(formData.optionalPmSubSubCategory)}
                onChange={onChange}
                options={pmSubSubCategoryOptions}
                error={errors.optionalPmSubSubCategory}
                disabled={!str(formData.optionalPmSubCategory).trim()}
                emptyLabel="Select sub-sub category…"
              />
            ) : (
              <InputField
                label={pmFunctionalSubCategoryLabel}
                id="optionalPmSubSubCategory"
                value={str(formData.optionalPmSubSubCategory)}
                onChange={onChange}
                placeholder={
                  str(formData.optionalPmSubCategory).trim()
                    ? 'No sub-sub options for this sub-category'
                    : 'Select sub-category first'
                }
                error={errors.optionalPmSubSubCategory}
                readOnly
              />
            )}
          </div>
        </div>

        {!isNewPm ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Material Code (SKU)</label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm font-mono text-gray-800">
              {str(formData.itemCode) || '—'}
            </div>
          </div>
        ) : null}

        <div className="border-t border-gray-200 pt-4">
          <InputField
            label="PM Name / Description"
            id="tradeCommercialName"
            value={str(formData.tradeCommercialName)}
            onChange={(e) => onTradeCommercialNameChange(e.target.value)}
            placeholder="Packaging item name and short description"
            requiredMark
            error={errors.tradeCommercialName ?? errors.name}
          />
        </div>

        <PmSchemaFieldRenderer
          module="primary"
          {...schemaRendererProps}
          skipKeys={['itemCode', 'tradeCommercialName']}
        />

        <div>
          <label htmlFor="level" className="block text-sm font-medium text-gray-700 mb-1">
            Level
          </label>
          <input
            id="level"
            type="text"
            readOnly
            value={str(formData.level) || '—'}
            className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-slate-800 cursor-default"
          />
          <p className="text-xs text-gray-500 mt-2">Auto: PPM → Primary, SPM → Secondary, TPM → Tertiary</p>
        </div>
      </div>
    );
  }

  if (sectionIndex === 1) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PmSchemaFieldRenderer module="units" {...schemaRendererProps} />
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Zoho integration
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MasterSelectWithOptions
              label="Returnable item"
              fieldLabel="Returnable item"
              id="pkgReturnable"
              value={str(formData.pkgReturnable)}
              onChange={onChange}
              options={['Yes', 'No']}
              requiredMark
              error={errors.pkgReturnable}
            />
            <MasterSelectWithOptions
              label="Tax preference"
              fieldLabel="Tax preference"
              id="pkgTaxPreference"
              value={str(formData.pkgTaxPreference)}
              onChange={onChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
              requiredMark
              error={errors.pkgTaxPreference}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            HSN / SAC and GST rate are in the fields above per master schema. Taxable preference controls Zoho sync validation.
          </p>
        </div>
      </div>
    );
  }

  if (sectionIndex === 2) {
    return (
      <PmSchemaFieldRenderer module="dimensions" {...schemaRendererProps} />
    );
  }

  if (sectionIndex === 3) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Linked products</h3>
          {pmLinkedProductCodes.length > 0 ? (
            <MasterLinkedPrProductsPanel codes={pmLinkedProductCodes} accent="violet" />
          ) : (
            <TextareaField
              label="Associate items"
              id="pkgAssociateItems"
              value={str(formData.pkgAssociateItems)}
              onChange={onChange}
              placeholder="Link related BOM / RM / packaging codes if any"
            />
          )}
        </div>
        <PmSchemaFieldRenderer module="material" {...schemaRendererProps} />
      </div>
    );
  }

  if (sectionIndex === 4) {
    return (
      <PmSchemaFieldRenderer module="aesthetics" {...schemaRendererProps} />
    );
  }

  if (sectionIndex === 5) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <PmSchemaFieldRenderer module="quality" {...schemaRendererProps} />
        {showPmQualitySpecTable ? (
          <MasterCustomQualitySpecsSection
            variant="pm"
            taxonomyLabel={customFieldsTaxonomyLabel}
            categoryLabel={
              pmQualitySpecResolved.categoryDisplayLabel ||
              (str(formData.optionalPmSubCategory) || '—')
            }
            categoryScopeLabel={pmQualitySpecResolved.categoryDisplayLabel || '—'}
            subCategoryLabel={pmQualitySpecResolved.functionalSub || '—'}
            commonRows={(formData.pmQualitySpecRows as QualitySpecTableRow[]) ?? []}
            subRows={currentPmSubSpecRows}
            onCommonChange={onPmQualitySpecRowsChange}
            onSubChange={onPmQualitySubSpecRowsChange}
            showSubTable={showPmQualitySubSpecTable}
            categoryTableEnabled={canEditPmQualityCategory}
            categoryDisabledHint={
              canEditPmQualityCategory
                ? undefined
                : 'Select PM category in Primary info to add common specs.'
            }
            subTableEnabled={showPmQualitySubSpecTable}
            subTableDisabledHint={
              showPmQualitySubSpecTable
                ? undefined
                : 'Select PM sub-category in Primary info to add sub-category specs.'
            }
          />
        ) : (
          <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-3">
            Complete <strong>Primary info</strong> and pick category / sub-category to add GRN quality
            specifications.
          </p>
        )}
      </div>
    );
  }

  if (sectionIndex === 6) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Vendors &amp; commercial
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Add vendors with MOQ, pricing, lead time, and payment terms. Pick a vendor from suggestions to
            auto-fill commercial details from the vendor master.
          </p>
          <VendorCommercialEditor
            variant="pm"
            vendors={(formData.vendors as PmCommercialVendor[]) ?? []}
            tempFields={tempVendor}
            tempTiers={tempVendorTiers}
            vendorClientList={vendorClientList}
            onTempFieldChange={onPmVendorTempFieldChange}
            onTempTierChange={onTempVendorTierChange}
            onAddTempTierRow={onAddTempVendorTierRow}
            onAddVendor={onAddVendor}
            onRemoveVendor={onRemoveVendor}
            onVendorsChange={onVendorsChange}
            errors={errors}
          />
        </div>
      </div>
    );
  }

  return null;
};

export default PmMasterSectionContent;
