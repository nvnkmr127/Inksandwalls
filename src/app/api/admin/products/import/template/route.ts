import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createErrorResponse } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { generateCsvTemplate } from "@/lib/products/csv-template";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();

    const csvData = generateCsvTemplate();

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="inks_and_walls_product_template.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return createErrorResponse(error, correlationId, "ProductImportTemplateAPI");
  }
}
