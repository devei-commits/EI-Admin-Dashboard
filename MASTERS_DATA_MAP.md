# Masters — Complete Data Map
> **Source of truth:** Read directly from model files + field schema constants. No assumptions.
> Backend: `ei-website-backend` (Sequelize / PostgreSQL) | Frontend: `EI-Admin-Dashboard` (React/TS)

---

## Storage Architecture (Read This First)

All three primary masters (RM, PM, PR) use a **hybrid storage pattern**:

```
┌─────────────────────────────────────────────────────────────────┐
│                  HYBRID STORAGE PATTERN                         │
│                                                                 │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   │
│  │  PROMOTED COLUMNS        │   │   form_data (JSON)        │   │
│  │  (indexed, queryable)    │   │   (full form payload)     │   │
│  │                          │   │                           │   │
│  │  code, name, category,   │   │  ALL scalar form fields   │   │
│  │  uom, gst, status,       │   │  vendors[], documents[],  │   │
│  │  hsn_code, etc.          │   │  tests[], qualitySpecs[]  │   │
│  └─────────────────────────┘   └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Key rule:** When a field appears both in a dedicated column AND in `form_data`, the dedicated column value is the authoritative read path for list views. `form_data` is the read path for the form/edit view.

---

## 1. RAW MATERIALS MASTER

**DB Table:** `raw_materials`  
**Frontend Route:** `/raw-material`  
**Component:** `src/pages/RawMaterialForm.tsx`  
**API:** `GET /api/v1/raw-materials`  
**Schema file:** `src/constants/rmMasterFieldSchema.ts`

---

### 1A — Dashboard List View Columns

```
┌─────────────────┬──────────────────────────────────┬────────────────────────────────────────┐
│  COLUMN LABEL   │  DB TABLE . COLUMN               │  NOTES                                 │
├─────────────────┼──────────────────────────────────┼────────────────────────────────────────┤
│  Code           │  raw_materials.code              │  STRING(100), auto-generated           │
│  Name / INCI    │  raw_materials.name              │  Trade/commercial name                 │
│                 │  raw_materials.inci              │  INCI name (sub-label)                 │
│  Category       │  raw_materials.category          │  STRING(100)                           │
│  Sub-category   │  raw_materials.form_data         │  → JSON key: subCategory               │
│  UOM            │  raw_materials.uom               │  STRING(20): KG/GM/L/ML                │
│  Status         │  raw_materials.status            │  Approval status string                │
│  Assign         │  raw_materials                   │  .approval_assigned_display_name       │
│                 │  raw_materials                   │  .approval_assigned_user_id (FK→users) │
│  Products       │  raw_materials.products          │  JSON array of PR codes — shows count  │
│  Logs           │  master_approval_status_history  │  WHERE master_kind='RM'                │
│                 │                                  │  AND master_id = raw_materials.id      │
│  Actions        │  (UI only)                       │  Edit / Delete buttons                 │
└─────────────────┴──────────────────────────────────┴────────────────────────────────────────┘
```

---

### 1B — Form Fields by Module

> **Storage note:** All fields below are stored in `raw_materials.form_data` (JSON).
> Fields marked ★ are ALSO promoted to a dedicated column.

#### MODULE 1: PRIMARY INFO

```
┌──────────────────────────────────┬──────────────────────────┬──────────────────────────────────────────┐
│  UI LABEL                        │  form_data KEY           │  ALSO IN COLUMN                          │
├──────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│  Material Code (SKU)             │  rmSku                   │  ★ raw_materials.code                    │
│  INCI Name            [REQ]      │  inciName                │  ★ raw_materials.inci                    │
│  Trade / Commercial Name [REQ]   │  tradeCommercialName     │  ★ raw_materials.name                    │
│  CAS Number                      │  casNo                   │  form_data only                          │
│  Function in Formula  [REQ]      │  functionRole            │  form_data only                          │
│    Options: Solvent, Emulsifier, Surfactant, Active, Preservative,                                     │
│             UV Filter, Wax/Butter, Botanical, Rheology, Fragrance, Colour                              │
│  Category             [REQ]      │  subCategory             │  ★ raw_materials.category                │
│  Sub-category                    │  optionalRmSubCategory   │  form_data only                          │
│  Sub-sub category                │  optionalRmSubSubCategory│  form_data only                          │
└──────────────────────────────────┴──────────────────────────┴──────────────────────────────────────────┘
```

#### MODULE 2: UNITS & TAXES

```
┌──────────────────────────────────┬──────────────────────────┬──────────────────────────────────────────┐
│  UI LABEL                        │  form_data KEY           │  ALSO IN COLUMN                          │
├──────────────────────────────────┼──────────────────────────┼──────────────────────────────────────────┤
│  Primary UOM          [REQ]      │  primaryUom              │  ★ raw_materials.uom                     │
│    Options: KG, GM, L, ML        │                          │                                          │
│  HSN / SAC            [REQ]      │  hsnCode                 │  ★ raw_materials.hsn_code                │
│  GST Rate %           [REQ]      │  gst                     │  ★ raw_materials.gst (DECIMAL 5,2)       │
│    Options: 0, 5, 12, 18, 28     │                          │                                          │
│  Returnable Item                 │  rmReturnable            │  form_data only (Yes/No)                 │
│  Tax Preference                  │  rmTaxPreference         │  ★ raw_materials.tax_pref                │
└──────────────────────────────────┴──────────────────────────┴──────────────────────────────────────────┘
```

#### MODULE 3: REGULATORY

```
┌─────────────────────────────────────┬──────────────────────────────────┬──────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  CONDITION               │
├─────────────────────────────────────┼──────────────────────────────────┼──────────────────────────┤
│  Grade                   [REQ]      │  grade                           │  always                  │
│    Options: Cosmetic,IP,BP,USP,     │                                  │                          │
│             EP,FCC,Pharma           │                                  │                          │
│  Compliance / Certificate           │  compliance                      │  always                  │
│  BIS Compliance                     │  bisCompliance                   │  always                  │
│    Options: Leave on, Rinse off     │                                  │                          │
│  Regulatory Max Use Level %         │  regMaxUseLevelPct               │  if sub=PRESERVATIVES    │
│                                     │                                  │  or UV FILTERS           │
│  Allergen Declaration (EU 26)       │  regAllergenDeclarationEu26      │  if cat=FRAGRANCES       │
│  IFRA Category & Limit              │  regIfraCategoryLimit            │  if cat=FRAGRANCES       │
│  CI Number                          │  regCiNumber                     │  if cat=COLOURS          │
│  Approved Area                      │  regApprovedArea                 │  if cat=COLOURS          │
│  Animal Origin                      │  animalOrigin                    │  always (Yes/No)         │
└─────────────────────────────────────┴──────────────────────────────────┴──────────────────────────┘
```

#### MODULE 4: TECHNICAL

```
┌─────────────────────────────────────┬──────────────────────────────────┬───────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN               │
├─────────────────────────────────────┼──────────────────────────────────┼───────────────────────────────┤
│  State                   [REQ]      │  rmState                         │  ★ raw_materials.rm_type      │
│    Options: Solid,Liquid,Semi-solid │                                  │                               │
│  Appearance              [REQ]      │  appearance                      │  form_data only               │
│  Odour                              │  odour                           │  form_data only               │
│  Active Content / Purity %          │  activeContentPurityPct          │  form_data only               │
│  Solubility                         │  solubility                      │  form_data only               │
│  Viscosity (cP)                     │  viscosityP                      │  form_data only               │
│  Melting Point (°C)                 │  meltingPointC                   │  form_data only               │
│  Boiling Point (°C)                 │  boilingPointC                   │  form_data only               │
│  Flash Point (°C)                   │  flashPointC                     │  form_data only               │
│  Specific Gravity         [REQ]     │  specificGravity                 │  ★ raw_materials              │
│                                     │                                  │    .specific_gravity          │
│  Refractive Index                   │  refractiveIndex                 │  form_data only               │
│  Charge Type                        │  chargeType                      │  form_data only               │
│    Options: Anionic,Cationic,       │                                  │                               │
│             Non-ionic,Amphoteric    │                                  │                               │
│  Active Matter %                    │  activeMatterPct                 │  form_data only               │
│  HLB Value                          │  hlbValue                        │  form_data only               │
│  Residual Solvents (ppm)            │  residualSolventsPpm             │  form_data only               │
│  Pathogen                           │  pathogen                        │  form_data only               │
│  Moisture Content %                 │  moistureContentPct              │  form_data only               │
│  Dose / Use Level                   │  doseUseLevel                    │  form_data only               │
│  pH                                 │  ph                              │  form_data only               │
│  % VOC                              │  vocPct                          │  form_data only               │
│  Optical / Spectroscopy             │  opticalSpectroscopy             │  form_data only               │
│  Colour Impart to Formulation       │  colourImpartToFormulation       │  form_data only               │
│  MSDS / SDS Notes & Link  [REQ]     │  msdsSdsNotesLink                │  form_data only               │
│  Storage Condition        [REQ]     │  storageCondition                │  form_data only               │
│    Options: Ambient, Cool & Dry,    │                                  │                               │
│    Refrigerated 2-8°C, Flammable   │                                  │                               │
│  Dispensing Direction               │  dispensingDirection             │  form_data only               │
└─────────────────────────────────────┴──────────────────────────────────┴───────────────────────────────┘
```

#### MODULE 5: QUALITY

```
┌─────────────────────────────────────┬──────────────────────────────────┬────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  CONDITION                 │
├─────────────────────────────────────┼──────────────────────────────────┼────────────────────────────┤
│  Physical Form — Solid              │  physicalFormSolid               │  if rmState = Solid        │
│    Options: Pellets,Crystals,       │                                  │                            │
│    Powders,Flakes,Waxes,Butters     │                                  │                            │
│  Physical Form — Liquid             │  physicalFormLiquid              │  if rmState = Liquid       │
│    Options: Transparent,            │                                  │                            │
│    Translucent,Opaque               │                                  │                            │
│  QC Inspection Group                │  qcInspectionGroup               │  always                    │
│  Quality Specs Table (dynamic)      │  form_data.qualitySpecs[]        │  array of spec rows        │
│    Each row: { parameter, method,   │                                  │                            │
│    unit, limit, result }            │                                  │                            │
│  quality_specs_locked               │  raw_materials                   │  BOOLEAN column (not JSON) │
│                                     │  .quality_specs_locked           │                            │
└─────────────────────────────────────┴──────────────────────────────────┴────────────────────────────┘
```

#### MODULE 6: SOURCING & COST

```
┌─────────────────────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN                    │
├─────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│  Preferred Vendor         [REQ]     │  preferredVendorClientId         │  form_data only                    │
│  Alternate Vendors                  │  alternateVendorClientId         │  form_data only                    │
│  Country of Origin                  │  sourcingCountryOfOrigin         │  form_data only                    │
│  MOQ                                │  sourcingMoq                     │  form_data only                    │
│  Lead Time (days)                   │  sourcingLeadTimeDays            │  ★ raw_materials.lead_time_days    │
│  Standard Cost / UOM                │  sourcingStandardUom             │  ★ raw_materials.price_per_kg      │
│  Currency                           │  sourcingCurrency                │  form_data only                    │
│    Options: INR, USD, EUR           │                                  │                                    │
│  Vendor tiers (dynamic array)       │  form_data.vendors[]             │  array of RmCommercialVendor objs  │
│    Each tier: { vendorClientId,     │                                  │                                    │
│    tier, moq, leadTimeDays,         │                                  │                                    │
│    pricePerUom, currency }          │                                  │                                    │
└─────────────────────────────────────┴──────────────────────────────────┴────────────────────────────────────┘
```

#### HIDDEN MODULES (schema only, not in stepper UI)

```
┌─────────────────────────────────────┬──────────────────────────────────┬────────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN                    │
├─────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│  MODULE: INVENTORY                  │                                  │                                    │
│  Shelf Life (months)      [REQ]     │  shelfLife                       │  ★ raw_materials.shelf             │
│  Re-test Period (months)            │  retestPeriod                    │  form_data only                    │
│  Reorder Level                      │  reorderLevel                    │  form_data only                    │
│  Dispensing Batch No                │  dispensingBatchNo               │  form_data only                    │
├─────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│  MODULE: LIFECYCLE                  │                                  │                                    │
│  Lifecycle Status         [REQ]     │  masterLifecycleStatus           │  ★ raw_materials                   │
│    Options: Active, Preferred,      │                                  │    .master_lifecycle_status        │
│    Conditional, Phase-out,          │                                  │                                    │
│    Discontinued                     │                                  │                                    │
│  Owner                              │  rmOwner                         │  ★ raw_materials.rm_owner          │
├─────────────────────────────────────┼──────────────────────────────────┼────────────────────────────────────┤
│  MODULE: SIMILAR                    │                                  │                                    │
│  Universal-swap eligibility         │  universalSwapEligibility        │  ★ raw_materials                   │
│    Options: Yes, No                 │                                  │    .universal_swap_eligibility     │
│  Functional equivalents             │  functionalEquivalents           │  ★ raw_materials                   │
│                                     │                                  │    .functional_equivalents         │
└─────────────────────────────────────┴──────────────────────────────────┴────────────────────────────────────┘
```

#### Sub-documents inside form_data (arrays)

```
┌────────────────────────────┬─────────────────────────────────────────────────────────┐
│  ARRAY KEY                 │  SHAPE (each element)                                   │
├────────────────────────────┼─────────────────────────────────────────────────────────┤
│  form_data.vendors[]       │  { vendorClientId, tier, moq, leadTimeDays,             │
│                            │    pricePerUom, currency, notes }                       │
│  form_data.documents[]     │  { id, type, link, date }                               │
│  form_data.tests[]         │  { id, name, result, date, approvedBy, remarks }        │
│  form_data.qualitySpecs[]  │  { parameter, method, unit, limit, result }             │
└────────────────────────────┴─────────────────────────────────────────────────────────┘
```

#### Full raw_materials Table Schema (all columns)

```
raw_materials
├── id                           INTEGER  PK autoIncrement
├── code                         STRING(100)  NOT NULL          ← form: rmSku
├── name                         STRING(255)                    ← form: tradeCommercialName
├── inci                         STRING(255)                    ← form: inciName
├── category                     STRING(100)                    ← form: subCategory
├── rm_type                      STRING(50)                     ← form: rmState
├── uom                          STRING(20)                     ← form: primaryUom
├── price_per_kg                 DECIMAL(12,2)                  ← vendor commercial
├── gst                          DECIMAL(5,2)                   ← form: gst
├── shelf                        STRING(20)                     ← form: shelfLife
├── specific_gravity             DECIMAL(5,3)                   ← form: specificGravity
├── lead_time_days               INTEGER                        ← vendor commercial
├── status                       STRING(50)                     ← approval status
├── approval_assigned_user_id    INTEGER                        ← approval workflow
├── approval_assigned_display_name STRING(255)                  ← approval workflow
├── approval_stage_assignees     JSON                           ← { stage: userId }
├── products                     JSON                           ← ['PR-001','PR-002',…]
├── group                        STRING(100)
├── zoho_id                      STRING(100)
├── zoho_sku_code                STRING(100)  UNIQUE (where NOT NULL)
├── hsn_code                     STRING(50)                     ← form: hsnCode
├── tax_pref                     STRING(50)                     ← form: rmTaxPreference
├── sales_purchase_account       STRING(255)
├── form_data                    JSON          ← FULL form payload
├── created_at                   DATE
├── updated_at                   DATE
├── deleted_at                   DATE          ← soft delete
├── lifecycle_status             STRING(255)   DEFAULT 'active' ← archive flag (not business)
├── master_lifecycle_status      STRING(50)                     ← form: masterLifecycleStatus
├── rm_owner                     STRING(255)                    ← form: rmOwner
├── universal_swap_eligibility   STRING(10)                     ← form: universalSwapEligibility
├── functional_equivalents       TEXT                           ← form: functionalEquivalents
└── quality_specs_locked         BOOLEAN       DEFAULT false
```

---

## 2. PACK MATERIALS MASTER

**DB Table:** `pack_materials`  
**Frontend Route:** `/packaging`  
**Component:** `src/pages/PackagingForm.tsx`  
**API:** `GET /api/v1/pack-materials`  
**Schema file:** `src/constants/pmMasterFieldSchema.ts`

---

### 2A — Dashboard List View Columns

```
┌─────────────────┬──────────────────────────────────┬─────────────────────────────────────────┐
│  COLUMN LABEL   │  DB TABLE . COLUMN               │  NOTES                                  │
├─────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
│  Code           │  pack_materials.code             │  STRING(100)                            │
│  PM Name        │  pack_materials.description      │  STRING(500), trade/commercial name     │
│  Category       │  pack_materials.type             │  PM category (PPM/SPM/TPM)              │
│  Sub-category   │  pack_materials.group            │  STRING(100)                            │
│  UOM            │  pack_materials.unit             │  STRING(20)                             │
│  Status         │  pack_materials.lifecycle_status │  Approval status                        │
│  Assign         │  pack_materials                  │  .approval_assigned_display_name        │
│                 │  pack_materials                  │  .approval_assigned_user_id (FK→users)  │
│  Products       │  pack_materials.products         │  JSON array of PR codes — shows count   │
│  Logs           │  master_approval_status_history  │  WHERE master_kind='PM'                 │
│                 │                                  │  AND master_id = pack_materials.id      │
│  Actions        │  (UI only)                       │  Edit / Delete buttons                  │
└─────────────────┴──────────────────────────────────┴─────────────────────────────────────────┘
```

---

### 2B — Form Fields by Module

> All fields stored in `pack_materials.form_data` (JSON) unless marked ★ (promoted to column).

#### MODULE 1: PRIMARY INFO

```
┌─────────────────────────────────────┬──────────────────────────────────┬───────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN                   │
├─────────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
│  Material Code (SKU)                │  itemCode                        │  ★ pack_materials.code            │
│  PM Name / Description    [REQ]     │  tradeCommercialName             │  ★ pack_materials.description     │
│  Assembly / Component-set Code      │  pmAssemblyCode                  │  cond: cat=PPM Primary            │
│  Component breakdown                │  pmComponentBreakdown            │  cond: cat=PPM Primary            │
│  SKU Volume (ml/g)                  │  pmSkuVolume                     │  cond: cat=PPM Primary            │
│  Intended Use             [REQ]     │  intendedUse                     │  form_data only                   │
│  Reusability                        │  reusability                     │  form_data only                   │
│    Options: Single-use,Reusable,    │                                  │                                   │
│             Refillable              │                                  │                                   │
│  Status (Lifecycle)       [REQ]     │  pmLifecycleStatus               │  ★ pack_materials.lifecycle_status│
│    Options: Active,Inactive,        │                                  │                                   │
│    Discontinued,Phase-out           │                                  │                                   │
└─────────────────────────────────────┴──────────────────────────────────┴───────────────────────────────────┘
```

#### MODULE 2: UNITS & TAXES

```
┌─────────────────────────────────────┬──────────────────────────────────┬───────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN                   │
├─────────────────────────────────────┼──────────────────────────────────┼───────────────────────────────────┤
│  Primary UOM              [REQ]     │  pkgUnit                         │  ★ pack_materials.unit            │
│    Options: NOS,PCS,ROLL,KG,MTR,SQM│                                  │                                   │
│  Units per Shipper / Roll           │  pkgUnitsPerShipperRoll          │  form_data only                   │
│  HSN / SAC                [REQ]     │  pkgHsn                          │  ★ pack_materials.hsn_code        │
│  GST Rate %               [REQ]     │  pkgGst                          │  form_data only (no gst column)   │
│    Options: 0,5,12,18,28            │                                  │                                   │
└─────────────────────────────────────┴──────────────────────────────────┴───────────────────────────────────┘
```

#### MODULE 3: DIMENSIONS (sub-category conditional — summary)

> All dimension fields are stored in `pack_materials.form_data` only. Fields shown/hidden based on PM category and sub-category.

```
┌──────────────────────────────────────┬─────────────────────────────┬──────────────────────────────────────┐
│  UI LABEL                            │  form_data KEY              │  SHOWN FOR                           │
├──────────────────────────────────────┼─────────────────────────────┼──────────────────────────────────────┤
│  Nominal Volume (ml)       [REQ]     │  specNominal                │  BOTTLES, JARS, TUBES, STICKS,       │
│                                      │                             │  SACHETS                             │
│  Brimful Capacity (ml)               │  specBrimful                │  BOTTLES, JARS                       │
│  Overflow Capacity OFC (ml)          │  overflowCapacityOfcMl      │  BOTTLES, STICKS                     │
│  Total / Overall Height (mm) [REQ]   │  pmOverallHeightMm          │  BOTTLES, JARS, TUBES, STICKS,       │
│                                      │                             │  PUMPS, DROPPERS, CAPS, LIDS         │
│  Body / Shoulder Height (mm)         │  pmShoulderHeightMm         │  BOTTLES, JARS                       │
│  Outer Body Diameter (mm)  [REQ]     │  pmOuterDiameterMm          │  BOTTLES, JARS, TUBES, STICKS,       │
│                                      │                             │  CAPS, LIDS, PUMPS, DROPPERS         │
│  Inner / Neck Diameter (mm)          │  pmInnerDiameterNeckMm      │  BOTTLES, JARS, TUBES, PUMPS,        │
│                                      │                             │  DROPPERS, CAPS, LIDS                │
│  Body Circumference (mm)             │  pmCircumferenceMm          │  BOTTLES, JARS, STICKS               │
│  Neck Finish Standard      [REQ]     │  neckFinishStandard         │  BOTTLES, JARS, PUMPS, DROPPERS,     │
│    Options: 18/410…custom            │                             │  CAPS, LIDS                          │
│  Neck Height H (mm)                  │  neckHeightHMmTEHSpec       │  BOTTLES, JARS, CAPS, LIDS           │
│  Thread Major Dia T (mm)             │  threadMajorDiaTMm          │  BOTTLES, JARS, CAPS, LIDS           │
│  Inside Bore Dia I (mm)              │  insideBoreDiaIMm           │  BOTTLES, JARS, CAPS, LIDS           │
│  Empty / Component Weight (g)        │  specWeight                 │  BOTTLES, JARS, TUBES, STICKS,       │
│                                      │                             │  CAPS, LIDS                          │
│  Wall Thickness — Sidewall (mm)      │  wallThicknessSidewallMm    │  BOTTLES, JARS, TUBES                │
│  Wall Thickness — Base (mm)          │  wallThicknessBaseMm        │  BOTTLES, JARS                       │
│  Base Type                           │  baseType                   │  BOTTLES only                        │
│  Headspace at fill (mm/ml)           │  headspaceAtFillMmMl        │  BOTTLES, JARS                       │
│  Tube Length (mm)          [REQ]     │  tubeLengthMm               │  TUBES only                          │
│  Orifice Diameter (mm)     [REQ]     │  pmOrificeMm                │  TUBES, DROPPERS, PUMPS              │
│  Shoulder Style                      │  shoulderStyle              │  TUBES only                          │
│  Crimp / End Width (mm)              │  crimpEndWidthMm            │  TUBES only                          │
│  Closure Type                        │  pmClosureType              │  CAPS, LIDS, TUBES                   │
│  Pump Output per Stroke (ml)         │  pmPumpCcDosage             │  PUMPS, DROPPERS                     │
│  Priming Strokes (count)             │  primingStrokesCount        │  PUMPS only                          │
│  Dip Tube Length (mm)                │  dipTubeLengthMm            │  PUMPS only                          │
│  Spring Material                     │  springMaterial             │  PUMPS only                          │
│  Pipette Length (mm)       [REQ]     │  pmPipetteLengthMm          │  DROPPERS only                       │
│  Pipette Tip Diameter (mm)           │  pipetteTipDiameterMm       │  DROPPERS only                       │
│  Teat Material                       │  teatMaterial               │  DROPPERS only                       │
│  Ball Material                       │  ballMaterial               │  subsub=Roll-on                      │
│  Ball Diameter (mm)                  │  ballDiameterMm             │  subsub=Roll-on                      │
│  Push-up Mechanism                   │  pushUpMechanism            │  subsub=Stick                        │
│  Filling Height (mm)                 │  fillingHeightMm            │  STICKS only                         │
│  Sachet Width/Height (mm)            │  sachetWidthMm/sachetHeightMm│  SACHETS only                       │
│  Fill Volume (ml/g)                  │  pmFillVolumeMl             │  SACHETS only                        │
│  Tear Notch                          │  tearNotch                  │  SACHETS only                        │
│  Label Width/Height (mm)   [REQ]     │  labelWidthMm/labelHeightMm │  cat=Labels                          │
│  Sheet/Roll Format                   │  sheetRollFormat            │  cat=Labels                          │
│  Carton L×W×H (mm)        [REQ]     │  pmCartonLengthMm etc.      │  cat=Monocartons                     │
│  Shipper L×W×H (mm)       [REQ]     │  shipperLengthWidthHeightMm │  sub=SHIPPERS                        │
│  Units per Shipper         [REQ]     │  unitsPerShipper            │  sub=SHIPPERS                        │
│  Pallet Size (mm)          [REQ]     │  palletSizeMm               │  sub=PALLETS                         │
└──────────────────────────────────────┴─────────────────────────────┴──────────────────────────────────────┘
```

#### MODULE 4: MATERIAL SPECIFICATIONS

```
┌─────────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  CONDITION                       │
├─────────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
│  Material                 [REQ]     │  matBody                         │  ★ pack_materials.material       │
│  Material Grade / Standard          │  materialGradeStandard           │  always                          │
│  Polymer Type                       │  polymerType                     │  cat=PPM Primary                 │
│    Options: PET,rPET,HDPE,LDPE,     │                                  │                                  │
│    LLDPE,PP,PVC,PETG,ABS,PMMA,      │                                  │                                  │
│    SAN,PS,Bio-PE,Bio-PET,NA         │                                  │                                  │
│  Resin Source                       │  resinSource                     │  cat=PPM Primary                 │
│  PCR % Content                      │  pcrContent                      │  cat=PPM Primary                 │
│  Density (g/cm³)                    │  densityGCm                      │  cat=PPM Primary                 │
│  MFI / MFR (g/10min)                │  mfiMfrG10min                    │  cat=PPM Primary                 │
│  Shore Hardness                     │  shoreHardness                   │  cat=PPM Primary                 │
│  Glass Type                         │  glassType                       │  subsub=Glass                    │
│  Board Type               [REQ]     │  pmBoardPaperType                │  cat=Monocartons                 │
│  Board GSM                [REQ]     │  pmGsm                           │  cat=Monocartons                 │
│  Substrate                          │  substrate                       │  cat=Labels                      │
│  Substrate GSM                      │  substrateGsm                    │  Labels/Monocartons              │
│  Adhesive Type                      │  adhesiveType                    │  cat=Labels                      │
│  Sachet Laminate Structure          │  sachetLaminateStructure         │  sub=SACHETS                     │
│  Flute Type                         │  fluteType                       │  sub=SHIPPERS                    │
│  Plies (3/5/7-ply)                  │  plies3Ply5Ply7Ply               │  sub=SHIPPERS                    │
│  Storage Condition        [REQ]     │  storeLoc                        │  always                          │
│  Recyclability Code                 │  regRecyclabilityCode            │  always                          │
│  Food / Cosmetic-contact Safe       │  regFoodCosmeticCompliance       │  always                          │
└─────────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
```

#### MODULE 5: AESTHETICS

```
┌─────────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  CONDITION                       │
├─────────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
│  Body / Component Colour            │  colorType                       │  always                          │
│  Colour Code (Pantone / RAL)        │  colorCode                       │  always                          │
│  Transparency Level                 │  transparencyLevel               │  cat=PPM Primary                 │
│  Surface Finish                     │  finish                          │  always                          │
│  Surface Texture                    │  surfaceTexture                  │  always                          │
│  Decoration Method                  │  decorationMethod                │  always                          │
│  Number of Print Colours            │  numberOfColours                 │  always                          │
│  Print Colours (CMYK/Pantone)       │  printColours                    │  always                          │
│  Foil Colour                        │  foilColour                      │  always                          │
│  Spot UV / Special Effects          │  spotUvSpecialEffects            │  always                          │
│  Embossing / Debossing Areas        │  embossingDebossing              │  always                          │
│  Lamination                         │  pmLamination                    │  Labels/Monocartons              │
│  Metallised Effect                  │  metallisedEffect                │  always                          │
│  Premium Look & Feel                │  premiumLookFeel                 │  always                          │
│  Artwork Reference / AW Version     │  artworkReferenceAwVersion       │  always                          │
│  Reference Image / Mockup           │  images                          │  always                          │
│  Coding Template                    │  codingTemplateBatchMfgExpMrp    │  PPM Primary/Labels/Monocartons  │
└─────────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
```

#### MODULE 6: GRN QUALITY CHECKS

```
┌─────────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  NOTES                           │
├─────────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
│  Quality Specs Table (dynamic)      │  form_data.qualitySpecs[]        │  array of spec rows              │
│  QC Inspection Group                │  qcInspectionGroup               │  always                          │
│  quality_specs_locked               │  pack_materials                  │  BOOLEAN column (not JSON)       │
│                                     │  .quality_specs_locked           │                                  │
└─────────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
```

#### MODULE 7: VENDORS & COMMERCIALS

```
┌─────────────────────────────────────┬──────────────────────────────────┬──────────────────────────────────┐
│  UI LABEL                           │  form_data KEY                   │  ALSO IN COLUMN                  │
├─────────────────────────────────────┼──────────────────────────────────┼──────────────────────────────────┤
│  Preferred Vendor                   │  preferredVendorClientId         │  form_data only                  │
│  Alternate Vendor                   │  alternateVendorClientId         │  form_data only                  │
│  MOQ                                │  (vendor tier)                   │  ★ pack_materials.moq            │
│  Lead Time (days)                   │  (vendor tier)                   │  ★ pack_materials.lead_time_days │
│  Price per PC                       │  (vendor tier)                   │  ★ pack_materials.price_per_pc   │
│  Print Status                       │  printStatus                     │  ★ pack_materials.print_status   │
│  Vendor tiers (dynamic array)       │  form_data.vendors[]             │  PmCommercialVendor objects      │
└─────────────────────────────────────┴──────────────────────────────────┴──────────────────────────────────┘
```

#### Full pack_materials Table Schema

```
pack_materials
├── id                           INTEGER  PK autoIncrement
├── code                         STRING(100)  NOT NULL          ← form: itemCode
├── description                  STRING(500)                    ← form: tradeCommercialName
├── type                         STRING(100)                    ← PM category (PPM/SPM/TPM)
├── level                        STRING(50)                     ← PM level classification
├── group                        STRING(100)                    ← PM sub-category
├── material                     STRING(255)                    ← form: matBody
├── size_spec                    STRING(255)                    ← form: specNominal
├── price_per_pc                 DECIMAL(12,2)                  ← vendor commercial
├── moq                          INTEGER                        ← vendor commercial
├── lead_time_days               INTEGER                        ← vendor commercial
├── print_status                 STRING(100)                    ← form: printStatus
├── approval_assigned_user_id    INTEGER
├── approval_assigned_display_name STRING(255)
├── approval_stage_assignees     JSON
├── products                     JSON                           ← ['PR-001',…]
├── zoho_id                      STRING(100)
├── zoho_sku_code                STRING(100)  UNIQUE (where NOT NULL)
├── hsn_code                     STRING(50)                     ← form: pkgHsn
├── unit                         STRING(20)                     ← form: pkgUnit
├── tax_pref                     STRING(50)
├── pkg_returnable               BOOLEAN
├── pkg_associate_items          TEXT
├── sales_purchase_account       STRING(255)
├── form_data                    JSON          ← FULL form payload
├── created_at                   DATE
├── updated_at                   DATE
├── deleted_at                   DATE          ← soft delete
├── lifecycle_status             STRING(255)   DEFAULT 'active'
└── quality_specs_locked         BOOLEAN       DEFAULT false
```

---

## 3. PRODUCTS MASTER (PR — Product Registration)

**DB Table:** `products`  
**Frontend Routes:** Managed via `src/services/productsMaster.service.ts`  
**API:** `GET /api/v1/products`, `GET /api/v1/products/:id/detail`  
**Component:** used in `src/pages/Production.tsx` + PR detail views

---

### 3A — Dashboard List View Columns

```
┌─────────────────────┬────────────────────────────────────┬────────────────────────────────────────┐
│  COLUMN LABEL       │  DB TABLE . COLUMN                 │  NOTES                                 │
├─────────────────────┼────────────────────────────────────┼────────────────────────────────────────┤
│  Product Code       │  products.product_code             │  PR-XXXXX or TPR-XXXXX                 │
│  Product Name       │  products.product_name             │  Internal name                         │
│  Commercial Name    │  products.commercial_name          │  Customer-facing label                 │
│  Brand Name         │  products.brand_name               │                                        │
│  Category           │  products.category                 │                                        │
│  Status             │  products.status                   │  Approval status                       │
│  Assign             │  products                          │  .approval_assigned_display_name       │
│  Products Count     │  (computed from linked BOMs)       │                                        │
│  Logs               │  master_approval_status_history    │  WHERE master_kind='PR'                │
│                     │                                    │  AND master_id = products.product_id   │
│  Actions            │  (UI only)                         │                                        │
└─────────────────────┴────────────────────────────────────┴────────────────────────────────────────┘
```

---

### 3B — Form Fields (all dedicated columns — PR uses fewer form_data JSON fields)

```
┌─────────────────────────────────────┬────────────────────────────────────────┐
│  UI LABEL                           │  products TABLE COLUMN                 │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  IDENTITY                           │                                        │
│  Product Code                       │  product_code  STRING                  │
│  Zoho SKU Code                      │  zoho_sku_code  STRING  UNIQUE         │
│  Product Name                       │  product_name  STRING                  │
│  Commercial Name                    │  commercial_name  STRING               │
│  Generic Name                       │  generic_name  STRING                  │
│  Brand Name                         │  brand_name  STRING                    │
│  Category                           │  category  STRING                      │
│  Status / Lifecycle                 │  lifecycle_status  STRING              │
│  PR Record Type                     │  pr_record_type  STRING(20)            │
│    'temporary' or 'permanent'       │                                        │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  PRICING                            │                                        │
│  MRP Price                          │  mrp_price  DECIMAL(10,2)             │
│  Buy Price                          │  buy_price  DECIMAL(10,2)             │
│  Tax Rate                           │  tax_rate  DECIMAL(5,2)               │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  PRODUCT REGISTRATION SPEC          │                                        │
│  Form (dosage form)                 │  form  STRING(100)                     │
│  Fill Size                          │  fill_size  STRING(50)                 │
│  Batch Size (kg)                    │  batch_size_kg  INTEGER                │
│  Lead Time (days)                   │  lead_time_days  INTEGER               │
│  Shelf Life (months)                │  shelf_life_months  INTEGER            │
│  Version                            │  version  STRING(50)                   │
│  License / CML                      │  license_cml  STRING(100)              │
│  Theoretical Yield %                │  theoretical_yield_pct  DECIMAL(5,2)  │
│  PAO (months)                       │  pao_months  INTEGER                   │
│  Manufacturing Location             │  manufacturing_location  STRING(255)   │
│  Equipment / Vessel                 │  equipment_vessel  STRING(255)         │
│  Storage Conditions                 │  storage_conditions  TEXT              │
│  Approved Claims                    │  approved_claims  TEXT                 │
│  pH Range                           │  ph_range  STRING(50)                  │
│  Viscosity Range                    │  viscosity_range  STRING(100)          │
│  SPF / PA Rating                    │  spf_pa_rating  STRING(50)             │
│  Appearance                         │  appearance  STRING(255)               │
│  Odour                              │  odour  STRING(255)                    │
│  Fill Weight Spec                   │  fill_weight_spec  STRING(100)         │
│  Stability Summary                  │  stability_summary  TEXT               │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  DESCRIPTIONS (consumer-facing)     │                                        │
│  Product Description                │  product_description  TEXT             │
│  Ingredients                        │  incredients  TEXT  (sic — as coded)  │
│  How to Use                         │  how_to_use  TEXT                      │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  APPROVAL                           │                                        │
│  Approval Assigned User ID          │  approval_assigned_user_id  INTEGER    │
│  Approval Assigned Display Name     │  approval_assigned_display_name STRING │
│  Approval Stage Assignees           │  approval_stage_assignees  JSON        │
│  Approval Team Pending              │  approval_team_pending  JSON           │
│  Availability                       │  availability  STRING                  │
│  Form Data (BOM linkages etc.)      │  form_data  JSON                       │
├─────────────────────────────────────┼────────────────────────────────────────┤
│  ZOHO SYNC                          │                                        │
│  Zoho Item ID                       │  zoho_item_id  STRING(64)              │
│  Zoho SKU Code                      │  zoho_sku_code  STRING                 │
└─────────────────────────────────────┴────────────────────────────────────────┘
```

#### Sub-documents via linked tables / BOM

```
┌─────────────────────────┬──────────────────────────────────────────────────────────────────┐
│  DATA SET               │  SOURCE                                                          │
├─────────────────────────┼──────────────────────────────────────────────────────────────────┤
│  Formula BOM            │  boms table: rm_lines JSON (phase → RM line items)               │
│  SKU BOM (per SKU qty)  │  boms table: sku_rm_lines JSON                                   │
│  Pack BOM               │  boms table: pm_lines JSON (packaging line items)                │
│  Process Steps          │  boms table: process_steps JSON                                  │
│  Open Sales Orders      │  derived from sales_orders table (not master)                    │
└─────────────────────────┴──────────────────────────────────────────────────────────────────┘
```

#### Full products Table Schema

```
products
├── product_id                   INTEGER  PK autoIncrement
├── product_code                 STRING
├── zoho_sku_code                STRING  UNIQUE (where NOT NULL)
├── zoho_item_id                 STRING(64)
├── product_name                 STRING
├── commercial_name              STRING
├── generic_name                 STRING
├── brand_name                   STRING
├── category                     STRING
├── status                       STRING
├── availability                 STRING
├── lifecycle_status             STRING
├── pr_record_type               STRING(20)   'temporary' | 'permanent'
│
├── mrp_price                    DECIMAL(10,2)
├── buy_price                    DECIMAL(10,2)
├── tax_rate                     DECIMAL(5,2)
│
├── form                         STRING(100)
├── fill_size                    STRING(50)
├── batch_size_kg                INTEGER
├── lead_time_days               INTEGER
├── shelf_life_months            INTEGER
├── version                      STRING(50)
├── license_cml                  STRING(100)
├── theoretical_yield_pct        DECIMAL(5,2)
├── pao_months                   INTEGER
├── manufacturing_location       STRING(255)
├── equipment_vessel             STRING(255)
├── storage_conditions           TEXT
├── approved_claims              TEXT
├── ph_range                     STRING(50)
├── viscosity_range              STRING(100)
├── spf_pa_rating                STRING(50)
├── appearance                   STRING(255)
├── odour                        STRING(255)
├── fill_weight_spec             STRING(100)
├── stability_summary            TEXT
│
├── product_description          TEXT
├── incredients                  TEXT         ← typo in codebase, kept as-is
├── how_to_use                   TEXT
│
├── approval_assigned_user_id    INTEGER
├── approval_assigned_display_name STRING(255)
├── approval_stage_assignees     JSON
├── approval_team_pending        JSON
├── form_data                    JSON
│
├── created_at                   DATE
├── updated_at                   DATE
└── deleted_at                   DATE
```

---

## 4. ITEMS MASTER

**DB Table:** `items_master`  
**API:** `GET /api/v1/items-master`  
**Service:** `src/services/itemsMaster.service.ts`

### Dashboard Columns → DB Mapping

```
┌─────────────────────┬──────────────────────────────────┬──────────────────────────────────────┐
│  COLUMN LABEL       │  DB TABLE . COLUMN               │  NOTES                               │
├─────────────────────┼──────────────────────────────────┼──────────────────────────────────────┤
│  Code               │  items_master.code               │  STRING(100) NOT NULL                │
│  Name               │  items_master.name               │  STRING(300)                         │
│  Type               │  items_master.type               │  STRING(50): product/bom/packaging/  │
│                     │                                  │  raw-material                        │
│  Status             │  items_master.status             │  STRING(50)                          │
│  BOMs               │  items_master.bom_ids            │  JSON array of BOM IDs               │
│  Raw Materials      │  items_master.raw_material_ids   │  JSON array of RM IDs                │
│  Pack Materials     │  items_master.pack_material_ids  │  JSON array of PM IDs                │
│  (Linked BOMs)      │  boms table                      │  WHERE id IN bom_ids                 │
│  (Linked RMs)       │  raw_materials table             │  WHERE id IN raw_material_ids        │
│  (Linked PMs)       │  pack_materials table            │  WHERE id IN pack_material_ids       │
│  Actions            │  (UI only)                       │                                      │
└─────────────────────┴──────────────────────────────────┴──────────────────────────────────────┘
```

#### Full items_master Table Schema

```
items_master
├── id                   INTEGER  PK autoIncrement
├── code                 STRING(100)  NOT NULL
├── name                 STRING(300)
├── type                 STRING(50)    'product'|'bom'|'packaging'|'raw-material'
├── status               STRING(50)
├── bom_ids              JSON          [1, 2, 3]
├── raw_material_ids     JSON          [10, 11]
├── pack_material_ids    JSON          [20, 21]
├── created_at           DATE
├── updated_at           DATE
├── deleted_at           DATE
└── lifecycle_status     STRING(255)   DEFAULT 'active'
```

---

## 5. VENDOR / CLIENT MASTER

**DB Table:** `vendor_clients`  
**API:** `GET /api/v1/vendor-clients` (inferred from vendorClient/routers.js)

### Dashboard Columns → DB Mapping

```
┌──────────────────────────┬──────────────────────────────────┬─────────────────────────────────────────┐
│  COLUMN LABEL            │  DB TABLE . COLUMN               │  NOTES                                  │
├──────────────────────────┼──────────────────────────────────┼─────────────────────────────────────────┤
│  Entity Code             │  vendor_clients.entity_code      │  STRING(64) UNIQUE: EI-VEN-00001        │
│  Type                    │  vendor_clients.type             │  STRING(20): 'vendor' or 'client'       │
│  Name                    │  vendor_clients.name             │  STRING(300)                            │
│  Category                │  vendor_clients.category         │  STRING(100)                            │
│  Status                  │  vendor_clients.status           │  'active'|'inactive'|'pending'          │
│  Email                   │  vendor_clients.email            │  STRING(255)                            │
│  Phone                   │  vendor_clients.phone            │  STRING(64)                             │
│  Location                │  vendor_clients.location         │  STRING(200)                            │
│  Country                 │  vendor_clients.country          │  STRING(100)                            │
│  City                    │  vendor_clients.city             │  STRING(100)                            │
│  Payment Terms           │  vendor_clients.payment_terms    │  STRING(100)                            │
│  Rating                  │  vendor_clients.rating           │  INTEGER                                │
│  MOQ                     │  vendor_clients.moq              │  STRING(100)                            │
│  Lead Time               │  vendor_clients.lead_time        │  STRING(100)                            │
│  Priority                │  vendor_clients.priority         │  STRING(20)                             │
│  Segment                 │  vendor_clients.segment          │  STRING(200)                            │
│  Since Year              │  vendor_clients.since_year       │  INTEGER                                │
│  Revenue Value           │  vendor_clients.revenue_value    │  DECIMAL(15,2)                          │
│  Account Manager         │  vendor_clients                  │  .account_manager_id (FK→users)         │
│  Notes                   │  vendor_clients.notes            │  TEXT                                   │
│  Contacts                │  vendor_clients.contacts         │  JSONB                                  │
│  Extended Data           │  vendor_clients.data             │  JSONB: { documents[], pocs[],          │
│                          │                                  │           banks[], vendorItems[],       │
│                          │                                  │           productInterests[] }          │
│  Portal User Link        │  vendor_clients.user_id          │  INTEGER UNIQUE → users.userid          │
└──────────────────────────┴──────────────────────────────────┴─────────────────────────────────────────┘
```

#### Full vendor_clients Table Schema

```
vendor_clients
├── id                   INTEGER  PK autoIncrement
├── entity_code          STRING(64)  NOT NULL  UNIQUE      e.g. EI-VEN-00001
├── type                 STRING(20)  NOT NULL              'vendor' | 'client'
├── zoho_id              STRING(100)
├── name                 STRING(300)
├── email                STRING(255)
├── phone                STRING(64)
├── location             STRING(200)
├── country              STRING(100)
├── city                 STRING(100)
├── category             STRING(100)
├── status               STRING(50)                        active|inactive|pending
├── payment_terms        STRING(100)
├── notes                TEXT
├── rating               INTEGER
├── moq                  STRING(100)
├── lead_time            STRING(100)
├── data                 JSONB     ← { documents[], pocs[], banks[], vendorItems[], productInterests[] }
├── priority             STRING(20)
├── segment              STRING(200)
├── since_year           INTEGER
├── revenue_value        DECIMAL(15,2)
├── avatar_color         STRING(50)
├── account_manager_id   INTEGER   FK → users
├── user_id              INTEGER   UNIQUE FK → users.userid (portal login link)
├── contacts             JSONB
├── created_at           DATE
├── updated_at           DATE
├── deleted_at           DATE
└── lifecycle_status     STRING(255)  DEFAULT 'active'
```

---

## 6. BOMS TABLE (linked to PR Masters)

**DB Table:** `boms`  
**Referenced by:** `items_master.bom_ids`, `products.product_id`

```
boms
├── id                       INTEGER  PK autoIncrement
├── bom_code                 STRING(100)  NOT NULL
├── bom_sku                  STRING(100)
├── zoho_id                  STRING(100)
├── bom_category             STRING(100)
├── bom_unit                 STRING(20)
├── bom_hsn                  STRING(50)
├── bom_tax_preference       STRING(50)
├── bom_returnable           BOOLEAN
├── bom_composite_item       BOOLEAN  DEFAULT true
├── type                     STRING(50)
├── status                   STRING(50)
├── version                  STRING(50)
├── client                   STRING(200)
├── name                     STRING(300)
├── dosage                   STRING(100)
├── pack_size                STRING(50)
├── site                     STRING(100)
├── category                 STRING(100)
├── batch_size_kg etc.       (production fields)
│
├── rm_lines                 JSON   ← Formula BOM: phase → RM line items with %
├── sku_rm_lines             JSON   ← RM qty per finished SKU unit
├── sku_bom_limit_qty        DECIMAL(18,6)
├── sku_bom_limit_uom        STRING(20)
├── pm_lines                 JSON   ← Pack BOM: PM line items with qty
├── process_steps            JSON   ← Manufacturing process steps
│
├── spec_bulk/spec_fg/etc.   TEXT   (QC specs)
├── ph_range                 STRING(50)
├── stability_summary        TEXT
├── pr_facility_licences     JSON   ← { ML1:…, ML2:… }
│
├── product_id               INTEGER   FK → products.product_id
├── created_at               DATE
├── updated_at               DATE
├── deleted_at               DATE
├── lifecycle_status         STRING(255)  DEFAULT 'active'
└── quality_specs_locked     BOOLEAN  DEFAULT false
```

---

## 7. MASTER APPROVAL STATUS HISTORY

**DB Table:** `master_approval_status_history`  
**API:** `GET /api/v1/{raw-materials|pack-materials|products}/:id/approval-status/history`

```
master_approval_status_history
├── id                       INTEGER  PK autoIncrement
├── master_kind              STRING(4)  NOT NULL    'RM' | 'PM' | 'PR'
├── master_id                INTEGER  NOT NULL      FK → respective master table id
├── master_code              STRING(120)            e.g. 'RM-00123'
├── from_status              STRING(64)             Previous status
├── to_status                STRING(64)  NOT NULL   New status
├── changed_by_user_id       INTEGER
├── changed_by_display_name  STRING(255)
├── source                   STRING(64)             'advance'|'revert'|'status_set'
├── note                     TEXT
└── created_at               DATE  NOT NULL  DEFAULT NOW()
```

---

## 8. APPROVAL WORKFLOW — STATUS VALUES

```
┌─────────────────────┬─────────────────────────────────────────────────────────┐
│  STATUS VALUE       │  MEANING                                                │
├─────────────────────┼─────────────────────────────────────────────────────────┤
│  Draft              │  Initial state — not yet submitted for review           │
│  Under Review       │  Submitted — being reviewed by QC/Science               │
│  Under Approval     │  Review passed — awaiting management approval           │
│  Active             │  Fully approved — usable in production                  │
│  Inactive           │  Deactivated                                            │
├─────────────────────┼─────────────────────────────────────────────────────────┤
│  STORED IN:         │                                                         │
│  RM                 │  raw_materials.status                                   │
│  PM                 │  pack_materials.lifecycle_status                        │
│  PR                 │  products.status                                        │
│  HISTORY            │  master_approval_status_history (all three)             │
└─────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 9. CROSS-MASTER FIELD OWNERSHIP SUMMARY

```
┌──────────────────────────────┬───────────────┬──────────────────────────────────────────────────┐
│  UI CONCEPT                  │  MASTER       │  DB LOCATION                                     │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Material/Item Code          │  RM           │  raw_materials.code                              │
│                              │  PM           │  pack_materials.code                             │
│                              │  PR           │  products.product_code                           │
│                              │  Items        │  items_master.code                               │
│                              │  Vendor       │  vendor_clients.entity_code                      │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Approval Status             │  RM           │  raw_materials.status                            │
│                              │  PM           │  pack_materials.lifecycle_status                 │
│                              │  PR           │  products.status                                 │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Approval Assignee           │  RM/PM/PR     │  *.approval_assigned_user_id +                   │
│                              │               │  *.approval_assigned_display_name                │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Linked Products Count       │  RM/PM        │  raw_materials.products (JSON array)             │
│                              │               │  pack_materials.products (JSON array)            │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Zoho Sync ID                │  RM/PM/PR     │  *.zoho_sku_code + *.zoho_id                    │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Full Form Payload           │  RM/PM        │  *.form_data (JSON)                              │
│                              │  PR           │  products.form_data (JSON) — used less           │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  HSN / SAC                   │  RM           │  raw_materials.hsn_code                          │
│                              │  PM           │  pack_materials.hsn_code                         │
│                              │  BOM          │  boms.bom_hsn                                    │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  GST Rate                    │  RM           │  raw_materials.gst (DECIMAL)                     │
│                              │  PM           │  pack_materials.form_data.pkgGst                 │
├──────────────────────────────┼───────────────┼──────────────────────────────────────────────────┤
│  Soft Delete                 │  ALL          │  *.deleted_at (DATE, set on delete)              │
│  Archive Flag                │  ALL          │  *.lifecycle_status DEFAULT 'active'             │
└──────────────────────────────┴───────────────┴──────────────────────────────────────────────────┘
```

---

*Generated 2026-07-09 from:*  
- *`ei-website-backend/src/rawMaterials/models.js`*  
- *`ei-website-backend/src/packMaterials/models.js`*  
- *`ei-website-backend/src/products/models.js`*  
- *`ei-website-backend/src/itemsMaster/models.js`*  
- *`ei-website-backend/src/vendorClient/models.js`*  
- *`ei-website-backend/src/lib/masterApprovalStatusHistoryModel.js`*  
- *`EI-Admin-Dashboard/src/constants/rmMasterFieldSchema.ts`*  
- *`EI-Admin-Dashboard/src/constants/pmMasterFieldSchema.ts`*  
- *`EI-Admin-Dashboard/src/pages/RawMaterialForm.tsx`*  
- *`EI-Admin-Dashboard/src/pages/PackagingForm.tsx`*
