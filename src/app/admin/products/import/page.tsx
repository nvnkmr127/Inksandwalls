"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/feedback/toast";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import {
  CsvValidationSummary,
  CsvValidationRowResult,
  CsvImportExecutionResult,
  ValidatedRowPayload,
} from "@/lib/products/csv-import-service";
import { CSV_IMPORT_FIELDS } from "@/lib/products/csv-template";
import { serializeCsv } from "@/lib/products/csv-parser";

type ImportStep = "upload" | "validating" | "preview" | "importing" | "success" | "error";

export default function ProductImportPage() {
  const [step, setStep] = React.useState<ImportStep>("upload");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [validationSummary, setValidationSummary] = React.useState<CsvValidationSummary | null>(null);
  const [importResult, setImportResult] = React.useState<CsvImportExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<"all" | "valid" | "invalid">("all");
  const [confirmModalOpen, setConfirmModalOpen] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/api/admin/products/import/template";
    link.setAttribute("download", "inks_and_walls_product_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Invalid File Type", "Please select a standard .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File Too Large", "Maximum allowable CSV file size is 5 MB.");
      return;
    }
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleValidateFile = async () => {
    if (!selectedFile) return;

    setStep("validating");
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/admin/products/import/validate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error?.message || "CSV validation failed.");
        setStep("error");
        return;
      }

      setValidationSummary(data);
      setStep("preview");
    } catch {
      setErrorMessage("Network error occurred while validating the CSV file.");
      setStep("error");
    }
  };

  const handleDownloadErrors = () => {
    if (!validationSummary) return;
    const invalidRows = validationSummary.rows.filter((r) => r.status === "invalid");
    if (invalidRows.length === 0) return;

    const headers = ["Row", "SKU", "Name", "ProductType", "Category", "Errors"];
    const rows = invalidRows.map((r) => [
      r.rowNumber,
      r.sku,
      r.name,
      r.productType,
      r.category,
      r.errors.join(" | "),
    ]);

    const csvContent = serializeCsv(headers, rows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `import_errors_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExecuteImport = async () => {
    if (!validationSummary) return;

    const validPayloads = validationSummary.rows
      .filter((r) => r.status === "valid" && r.payload)
      .map((r) => r.payload as ValidatedRowPayload);

    if (validPayloads.length === 0) {
      toast.error("No Valid Rows", "There are no valid products to import.");
      return;
    }

    setConfirmModalOpen(false);
    setStep("importing");

    try {
      const res = await fetch("/api/admin/products/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validPayloads }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error?.message || "Import execution failed.");
        setStep("error");
        return;
      }

      setImportResult(data);
      setStep("success");
      toast.success("Import Succeeded", `Successfully created ${data.importedCount} products.`);
    } catch {
      setErrorMessage("Network error occurred while committing product import.");
      setStep("error");
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setValidationSummary(null);
    setImportResult(null);
    setErrorMessage(null);
    setStatusFilter("all");
    setStep("upload");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const filteredRows = React.useMemo(() => {
    if (!validationSummary) return [];
    if (statusFilter === "all") return validationSummary.rows;
    return validationSummary.rows.filter((r) => r.status === statusFilter);
  }, [validationSummary, statusFilter]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/admin/products"
              className="inline-flex items-center justify-center rounded-lg h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground -ml-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Products
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Bulk Product Import</h1>
          <p className="text-sm text-muted-foreground">
            Validate and import catalogue products in bulk using safe, transactional CSV processing.
          </p>
        </div>

        <Button onClick={handleDownloadTemplate} variant="outline" className="gap-2 shrink-0">
          <Download className="h-4 w-4" />
          Download CSV Template
        </Button>
      </div>

      {/* Step 1: Upload & Initial State */}
      {step === "upload" && (
        <div className="space-y-6">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/50 bg-card"
            }`}
          >
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4 text-muted-foreground">
              <UploadCloud className="h-6 w-6" />
            </div>

            <h3 className="text-lg font-semibold text-foreground mb-1">
              Choose a CSV file or drag & drop it here
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Only standard UTF-8 encoded .csv files up to 5 MB (maximum 1,000 products per import batch) are supported.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Select CSV File
            </Button>

            {selectedFile && (
              <div className="mt-6 inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-accent/50 border border-border text-sm font-medium text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span>{selectedFile.name}</span>
                <span className="text-xs text-muted-foreground">
                  ({(selectedFile.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleReset}>
                Cancel
              </Button>
              <Button onClick={handleValidateFile} className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Validate & Preview Rows
              </Button>
            </div>
          )}

          {/* Reference Column Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30">
              <h4 className="text-sm font-semibold text-foreground">Supported CSV Fields Specification</h4>
              <p className="text-xs text-muted-foreground">
                Ensure your CSV headers match the exact column names below.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border uppercase tracking-wider font-mono">
                  <tr>
                    <th className="p-3">Field</th>
                    <th className="p-3">Required</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Description & Example</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CSV_IMPORT_FIELDS.map((f) => (
                    <tr key={f.field} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-medium text-foreground">{f.field}</td>
                      <td className="p-3">
                        {f.required ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">Optional</Badge>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono">{f.type}</td>
                      <td className="p-3 text-muted-foreground">
                        <span>{f.description}</span>
                        <span className="block mt-0.5 text-xs text-primary/80 font-mono">e.g. {f.example}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Validating State */}
      {step === "validating" && (
        <div className="rounded-xl border border-border bg-card p-16 text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Validating CSV Structure & Rows</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Checking schema invariants, batch preloading categories & collections, and verifying SKU uniqueness...
          </p>
        </div>
      )}

      {/* Step 3: Preview State */}
      {step === "preview" && validationSummary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total Rows</span>
              <p className="text-2xl font-bold text-foreground mt-1">{validationSummary.totalRows}</p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-xs font-medium text-muted-foreground uppercase">Valid Rows</span>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {validationSummary.validRows}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-xs font-medium text-muted-foreground uppercase">Invalid Rows</span>
              <p className={`text-2xl font-bold mt-1 ${validationSummary.invalidRows > 0 ? "text-destructive" : "text-foreground"}`}>
                {validationSummary.invalidRows}
              </p>
            </div>
            <div className="p-4 rounded-xl border border-border bg-card">
              <span className="text-xs font-medium text-muted-foreground uppercase">SKU Conflicts</span>
              <p className={`text-2xl font-bold mt-1 ${validationSummary.existingSkuConflicts > 0 ? "text-amber-500" : "text-foreground"}`}>
                {validationSummary.existingSkuConflicts}
              </p>
            </div>
          </div>

          {/* Validation Warning / Error Banner */}
          {validationSummary.invalidRows > 0 && (
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-destructive">
                    Blocking Validation Errors Detected ({validationSummary.invalidRows} invalid rows)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Please correct the errors indicated below. In accordance with safety rules, imports cannot be processed while invalid rows exist.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleDownloadErrors} className="gap-1.5 shrink-0">
                <Download className="h-3.5 w-3.5" />
                Download Error CSV
              </Button>
            </div>
          )}

          {/* Filter & Row Details Table */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">Row-Level Validation</span>
                <span className="text-xs text-muted-foreground">({filteredRows.length} displayed)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setStatusFilter("all")}
                >
                  All ({validationSummary.totalRows})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "valid" ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setStatusFilter("valid")}
                >
                  Valid ({validationSummary.validRows})
                </Button>
                <Button
                  size="sm"
                  variant={statusFilter === "invalid" ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setStatusFilter("invalid")}
                >
                  Invalid ({validationSummary.invalidRows})
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur text-muted-foreground uppercase border-b border-border tracking-wider font-mono">
                  <tr>
                    <th className="p-3 w-14">Row</th>
                    <th className="p-3 w-24">Status</th>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Price / Rate</th>
                    <th className="p-3 min-w-[240px]">Validation Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((r: CsvValidationRowResult) => (
                    <tr key={r.rowNumber} className={r.status === "invalid" ? "bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/20"}>
                      <td className="p-3 font-mono font-medium text-muted-foreground">{r.rowNumber}</td>
                      <td className="p-3">
                        {r.status === "valid" ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0 gap-1">
                            <Check className="h-3 w-3" />
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Invalid
                          </Badge>
                        )}
                      </td>
                      <td className="p-3 font-mono font-medium text-foreground">{r.sku}</td>
                      <td className="p-3 font-medium text-foreground">{r.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {r.productType}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.category}</td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {r.priceRupees !== null ? `₹${r.priceRupees.toFixed(2)}` : r.rateRupees !== null ? `₹${r.rateRupees.toFixed(2)}/sqft` : "—"}
                      </td>
                      <td className="p-3">
                        {r.status === "valid" ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Ready for import</span>
                        ) : (
                          <ul className="space-y-0.5 text-destructive font-medium list-disc list-inside">
                            {r.errors.map((err: string, i: number) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
            <Button variant="outline" onClick={handleReset}>
              Upload Different CSV
            </Button>

            <div className="flex items-center gap-3">
              <Button
                disabled={validationSummary.invalidRows > 0 || validationSummary.validRows === 0}
                onClick={() => setConfirmModalOpen(true)}
                className="gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirm & Import {validationSummary.validRows} Products
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Importing State */}
      {step === "importing" && (
        <div className="rounded-xl border border-border bg-card p-16 text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Importing Products to Catalogue</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Executing atomic database transaction and recording audit logs. Please do not close this window...
          </p>
        </div>
      )}

      {/* Step 5: Success State */}
      {step === "success" && importResult && (
        <div className="rounded-xl border border-border bg-card p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-xl font-bold text-foreground">Import Completed Successfully</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Created {importResult.importedCount} catalogue product records in an atomic database transaction.
            </p>
            <p className="text-xs font-mono text-muted-foreground">Import Reference: {importResult.importId}</p>
          </div>

          <div className="rounded-lg border border-border overflow-hidden max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/60 text-muted-foreground uppercase font-mono border-b border-border sticky top-0">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Slug</th>
                  <th className="p-3">Record ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {importResult.createdProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20">
                    <td className="p-3 font-mono font-medium text-foreground">{p.sku}</td>
                    <td className="p-3 text-foreground">{p.name}</td>
                    <td className="p-3 font-mono text-muted-foreground">{p.slug}</td>
                    <td className="p-3 font-mono text-muted-foreground">{p.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <Button variant="outline" onClick={handleReset}>
              Import Another File
            </Button>
            <Link
              href="/admin/products"
              className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/80 h-8 gap-1.5 px-3 text-sm font-medium transition-colors"
            >
              View Catalogue in Products Admin
            </Link>
          </div>
        </div>
      )}

      {/* Step 6: Error State */}
      {step === "error" && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-2">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Import Operation Failed</h3>
          <p className="text-sm text-destructive max-w-md mx-auto">
            {errorMessage || "An unexpected error occurred during import processing."}
          </p>
          <div className="pt-4 flex justify-center gap-3">
            <Button variant="outline" onClick={handleReset}>
              Upload New File
            </Button>
            {selectedFile && (
              <Button onClick={handleValidateFile} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Retry Validation
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmModalOpen}
        onOpenChange={setConfirmModalOpen}
        title="Confirm Catalogue Bulk Import"
        description={`You are about to import ${validationSummary?.validRows} product(s) into the live store catalogue. All valid records will be created in an atomic transaction.`}
        confirmText="Confirm & Execute Import"
        variant="default"
        onConfirm={handleExecuteImport}
      />
    </div>
  );
}
