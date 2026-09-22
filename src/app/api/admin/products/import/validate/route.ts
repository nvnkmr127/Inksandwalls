import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { validateCsvImport, MAX_CSV_FILE_SIZE } from "@/lib/products/csv-import-service";

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();

    let csvContent = "";
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof Blob)) {
        throw new ValidationError("No CSV file uploaded. Please upload a valid .csv file.");
      }

      if (file.size > MAX_CSV_FILE_SIZE) {
        throw new ValidationError(
          `File size exceeds maximum allowable limit of ${MAX_CSV_FILE_SIZE / (1024 * 1024)} MB.`
        );
      }

      csvContent = await file.text();
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body || typeof body.csvContent !== "string") {
        throw new ValidationError("Invalid request body: expected { csvContent: string }.");
      }
      csvContent = body.csvContent;
    } else if (contentType.includes("text/csv") || contentType.includes("text/plain")) {
      csvContent = await request.text();
    } else {
      throw new ValidationError(
        "Unsupported Content-Type. Please upload multipart/form-data or application/json."
      );
    }

    const preview = await validateCsvImport(csvContent);

    return NextResponse.json(preview, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "ProductImportValidateAPI");
  }
}
