import React from 'react';
import type { PmConditionalVisibility } from '../../lib/pmConditionalFields';

type FormChangeHandler = (
  e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
) => void;

type PmConditionalFormSlice = Record<string, string | boolean | undefined>;

export type PmConditionalSection = 'primary' | 'technical' | 'aesthetics' | 'compatibility' | 'regulatory';

type PmConditionalFieldBlocksProps = {
  section: PmConditionalSection;
  visibility: PmConditionalVisibility;
  formData: PmConditionalFormSlice;
  errors: Record<string, string>;
  onChange: FormChangeHandler;
};

const CondInput: React.FC<{
  label: string;
  id: string;
  value: string;
  onChange: FormChangeHandler;
  placeholder?: string;
}> = ({ label, id, value, onChange, placeholder }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      type="text"
      id={id}
      value={value ?? ''}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
    />
  </div>
);

const PmConditionalFieldBlocks: React.FC<PmConditionalFieldBlocksProps> = ({
  section,
  visibility: v,
  formData: fd,
  errors: _errors,
  onChange,
}) => {
  const s = (key: string): string => String(fd[key] ?? '');

  if (section === 'primary' && !v.showPrimaryConditional) return null;
  if (section === 'technical' && !v.showTechnicalConditional) return null;
  if (section === 'aesthetics' && !v.showAestheticsConditional) return null;
  if (section === 'compatibility' && !v.showCompatibilityConditional) return null;
  if (section === 'regulatory' && !v.showRegulatoryConditional) return null;

  return (
    <>
      {section === 'primary' && v.showPrimaryConditional ? (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Primary packaging (PPM)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {v.primaryAssemblyCode ? (
              <CondInput
                label="Assembly / component-set code"
                id="pmAssemblyCode"
                value={s('pmAssemblyCode')}
                onChange={onChange}
                placeholder="Component-set / assembly code"
              />
            ) : null}
            {v.primaryComponentBreakdown ? (
              <CondInput
                label="Component breakdown"
                id="pmComponentBreakdown"
                value={s('pmComponentBreakdown')}
                onChange={onChange}
                placeholder="Bottle + cap + pump, etc."
              />
            ) : null}
            {v.primarySkuVolume ? (
              <CondInput
                label="SKU volume (ml/g)"
                id="pmSkuVolume"
                value={s('pmSkuVolume')}
                onChange={onChange}
                placeholder="e.g. 50 ml"
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {section === 'technical' && v.showTechnicalConditional ? (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Dimensions &amp; construction (by category)
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Fields appear based on category and sub-category. Pick category and sub-category above to see
            relevant inputs.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {v.technicalNominalVolume ? (
              <CondInput
                label="Nominal volume (ml/g)"
                id="specNominal"
                value={s('specNominal')}
                onChange={onChange}
                placeholder="Declared fill volume"
              />
            ) : null}
            {v.technicalShoulderHeight ? (
              <CondInput
                label="Shoulder height (mm)"
                id="pmShoulderHeightMm"
                value={s('pmShoulderHeightMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalOverallHeight ? (
              <CondInput
                label="Overall / total height (mm)"
                id="pmOverallHeightMm"
                value={s('pmOverallHeightMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalOuterDiameter ? (
              <CondInput
                label="Outer diameter (mm)"
                id="pmOuterDiameterMm"
                value={s('pmOuterDiameterMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalInnerDiameterNeck ? (
              <CondInput
                label="Inner diameter / neck size (mm)"
                id="pmInnerDiameterNeckMm"
                value={s('pmInnerDiameterNeckMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalCircumference ? (
              <CondInput
                label="Circumference (mm)"
                id="pmCircumferenceMm"
                value={s('pmCircumferenceMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalBrimfulVolume ? (
              <CondInput
                label="Brimful volume (ml)"
                id="specBrimful"
                value={s('specBrimful')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalEmptyWeight ? (
              <CondInput
                label="Empty weight (g)"
                id="specWeight"
                value={s('specWeight')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalOrifice ? (
              <CondInput label="Orifice (mm)" id="pmOrificeMm" value={s('pmOrificeMm')} onChange={onChange} />
            ) : null}
            {v.technicalClosureType ? (
              <CondInput
                label="Closure type"
                id="pmClosureType"
                value={s('pmClosureType')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalPumpCcDosage ? (
              <CondInput
                label="Pump CC / dosage"
                id="pmPumpCcDosage"
                value={s('pmPumpCcDosage')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalPipetteLength ? (
              <CondInput
                label="Pipette length (mm)"
                id="pmPipetteLengthMm"
                value={s('pmPipetteLengthMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalSleeveHeight ? (
              <CondInput
                label="Sleeve height (mm)"
                id="pmSleeveHeightMm"
                value={s('pmSleeveHeightMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalFillVolume ? (
              <CondInput
                label="Fill volume (ml)"
                id="pmFillVolumeMl"
                value={s('pmFillVolumeMl')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalPackWidth ? (
              <CondInput
                label="Pack width (mm)"
                id="pmPackWidthMm"
                value={s('pmPackWidthMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalPackHeight ? (
              <CondInput
                label="Pack height (mm)"
                id="pmPackHeightMm"
                value={s('pmPackHeightMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalOpenClosedSize ? (
              <CondInput
                label="Open / closed size (mm)"
                id="pmOpenClosedSizeMm"
                value={s('pmOpenClosedSizeMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalSealLaminateWidth ? (
              <CondInput
                label="Seal / laminate width (mm)"
                id="pmSealLaminateWidthMm"
                value={s('pmSealLaminateWidthMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalCartonLength ? (
              <CondInput
                label="Carton length (mm)"
                id="pmCartonLengthMm"
                value={s('pmCartonLengthMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalCartonWidth ? (
              <CondInput
                label="Carton width (mm)"
                id="pmCartonWidthMm"
                value={s('pmCartonWidthMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalCartonHeight ? (
              <CondInput
                label="Carton height (mm)"
                id="pmCartonHeightMm"
                value={s('pmCartonHeightMm')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalBoardPaperType ? (
              <CondInput
                label="Board / paper type"
                id="pmBoardPaperType"
                value={s('pmBoardPaperType')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalGsm ? (
              <CondInput label="GSM" id="pmGsm" value={s('pmGsm')} onChange={onChange} />
            ) : null}
            {v.technicalMaterialThickness ? (
              <CondInput
                label="Material thickness / micron"
                id="pmMaterialThicknessMicron"
                value={s('pmMaterialThicknessMicron')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalLamination ? (
              <CondInput label="Lamination" id="pmLamination" value={s('pmLamination')} onChange={onChange} />
            ) : null}
            {v.technicalStickerType ? (
              <CondInput
                label="Sticker type"
                id="pmStickerType"
                value={s('pmStickerType')}
                onChange={onChange}
              />
            ) : null}
            {v.technicalPrinting ? (
              <CondInput
                label="Printing (CMYK / Pantones)"
                id="pmPrintingCmykPantones"
                value={s('pmPrintingCmykPantones')}
                onChange={onChange}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {section === 'aesthetics' && v.showAestheticsConditional ? (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Component colours (by sub-category)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {v.aestheticsShoulderColour ? (
              <CondInput
                label="Shoulder colour"
                id="pmShoulderColour"
                value={s('pmShoulderColour')}
                onChange={onChange}
              />
            ) : null}
            {v.aestheticsCapOvercapColour ? (
              <CondInput
                label="Cap / overcap colour"
                id="pmCapOvercapColour"
                value={s('pmCapOvercapColour')}
                onChange={onChange}
              />
            ) : null}
            {v.aestheticsActuatorColourStyle ? (
              <CondInput
                label="Actuator colour &amp; style"
                id="pmActuatorColourStyle"
                value={s('pmActuatorColourStyle')}
                onChange={onChange}
              />
            ) : null}
            {v.aestheticsCollarFinish ? (
              <CondInput
                label="Collar finish"
                id="pmCollarFinish"
                value={s('pmCollarFinish')}
                onChange={onChange}
              />
            ) : null}
            {v.aestheticsTeatColour ? (
              <CondInput label="Teat colour" id="pmTeatColour" value={s('pmTeatColour')} onChange={onChange} />
            ) : null}
          </div>
        </div>
      ) : null}

      {section === 'compatibility' && v.showCompatibilityConditional ? (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Label / carton compatibility (SPM)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {v.compatSuitableContainerType ? (
              <CondInput
                label="Suitable container type"
                id="pmSuitableContainerType"
                value={s('pmSuitableContainerType')}
                onChange={onChange}
              />
            ) : null}
            {v.compatContainerSurface ? (
              <CondInput
                label="Container surface (flat / round / curved)"
                id="pmContainerSurface"
                value={s('pmContainerSurface')}
                onChange={onChange}
              />
            ) : null}
            {v.compatAdhesiveCompatibility ? (
              <CondInput
                label="Adhesive compatibility"
                id="pmAdhesiveCompatibility"
                value={s('pmAdhesiveCompatibility')}
                onChange={onChange}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {section === 'regulatory' && v.showRegulatoryConditional ? (
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
            Food / cosmetic contact (PPM)
          </h3>
          <CondInput
            label="Food / cosmetic-contact compliance"
            id="regFoodCosmeticCompliance"
            value={s('regFoodCosmeticCompliance')}
            onChange={onChange}
            placeholder="e.g. EU 10/2011, FDA compliant"
          />
        </div>
      ) : null}
    </>
  );
};

export default PmConditionalFieldBlocks;
