import { serializeCsv } from "./csv-parser";

export interface CsvFieldDefinition {
  field: string;
  label: string;
  required: boolean;
  type: string;
  description: string;
  example: string;
}

export const CSV_IMPORT_FIELDS: CsvFieldDefinition[] = [
  {
    field: "name",
    label: "Product Name",
    required: true,
    type: "String (1-200 chars)",
    description: "Display name of the catalogue product.",
    example: "Royal Floral Wallpaper",
  },
  {
    field: "slug",
    label: "Slug",
    required: false,
    type: "String (URL-safe)",
    description: "Unique URL slug. Auto-generated from name if omitted.",
    example: "royal-floral-wallpaper",
  },
  {
    field: "sku",
    label: "SKU",
    required: true,
    type: "String (1-50 chars, alphanumeric + _ -)",
    description: "Unique Stock Keeping Unit. Must be globally unique.",
    example: "IW-WALL-001",
  },
  {
    field: "productType",
    label: "Product Type",
    required: true,
    type: "PER_AREA | FIXED",
    description: "Pricing model. PER_AREA uses rate/sqft; FIXED uses unit price.",
    example: "PER_AREA",
  },
  {
    field: "category",
    label: "Category",
    required: true,
    type: "Slug or CUID",
    description: "Slug or ID of an existing Category in the store.",
    example: "wallpapers",
  },
  {
    field: "collection",
    label: "Collection",
    required: false,
    type: "Slug or CUID",
    description: "Slug or ID of an existing Collection. Must exist if specified.",
    example: "heritage-prints",
  },
  {
    field: "price",
    label: "Fixed Price (₹)",
    required: false,
    type: "Number > 0 (Rupees)",
    description: "Required for FIXED products. Leave blank for PER_AREA.",
    example: "4999.00",
  },
  {
    field: "rate",
    label: "Rate per SqFt (₹)",
    required: false,
    type: "Number > 0 (Rupees/sqft)",
    description: "Required for PER_AREA products. Leave blank for FIXED.",
    example: "150.00",
  },
  {
    field: "wastage",
    label: "Wastage Percentage",
    required: false,
    type: "Number 0-100",
    description: "Area buffer percentage for PER_AREA products (default 0).",
    example: "10.0",
  },
  {
    field: "minArea",
    label: "Minimum Area (sqft)",
    required: false,
    type: "Number >= 0",
    description: "Minimum billable square footage for PER_AREA products.",
    example: "25.0",
  },
  {
    field: "rollWidth",
    label: "Roll Width (ft)",
    required: false,
    type: "Number > 0",
    description: "Panel or roll width in feet for PER_AREA roll calculations.",
    example: "3.0",
  },
  {
    field: "returnable",
    label: "Returnable",
    required: false,
    type: "Boolean (true/false)",
    description: "Whether the product is eligible for returns (default true).",
    example: "true",
  },
  {
    field: "hsnCode",
    label: "HSN Code",
    required: false,
    type: "String (max 20 chars)",
    description: "Tax harmonized system nomenclature code.",
    example: "4814.90",
  },
  {
    field: "isActive",
    label: "Active Status",
    required: false,
    type: "Boolean (true/false)",
    description: "Publish status in the catalogue (default true).",
    example: "true",
  },
  {
    field: "description",
    label: "Description",
    required: false,
    type: "String (max 2000 chars)",
    description: "Detailed product description.",
    example: "Premium textured silk wallpaper with artisan gold foil embellishments.",
  },
];

export const CSV_TEMPLATE_HEADERS = CSV_IMPORT_FIELDS.map((f) => f.field);

/**
 * Returns sample rows demonstrating both PER_AREA and FIXED product configurations.
 */
export function getSampleCsvRows(): (string | number | boolean | null | undefined)[][] {
  return [
    [
      "Royal Floral Wallpaper", // name
      "royal-floral-wallpaper", // slug
      "IW-WALL-001", // sku
      "PER_AREA", // productType
      "wallpapers", // category (slug)
      "heritage-prints", // collection (slug)
      "", // price (empty for PER_AREA)
      "150.00", // rate (₹150/sqft)
      "10.0", // wastage
      "25.0", // minArea
      "3.0", // rollWidth
      "true", // returnable
      "4814.90", // hsnCode
      "true", // isActive
      "Premium textured wallpaper with gold foil embellishments.", // description
    ],
    [
      "Abstract Canvas Framed Art", // name
      "abstract-canvas-framed-art", // slug
      "IW-ART-002", // sku
      "FIXED", // productType
      "wall-art", // category (slug)
      "", // collection
      "4999.00", // price (₹4,999)
      "", // rate (empty for FIXED)
      "", // wastage
      "", // minArea
      "", // rollWidth
      "true", // returnable
      "9701.10", // hsnCode
      "true", // isActive
      "Handcrafted fine art giclée print on archival cotton canvas.", // description
    ],
  ];
}

/**
 * Generates the raw CSV template string including headers and realistic sample rows.
 */
export function generateCsvTemplate(): string {
  return serializeCsv(CSV_TEMPLATE_HEADERS, getSampleCsvRows());
}
