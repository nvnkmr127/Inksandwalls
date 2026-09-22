import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";
import {
  executeCsvImport,
  validateCsvImport,
  ValidatedRowPayload,
} from "@/lib/products/csv-import-service";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const reqContext = extractRequestContext(request);
    const body = await request.json();

    if (!body || typeof body !== "object") {
      throw new ValidationError("Invalid request body: JSON object expected.");
    }

    let rowsToImport: ValidatedRowPayload[] = [];

    if (Array.isArray(body.rows) && body.rows.length > 0) {
      // Direct validated rows payload from preview screen
      rowsToImport = body.rows as ValidatedRowPayload[];
    } else if (typeof body.csvContent === "string" && body.csvContent.trim()) {
      // Direct raw CSV payload: re-validate and extract valid payloads
      const summary = await validateCsvImport(body.csvContent);
      if (!summary.canImport) {
        throw new ValidationError(
          `Cannot import CSV: found ${summary.invalidRows} invalid row(s). All rows must be valid before import.`
        );
      }
      rowsToImport = summary.rows
        .map((r) => r.payload)
        .filter((p): p is ValidatedRowPayload => Boolean(p));
    } else {
      throw new ValidationError(
        "Invalid payload: must provide either 'rows' array or 'csvContent' string."
      );
    }

    if (rowsToImport.length === 0) {
      throw new ValidationError("No valid rows available to import.");
    }

    const result = await executeCsvImport(rowsToImport, actor, reqContext);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "ProductImportCommitAPI");
  }
}
