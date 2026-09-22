import assert from "node:assert";
import {
  convertDimensionsToSqft,
  validateDimensions,
  calculatePerAreaPricing,
  calculateFixedPricing,
} from "../pricing-engine";

function runPricingEngineTests() {
  console.log("Running Canonical Pricing Engine Tests...");

  // 1. Unit Normalisation Tests
  console.log("--- 1. Testing Dimension Normalisation ---");
  const feetConversion = convertDimensionsToSqft(10, 8, "ft");
  assert.strictEqual(feetConversion.widthFt, 10);
  assert.strictEqual(feetConversion.heightFt, 8);
  assert.strictEqual(feetConversion.areaSqft, 80);

  // 120 in x 96 in = 10 ft x 8 ft = 80 sqft
  const inchConversion = convertDimensionsToSqft(120, 96, "inch");
  assert.strictEqual(inchConversion.widthFt, 10);
  assert.strictEqual(inchConversion.heightFt, 8);
  assert.strictEqual(inchConversion.areaSqft, 80);

  // 304.8 cm x 243.84 cm = 10 ft x 8 ft = 80 sqft
  const cmConversion = convertDimensionsToSqft(304.8, 243.84, "cm");
  assert.strictEqual(cmConversion.widthFt, 10);
  assert.strictEqual(cmConversion.heightFt, 8);
  assert.strictEqual(cmConversion.areaSqft, 80);

  // 3048 mm x 2438.4 mm = 10 ft x 8 ft = 80 sqft
  const mmConversion = convertDimensionsToSqft(3048, 2438.4, "mm");
  assert.strictEqual(mmConversion.widthFt, 10);
  assert.strictEqual(mmConversion.heightFt, 8);
  assert.strictEqual(mmConversion.areaSqft, 80);
  console.log("✔ Dimension normalisations for ft, inch, cm, and mm verified");

  // 2. Dimension Validation Tests
  console.log("--- 2. Testing Dimension Validation ---");
  assert.strictEqual(validateDimensions(10, 8, "ft").isValid, true);
  assert.strictEqual(validateDimensions(0, 8, "ft").isValid, false);
  assert.strictEqual(validateDimensions(-5, 8, "ft").isValid, false);
  assert.strictEqual(validateDimensions(10, -8, "ft").isValid, false);
  assert.strictEqual(validateDimensions("abc", 8, "ft").isValid, false);
  assert.strictEqual(validateDimensions(10, 8, "miles" as unknown as import("../pricing-engine").DimensionUnit).isValid, false);
  assert.strictEqual(validateDimensions(1001, 8, "ft").isValid, false); // exceeds 1000 ft
  console.log("✔ Dimension validation guards verified");

  // 3. PER_AREA Pricing Calculation with Wastage
  console.log("--- 3. Testing PER_AREA Pricing with Wastage ---");
  // 10 ft x 10 ft = 100 sqft, 10% wastage = 110 sqft, rate = ₹150/sqft (15000 paise)
  // Expected price: 110 * 15000 = 1,650,000 paise (₹16,500)
  const perAreaWithWastage = calculatePerAreaPricing({
    width: 10,
    height: 10,
    unit: "ft",
    ratePaise: 15000,
    wastagePct: 10,
    minAreaSqft: null,
    quantity: 1,
  });

  assert.strictEqual(perAreaWithWastage.enteredAreaSqft, 100);
  assert.strictEqual(perAreaWithWastage.wastagePct, 10);
  assert.strictEqual(perAreaWithWastage.wastageAreaSqft, 10);
  assert.strictEqual(perAreaWithWastage.areaWithWastageSqft, 110);
  assert.strictEqual(perAreaWithWastage.isMinAreaApplied, false);
  assert.strictEqual(perAreaWithWastage.billableAreaSqft, 110);
  assert.strictEqual(perAreaWithWastage.unitPricePaise, 1650000);
  assert.strictEqual(perAreaWithWastage.totalPricePaise, 1650000);
  console.log("✔ Wastage buffer computation verified");

  // 4. PER_AREA Pricing with Minimum Area Floor
  console.log("--- 4. Testing Minimum Area Floor ---");
  // 2 ft x 3 ft = 6 sqft, 10% wastage = 6.6 sqft, minArea = 25 sqft
  // Billable area must be clamped to 25 sqft floor.
  // Rate: ₹200/sqft (20000 paise). Expected: 25 * 20000 = 500,000 paise (₹5,000).
  const perAreaWithMinFloor = calculatePerAreaPricing({
    width: 2,
    height: 3,
    unit: "ft",
    ratePaise: 20000,
    wastagePct: 10,
    minAreaSqft: 25,
    quantity: 2,
  });

  assert.strictEqual(perAreaWithMinFloor.enteredAreaSqft, 6);
  assert.strictEqual(perAreaWithMinFloor.areaWithWastageSqft, 6.6);
  assert.strictEqual(perAreaWithMinFloor.isMinAreaApplied, true);
  assert.strictEqual(perAreaWithMinFloor.billableAreaSqft, 25);
  assert.strictEqual(perAreaWithMinFloor.unitPricePaise, 500000);
  assert.strictEqual(perAreaWithMinFloor.totalPricePaise, 1000000); // 2 units
  console.log("✔ Minimum area floor enforcement verified");

  // 5. Wallpaper Roll Panel Calculation
  console.log("--- 5. Testing Wallpaper Roll Coverage ---");
  // Width 10 ft, roll width 3 ft -> ceil(10 / 3) = 4 panels needed
  const wallpaperRollCalc = calculatePerAreaPricing({
    width: 10,
    height: 8,
    unit: "ft",
    ratePaise: 18000,
    rollWidthFt: 3,
  });
  assert.strictEqual(wallpaperRollCalc.rollWidthFt, 3);
  assert.strictEqual(wallpaperRollCalc.panelsNeeded, 4);
  console.log("✔ Roll panel calculation verified");

  // 6. FIXED Pricing Tests
  console.log("--- 6. Testing FIXED Pricing ---");
  // Base fixed price: ₹4,999 (499900 paise), qty: 3
  const fixedBase = calculateFixedPricing({
    basePricePaise: 499900,
    quantity: 3,
  });
  assert.strictEqual(fixedBase.unitPricePaise, 499900);
  assert.strictEqual(fixedBase.quantity, 3);
  assert.strictEqual(fixedBase.totalPricePaise, 1499700);

  // Variant fixed price: ₹6,499 (649900 paise) overrides base price
  const fixedVariant = calculateFixedPricing({
    basePricePaise: 499900,
    variantPricePaise: 649900,
    quantity: 2,
  });
  assert.strictEqual(fixedVariant.unitPricePaise, 649900);
  assert.strictEqual(fixedVariant.totalPricePaise, 1299800);
  console.log("✔ FIXED base and variant pricing verified");

  console.log("ALL CANONICAL PRICING ENGINE TESTS PASSED SUCCESSFULLY! (Phase 05.03)");
}

export { runPricingEngineTests };

if (require.main === module) {
  runPricingEngineTests();
}

