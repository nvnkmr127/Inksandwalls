/**
 * Canonical Pricing Engine for INKs & Walls
 * Micro-Phase 05.01 / 05.03
 * Canonical Spec: INKs-and-Walls-PRD.md §6 & §8
 *
 * Pure calculation module shared between Product Detail Page preview,
 * server-side validation, cart line snapshots, and future checkout.
 */

export type DimensionUnit = "ft" | "inch" | "cm" | "mm";

export const ALLOWED_UNITS: readonly DimensionUnit[] = ["ft", "inch", "cm", "mm"] as const;

export interface DimensionConversionResult {
  widthFt: number;
  heightFt: number;
  areaSqft: number;
}

export interface PerAreaPricingInput {
  width: number;
  height: number;
  unit: DimensionUnit;
  ratePaise: number; // minor units (paise) per sqft
  wastagePct?: number | null; // e.g. 10 for 10%
  minAreaSqft?: number | null; // minimum billable area floor in sqft
  rollWidthFt?: number | null; // roll width in ft for wallpaper panel calculation
  quantity?: number;
}

export interface PerAreaPricingResult {
  width: number;
  height: number;
  unit: DimensionUnit;
  widthFt: number;
  heightFt: number;
  enteredAreaSqft: number;
  wastagePct: number;
  wastageAreaSqft: number;
  areaWithWastageSqft: number;
  minAreaSqft: number;
  isMinAreaApplied: boolean;
  billableAreaSqft: number;
  rollWidthFt: number | null;
  panelsNeeded: number | null;
  ratePaise: number;
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
}

export interface FixedPricingInput {
  basePricePaise?: number | null;
  variantPricePaise?: number | null;
  quantity?: number;
}

export interface FixedPricingResult {
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
}

export interface DimensionValidationResult {
  isValid: boolean;
  error?: string;
  sanitizedWidth?: number;
  sanitizedHeight?: number;
  sanitizedUnit?: DimensionUnit;
}

/**
 * Normalise width and height from any supported unit into feet and sqft.
 * Conversion constants:
 * - 1 ft = 12 inches
 * - 1 ft = 30.48 cm
 * - 1 ft = 304.8 mm
 */
export function convertDimensionsToSqft(
  width: number,
  height: number,
  unit: DimensionUnit
): DimensionConversionResult {
  let widthFt: number;
  let heightFt: number;

  switch (unit) {
    case "inch":
      widthFt = width / 12;
      heightFt = height / 12;
      break;
    case "cm":
      widthFt = width / 30.48;
      heightFt = height / 30.48;
      break;
    case "mm":
      widthFt = width / 304.8;
      heightFt = height / 304.8;
      break;
    case "ft":
    default:
      widthFt = width;
      heightFt = height;
      break;
  }

  const areaSqft = widthFt * heightFt;

  return {
    widthFt: Number(widthFt.toFixed(4)),
    heightFt: Number(heightFt.toFixed(4)),
    areaSqft: Number(areaSqft.toFixed(4)),
  };
}

/**
 * Validate customer-entered dimensions before computation.
 */
export function validateDimensions(
  rawWidth: unknown,
  rawHeight: unknown,
  rawUnit: unknown
): DimensionValidationResult {
  if (typeof rawUnit !== "string" || !ALLOWED_UNITS.includes(rawUnit as DimensionUnit)) {
    return {
      isValid: false,
      error: `Invalid unit. Supported units are: ${ALLOWED_UNITS.join(", ")}.`,
    };
  }
  const unit = rawUnit as DimensionUnit;

  const width = typeof rawWidth === "number" ? rawWidth : Number(rawWidth);
  const height = typeof rawHeight === "number" ? rawHeight : Number(rawHeight);

  if (isNaN(width) || isNaN(height)) {
    return {
      isValid: false,
      error: "Dimensions must be valid numeric values.",
    };
  }

  if (width <= 0 || height <= 0) {
    return {
      isValid: false,
      error: "Width and height must be greater than zero.",
    };
  }

  // Maximum upper bounds to prevent overflow or nonsensical wall sizes
  // Equivalent to 1,000 ft max per dimension
  let maxDim = 1000;
  if (unit === "inch") maxDim = 12000;
  else if (unit === "cm") maxDim = 30480;
  else if (unit === "mm") maxDim = 304800;

  if (width > maxDim || height > maxDim) {
    return {
      isValid: false,
      error: `Dimensions exceed the maximum allowable size of ${maxDim} ${unit}.`,
    };
  }

  return {
    isValid: true,
    sanitizedWidth: width,
    sanitizedHeight: height,
    sanitizedUnit: unit,
  };
}

/**
 * Canonical calculation for PER_AREA products.
 *
 * 1. Convert width and height to feet and calculate raw entered sqft.
 * 2. Apply wastage percentage buffer: enteredAreaSqft * (1 + wastagePct / 100).
 * 3. Enforce minimum billable area floor: Math.max(areaWithWastage, minAreaSqft).
 * 4. Multiply billable area by rate per sqft (paise).
 * 5. Multiply unit price by quantity.
 */
export function calculatePerAreaPricing(input: PerAreaPricingInput): PerAreaPricingResult {
  const { widthFt, heightFt, areaSqft: rawAreaSqft } = convertDimensionsToSqft(
    input.width,
    input.height,
    input.unit
  );

  const enteredAreaSqft = Number(rawAreaSqft.toFixed(2));
  const wastagePct = Math.max(0, input.wastagePct ?? 0);
  const minAreaSqft = Math.max(0, input.minAreaSqft ?? 0);
  const ratePaise = Math.max(0, Math.round(input.ratePaise));
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));

  // Wastage buffer addition
  const rawWastageArea = (enteredAreaSqft * wastagePct) / 100;
  const wastageAreaSqft = Number(rawWastageArea.toFixed(2));
  const areaWithWastageSqft = Number((enteredAreaSqft + wastageAreaSqft).toFixed(2));

  // Minimum area floor
  const isMinAreaApplied = minAreaSqft > 0 && areaWithWastageSqft < minAreaSqft;
  const billableAreaSqft = isMinAreaApplied ? minAreaSqft : areaWithWastageSqft;

  // Wallpaper roll panel estimation if roll width is specified
  let rollWidthFt: number | null = null;
  let panelsNeeded: number | null = null;
  if (input.rollWidthFt != null && input.rollWidthFt > 0) {
    rollWidthFt = input.rollWidthFt;
    panelsNeeded = Math.ceil(widthFt / rollWidthFt);
  }

  // Price calculation in paise
  // Rate is integer paise per sqft.
  const unitPricePaise = Math.round(billableAreaSqft * ratePaise);
  const totalPricePaise = unitPricePaise * quantity;

  return {
    width: input.width,
    height: input.height,
    unit: input.unit,
    widthFt,
    heightFt,
    enteredAreaSqft,
    wastagePct,
    wastageAreaSqft,
    areaWithWastageSqft,
    minAreaSqft,
    isMinAreaApplied,
    billableAreaSqft,
    rollWidthFt,
    panelsNeeded,
    ratePaise,
    unitPricePaise,
    quantity,
    totalPricePaise,
  };
}

/**
 * Canonical calculation for FIXED products with or without variants.
 */
export function calculateFixedPricing(input: FixedPricingInput): FixedPricingResult {
  const quantity = Math.max(1, Math.floor(input.quantity ?? 1));
  const unitPricePaise = Math.max(
    0,
    Math.round(input.variantPricePaise ?? input.basePricePaise ?? 0)
  );
  const totalPricePaise = unitPricePaise * quantity;

  return {
    unitPricePaise,
    quantity,
    totalPricePaise,
  };
}
