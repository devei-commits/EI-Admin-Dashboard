import React from 'react';
import VendorCommercialEditor, { type RmCommercialVendor, type VendorTierDraft } from '../VendorCommercialEditor';
import { MasterLinkedPrProductsPanel } from '../masters/MasterLinkedPrProductsPanel';
import { MasterCustomQualitySpecsSection } from '../masters/MasterCustomQualitySpecsSection';
import RmSchemaFieldRenderer from './RmSchemaFieldRenderer';
import { MasterSelectWithOptions } from '../masters/MasterSelectWithOptions';
import type { RmMasterModuleSlug } from '../../constants/rmMasterFieldSchema';
import type { RmMasterFieldContext } from '../../lib/rmMasterFieldVisibility';
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
  disabled?: boolean;
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

export type RmMasterSectionContentProps = {
  sectionIndex: number;
  moduleSlug: RmMasterModuleSlug;
  fieldContext: RmMasterFieldContext;
  formData: Record<string, unknown>;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
  isNewRm: boolean;
  rmDetailSubCategoryRequired: boolean;
  rmSubSubCategoryRequired: boolean;
  rmFunctionalCategoryLabel: string;
  rmFunctionalSubCategoryLabel: string;
  rmDetailSubCategoryOptions: { value: string; label: string }[];
  rmSubSubCategoryOptions: { value: string; label: string }[];
  rmSkuCategorySelectOptions: { value: string; label: string }[];
  rmLinkedProductCodes: string[];
  taxIsTaxable: boolean;
  showRmQualitySpecTable: boolean;
  canEditRmQualityCategory: boolean;
  showRmQualitySubSpecTable: boolean;
  rmQualitySpecResolved: {
    categoryDisplayLabel: string;
    functionalCategory: string;
    functionalSub: string;
    functionalSubSub: string;
    subSpecPathKey: string;
  };
  currentSubSpecRows: QualitySpecTableRow[];
  onRmQualitySpecRowsChange: (rows: QualitySpecTableRow[]) => void;
  onRmQualitySubSpecRowsChange: (rows: QualitySpecTableRow[]) => void;
  primaryUomOptions: readonly string[];
  vendorClientList: VendorClientRecord[];
  tempVendor: Record<string, string>;
  tempVendorTiers: VendorTierDraft[];
  onVendorTempFieldChange: (field: string, value: string) => void;
  onTempVendorTierChange: (index: number, field: string, value: string) => void;
  onAddTempVendorTierRow: () => void;
  onAddVendor: () => void;
  onRemoveVendor: (index: number) => void;
  onVendorsChange: (vendors: RmCommercialVendor[]) => void;
  InputField: React.FC<InputFieldProps>;
  SelectField: React.FC<SelectFieldProps>;
  TextareaField: React.FC<TextareaFieldProps>;
  customFieldsTaxonomyLabel: string;
  onRemoveCustomFieldValue?: (formKey: string) => void;
  /** Loaded RM id — scopes "item specific" TECH custom fields to this one item. */
  technicalItemScopeId?: string;
};

const str = (v: unknown): string => String(v ?? '');

const RmMasterSectionContent: React.FC<RmMasterSectionContentProps> = (props) => {
  const {
    sectionIndex,
    moduleSlug,
    fieldContext,
    formData,
    errors,
    onChange,
    isNewRm,
    rmDetailSubCategoryRequired,
    rmSubSubCategoryRequired,
    rmFunctionalCategoryLabel,
    rmFunctionalSubCategoryLabel,
    rmDetailSubCategoryOptions,
    rmSubSubCategoryOptions,
    rmSkuCategorySelectOptions,
    rmLinkedProductCodes,
    showRmQualitySpecTable,
    canEditRmQualityCategory,
    showRmQualitySubSpecTable,
    rmQualitySpecResolved,
    currentSubSpecRows,
    onRmQualitySpecRowsChange,
    onRmQualitySubSpecRowsChange,
    primaryUomOptions,
    vendorClientList,
    tempVendor,
    tempVendorTiers,
    onVendorTempFieldChange,
    onTempVendorTierChange,
    onAddTempVendorTierRow,
    onAddVendor,
    onRemoveVendor,
    onVendorsChange,
    InputField,
    SelectField,
    TextareaField,
    customFieldsTaxonomyLabel,
    onRemoveCustomFieldValue,
    technicalItemScopeId,
  } = props;

  const fd = formData as Record<string, string | undefined>;
  const schemaRendererProps = {
    context: fieldContext,
    formData: fd,
    errors,
    onChange,
    taxonomyLabel: customFieldsTaxonomyLabel,
    onRemoveCustomFieldValue,
    technicalEntityType: 'RM' as const,
    technicalCategoryScopeKey: rmQualitySpecResolved.functionalCategory,
    technicalSubCategoryKey: rmQualitySpecResolved.functionalSub,
    technicalCategoryScopeLabel: rmQualitySpecResolved.categoryDisplayLabel || '—',
    technicalSubCategoryLabel: rmQualitySpecResolved.functionalSub || '—',
    technicalItemScopeId,
  };

  if (sectionIndex === 0) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div className="min-w-0">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-4 mb-3">
            Category, sub-category &amp; sub-sub category
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <MasterSelectWithOptions
              label="Category"
              fieldLabel="Category"
              id="subCategory"
              value={str(formData.subCategory)}
              onChange={onChange}
              options={rmSkuCategorySelectOptions}
              requiredMark
              error={errors.subCategory}
            />
            {rmDetailSubCategoryRequired ? (
              <MasterSelectWithOptions
                label={rmFunctionalCategoryLabel}
                fieldLabel={rmFunctionalCategoryLabel}
                id="optionalRmSubCategory"
                value={str(formData.optionalRmSubCategory)}
                onChange={onChange}
                options={rmDetailSubCategoryOptions}
                error={errors.optionalRmSubCategory}
                disabled={!str(formData.subCategory).trim()}
              />
            ) : (
              <InputField
                label={rmFunctionalCategoryLabel}
                id="optionalRmSubCategory"
                value={str(formData.optionalRmSubCategory)}
                onChange={onChange}
                placeholder="Select a category first"
                error={errors.optionalRmSubCategory}
                disabled={!str(formData.subCategory).trim()}
              />
            )}
            {rmSubSubCategoryRequired ? (
              <MasterSelectWithOptions
                label={rmFunctionalSubCategoryLabel}
                fieldLabel={rmFunctionalSubCategoryLabel}
                id="optionalRmSubSubCategory"
                value={str(formData.optionalRmSubSubCategory)}
                onChange={onChange}
                options={rmSubSubCategoryOptions}
                error={errors.optionalRmSubSubCategory}
                disabled={!str(formData.optionalRmSubCategory).trim()}
              />
            ) : (
              <InputField
                label={rmFunctionalSubCategoryLabel}
                id="optionalRmSubSubCategory"
                value={str(formData.optionalRmSubSubCategory)}
                onChange={onChange}
                placeholder={
                  str(formData.optionalRmSubCategory).trim()
                    ? 'No sub-sub options for this sub-category'
                    : 'Select sub-category first'
                }
                error={errors.optionalRmSubSubCategory}
                readOnly
                disabled={!str(formData.subCategory).trim() || !str(formData.optionalRmSubCategory).trim()}
              />
            )}
          </div>
          <p className="text-xs text-ink-3 mt-2">
            Category drives the internal SKU prefix (<span className="font-mono">1</span> raw materials,{' '}
            <span className="font-mono">2</span> fragrance, <span className="font-mono">3</span> colours).
          </p>
        </div>

        {!isNewRm ? (
          <div>
            <label className="block text-sm font-medium text-ink-2 mb-1">Material Code (SKU)</label>
            <div className="rounded-lg border border-border bg-surface-3 px-3 py-2.5 text-sm font-mono text-ink">
              {str(formData.rmSku) || '—'}
            </div>
            <p className="text-xs text-ink-3 mt-1">Assigned at creation — cannot be changed here.</p>
          </div>
        ) : null}

        <RmSchemaFieldRenderer module="primary" {...schemaRendererProps} skipKeys={['rmSku']} />
      </div>
    );
  }

  if (sectionIndex === 1) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <RmSchemaFieldRenderer
          module="units"
          {...schemaRendererProps}
          primaryUomOptions={primaryUomOptions}
        />
        <div className="border border-border rounded-lg p-3 sm:p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-4 mb-3">Zoho integration</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MasterSelectWithOptions
              label="Returnable Item"
              fieldLabel="Returnable Item"
              id="rmReturnable"
              value={str(formData.rmReturnable)}
              onChange={onChange}
              options={['Yes', 'No']}
              requiredMark
              error={errors.rmReturnable}
            />
            <MasterSelectWithOptions
              label="Tax Preference"
              fieldLabel="Tax Preference"
              id="rmTaxPreference"
              value={str(formData.rmTaxPreference)}
              onChange={onChange}
              options={['Taxable', 'ExemptedGoods', 'ExemptedServices', 'NonGST']}
              requiredMark
              error={errors.rmTaxPreference}
            />
          </div>
          <p className="text-xs text-ink-3 mt-2">
            HSN / SAC and GST rate are in the fields above per master schema. Taxable preference controls Zoho sync
            validation.
          </p>
        </div>
        <div className="border border-border rounded-lg p-3 sm:p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-4 mb-3">Linked products</h3>
          {rmLinkedProductCodes.length > 0 ? (
            <MasterLinkedPrProductsPanel codes={rmLinkedProductCodes} accent="teal" />
          ) : (
            <TextareaField
              label="Associate Items"
              id="rmAssociateItems"
              value={str(formData.rmAssociateItems)}
              onChange={onChange}
              placeholder="Link related RM / PM / packaging codes if any"
            />
          )}
        </div>
      </div>
    );
  }

  if (sectionIndex === 2) {
    return (
      <RmSchemaFieldRenderer module="regulatory" {...schemaRendererProps} />
    );
  }

  if (sectionIndex === 3) {
    return (
      <RmSchemaFieldRenderer module="technical" {...schemaRendererProps} />
    );
  }

  if (sectionIndex === 4) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <RmSchemaFieldRenderer module="quality" {...schemaRendererProps} />
        {showRmQualitySpecTable ? (
          <MasterCustomQualitySpecsSection
            variant="rm"
            entityType="RM"
            categoryScopeKey={rmQualitySpecResolved.functionalCategory}
            subCategoryKey={rmQualitySpecResolved.functionalSub}
            subSubCategoryKey={rmQualitySpecResolved.functionalSubSub}
            taxonomyLabel={customFieldsTaxonomyLabel}
            categoryLabel={
              rmQualitySpecResolved.categoryDisplayLabel ||
              (str(formData.subCategory) ? str(formData.subCategory) : '—')
            }
            categoryScopeLabel={rmQualitySpecResolved.categoryDisplayLabel || '—'}
            subCategoryLabel={rmQualitySpecResolved.functionalSub || '—'}
            subSubCategoryLabel={rmQualitySpecResolved.functionalSubSub || '—'}
            commonRows={(formData.rmQualitySpecRows as QualitySpecTableRow[]) ?? []}
            subRows={currentSubSpecRows}
            onCommonChange={onRmQualitySpecRowsChange}
            onSubChange={onRmQualitySubSpecRowsChange}
            showSubTable={showRmQualitySubSpecTable}
            categoryTableEnabled={canEditRmQualityCategory}
            categoryDisabledHint={
              canEditRmQualityCategory
                ? undefined
                : 'Select RM detail sub-category in Primary info to add category specs.'
            }
            subTableEnabled={showRmQualitySubSpecTable}
            subTableDisabledHint={
              showRmQualitySubSpecTable
                ? undefined
                : 'Select RM sub-category in Primary info to add sub-category specs.'
            }
          />
        ) : (
          <p className="text-sm text-ink-3 border border-dashed border-border rounded-lg px-4 py-3">
            Complete <strong>Primary info</strong> (sub-category) first to add quality specifications.
          </p>
        )}
      </div>
    );
  }

  if (sectionIndex === 5) {
    return (
      <div className="min-w-0 space-y-5 sm:space-y-6">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-ink-4 mb-3">
            Vendors &amp; commercial
          </h3>
          <p className="text-xs text-ink-3 mb-3">
            Add vendors with MOQ, pricing, lead time, and payment terms. Pick a vendor from suggestions to
            auto-fill commercial details from the vendor master.
          </p>
          {errors.vendors ? (
            <p className="text-xs text-err mb-2" role="alert">
              {errors.vendors}
            </p>
          ) : null}
          <VendorCommercialEditor
            variant="rm"
            vendors={(formData.vendors as RmCommercialVendor[]) ?? []}
            tempFields={tempVendor}
            tempTiers={tempVendorTiers}
            vendorClientList={vendorClientList}
            onTempFieldChange={onVendorTempFieldChange}
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

  return (
    <RmSchemaFieldRenderer module={moduleSlug} {...schemaRendererProps} />
  );
};

export default RmMasterSectionContent;
