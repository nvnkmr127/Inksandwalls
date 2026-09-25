import type { InvoiceSnapshotDTO } from "./types";
import { formatPaiseToRupees } from "@/lib/money";

/**
 * Converts an integer amount (in paise) to Indian English words.
 * e.g., 177000 paise (₹1,770) -> "One Thousand Seven Hundred Seventy Rupees Only"
 */
export function numberToIndianWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  if (rupees === 0) return "Zero Rupees Only";

  const units = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  function convertTwoDigits(n: number): string {
    if (n === 0) return "";
    if (n < 20) return units[n];
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    return `${tens[ten]}${unit > 0 ? ` ${units[unit]}` : ""}`;
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let res = "";
    if (hundred > 0) {
      res += `${units[hundred]} Hundred`;
      if (rest > 0) res += " and ";
    }
    if (rest > 0) {
      res += convertTwoDigits(rest);
    }
    return res;
  }

  let num = rupees;
  let words = "";

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  if (crore > 0) {
    words += `${convertThreeDigits(crore)} Crore `;
  }

  const lakh = Math.floor(num / 100000);
  num %= 100000;
  if (lakh > 0) {
    words += `${convertTwoDigits(lakh)} Lakh `;
  }

  const thousand = Math.floor(num / 1000);
  num %= 1000;
  if (thousand > 0) {
    words += `${convertTwoDigits(thousand)} Thousand `;
  }

  if (num > 0) {
    words += convertThreeDigits(num);
  }

  const result = `${words.trim()} Rupees Only`;
  return result.replace(/\s+/g, " ");
}

/**
 * Escapes characters for PDF literal text strings: \( \) \\
 */
function escapePdfText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u0000-\u001F]/g, " "); // Replace control characters
}

/**
 * Builds standard PDF 1.4 binary content stream for Tax Invoice.
 */
export function generateInvoicePdfBuffer(invoice: InvoiceSnapshotDTO): Buffer {
  const width = 595.28;
  const height = 841.89;
  const margin = 36;
  const contentWidth = width - margin * 2;

  const ops: string[] = [];

  // Helpers for drawing
  const drawRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    stroke = true,
    fill = false,
    fillR = 0.96,
    fillG = 0.96,
    fillB = 0.96
  ) => {
    if (fill) {
      ops.push(`${fillR.toFixed(2)} ${fillG.toFixed(2)} ${fillB.toFixed(2)} rg`);
      ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
    }
    if (stroke) {
      ops.push("0.80 0.80 0.80 RG 0.5 w");
      ops.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S`);
    }
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number, color = "0.80 0.80 0.80") => {
    ops.push(`${color} RG 0.5 w`);
    ops.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  };

  const drawText = (
    text: string,
    x: number,
    y: number,
    font = "F1",
    size = 9,
    align: "left" | "right" | "center" = "left",
    color = "0 0 0"
  ) => {
    const escaped = escapePdfText(text);
    ops.push("BT");
    ops.push(`/${font} ${size} Tf`);
    ops.push(`${color} rg`);

    let adjustedX = x;
    const charWidth = font === "F2" ? size * 0.55 : size * 0.5;
    const textWidth = escaped.length * charWidth;

    if (align === "right") {
      adjustedX = x - textWidth;
    } else if (align === "center") {
      adjustedX = x - textWidth / 2;
    }

    ops.push(`1 0 0 1 ${adjustedX.toFixed(2)} ${y.toFixed(2)} Tm`);
    ops.push(`(${escaped}) Tj`);
    ops.push("ET");
  };

  // --- 1. Top Header Banner ---
  let cursorY = height - margin;

  // Title & Company Header
  drawText("TAX INVOICE", margin, cursorY - 14, "F2", 16, "left", "0.1 0.1 0.1");
  drawText(
    invoice.seller.tradeName || "INKs & Walls",
    width - margin,
    cursorY - 14,
    "F2",
    14,
    "right",
    "0.1 0.1 0.1"
  );
  cursorY -= 28;

  // Invoice Meta Bar
  drawRect(margin, cursorY - 24, contentWidth, 24, true, true, 0.96, 0.96, 0.98);
  drawText(`Invoice No: ${invoice.invoiceNumber}`, margin + 8, cursorY - 16, "F2", 9, "left");
  drawText(
    `Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })}`,
    margin + 180,
    cursorY - 16,
    "F1",
    9,
    "left"
  );
  drawText(
    `Place of Supply: ${invoice.placeOfSupply}`,
    width - margin - 8,
    cursorY - 16,
    "F1",
    9,
    "right"
  );
  cursorY -= 32;

  // --- 2. Two-Column Seller & Buyer Details Block ---
  const blockHeight = 96;
  const colWidth = (contentWidth - 10) / 2;

  // Seller Box (Left)
  drawRect(margin, cursorY - blockHeight, colWidth, blockHeight, true, true, 0.99, 0.99, 0.99);
  drawText("SOLD BY / SUPPLIER", margin + 8, cursorY - 14, "F2", 8, "left", "0.3 0.3 0.3");
  drawText(invoice.seller.legalName, margin + 8, cursorY - 26, "F2", 8.5);
  drawText(
    `${invoice.seller.addressLine1}${invoice.seller.addressLine2 ? `, ${invoice.seller.addressLine2}` : ""}`,
    margin + 8,
    cursorY - 37,
    "F1",
    7.5
  );
  drawText(
    `${invoice.seller.city}, ${invoice.seller.state} - ${invoice.seller.postalCode}`,
    margin + 8,
    cursorY - 48,
    "F1",
    7.5
  );
  drawText(`GSTIN: ${invoice.seller.gstin}`, margin + 8, cursorY - 60, "F2", 7.5);
  drawText(
    `PAN: ${invoice.seller.pan}  |  State Code: ${invoice.seller.stateCode}`,
    margin + 8,
    cursorY - 71,
    "F1",
    7.5
  );
  drawText(`Email: ${invoice.seller.email || ""}`, margin + 8, cursorY - 82, "F1", 7.5);

  // Buyer Box (Right)
  const buyerX = margin + colWidth + 10;
  drawRect(buyerX, cursorY - blockHeight, colWidth, blockHeight, true, true, 0.99, 0.99, 0.99);
  drawText("BILLED TO / BUYER", buyerX + 8, cursorY - 14, "F2", 8, "left", "0.3 0.3 0.3");
  drawText(
    `${invoice.billingAddress.firstName} ${invoice.billingAddress.lastName}`,
    buyerX + 8,
    cursorY - 26,
    "F2",
    8.5
  );
  drawText(
    `${invoice.billingAddress.addressLine1}${
      invoice.billingAddress.addressLine2 ? `, ${invoice.billingAddress.addressLine2}` : ""
    }`,
    buyerX + 8,
    cursorY - 37,
    "F1",
    7.5
  );
  drawText(
    `${invoice.billingAddress.city}, ${invoice.billingAddress.state} - ${invoice.billingAddress.postalCode}`,
    buyerX + 8,
    cursorY - 48,
    "F1",
    7.5
  );
  drawText(`Email: ${invoice.customer.email}`, buyerX + 8, cursorY - 60, "F1", 7.5);
  drawText(`Phone: ${invoice.customer.phone || invoice.billingAddress.phone || "N/A"}`, buyerX + 8, cursorY - 71, "F1", 7.5);
  drawText(
    `Shipping To: ${invoice.shippingAddress.city}, ${invoice.shippingAddress.state} (${invoice.shippingAddress.postalCode})`,
    buyerX + 8,
    cursorY - 82,
    "F1",
    7.5
  );

  cursorY -= blockHeight + 12;

  // --- 3. Line Items Table ---
  const tableHeaderY = cursorY;
  const rowHeight = 18;
  drawRect(margin, tableHeaderY - rowHeight, contentWidth, rowHeight, true, true, 0.92, 0.92, 0.94);

  // Column Positions
  const colX = {
    desc: margin + 8,
    hsn: margin + 175,
    qty: margin + 225,
    rate: margin + 280,
    disc: margin + 340,
    taxable: margin + 410,
    gst: margin + 465,
    total: width - margin - 8,
  };

  drawText("Item Description", colX.desc, tableHeaderY - 12, "F2", 8);
  drawText("HSN/SAC", colX.hsn, tableHeaderY - 12, "F2", 8);
  drawText("Qty", colX.qty, tableHeaderY - 12, "F2", 8, "right");
  drawText("Unit Price", colX.rate, tableHeaderY - 12, "F2", 8, "right");
  drawText("Disc.", colX.disc, tableHeaderY - 12, "F2", 8, "right");
  drawText("Taxable", colX.taxable, tableHeaderY - 12, "F2", 8, "right");
  drawText("GST", colX.gst, tableHeaderY - 12, "F2", 8, "right");
  drawText("Total (INR)", colX.total, tableHeaderY - 12, "F2", 8, "right");

  cursorY -= rowHeight;

  // Render Table Rows
  for (let idx = 0; idx < invoice.lines.length; idx++) {
    const line = invoice.lines[idx];
    const isEven = idx % 2 === 0;
    drawRect(margin, cursorY - rowHeight, contentWidth, rowHeight, true, isEven, 0.98, 0.98, 0.99);

    // Truncate description if too long
    const desc = line.productName.length > 28 ? `${line.productName.slice(0, 26)}...` : line.productName;
    drawText(desc, colX.desc, cursorY - 12, "F1", 7.5);
    drawText(line.hsnCode, colX.hsn, cursorY - 12, "F1", 7.5);
    drawText(String(line.quantity), colX.qty, cursorY - 12, "F1", 7.5, "right");
    drawText(formatPaiseToRupees(line.unitPricePaise), colX.rate, cursorY - 12, "F1", 7.5, "right");
    drawText(line.discountPaise > 0 ? `-${formatPaiseToRupees(line.discountPaise)}` : "0", colX.disc, cursorY - 12, "F1", 7.5, "right");
    drawText(formatPaiseToRupees(line.taxableAmountPaise), colX.taxable, cursorY - 12, "F1", 7.5, "right");
    drawText(`${line.gstRatePct}%`, colX.gst, cursorY - 12, "F1", 7.5, "right");
    drawText(formatPaiseToRupees(line.lineTotalWithTaxPaise), colX.total, cursorY - 12, "F2", 7.5, "right");

    cursorY -= rowHeight;
  }

  // Add Shipping Line if shipping fee > 0
  if (invoice.totals.shippingAmountPaise > 0) {
    drawRect(margin, cursorY - rowHeight, contentWidth, rowHeight, true, false);
    drawText("Shipping & Handling (Courier Service)", colX.desc, cursorY - 12, "F1", 7.5);
    drawText("9968", colX.hsn, cursorY - 12, "F1", 7.5);
    drawText("1", colX.qty, cursorY - 12, "F1", 7.5, "right");
    drawText(formatPaiseToRupees(invoice.totals.shippingAmountPaise), colX.rate, cursorY - 12, "F1", 7.5, "right");
    drawText("0", colX.disc, cursorY - 12, "F1", 7.5, "right");
    drawText(formatPaiseToRupees(invoice.totals.shippingAmountPaise), colX.taxable, cursorY - 12, "F1", 7.5, "right");
    drawText("18%", colX.gst, cursorY - 12, "F1", 7.5, "right");
    drawText(
      formatPaiseToRupees(invoice.totals.shippingAmountPaise + invoice.totals.shippingTaxPaise),
      colX.total,
      cursorY - 12,
      "F2",
      7.5,
      "right"
    );
    cursorY -= rowHeight;
  }

  cursorY -= 10;

  // --- 4. HSN Tax Summary Table (Left) and Final Totals (Right) ---
  const summaryBoxY = cursorY;
  const hsnBoxWidth = 310;
  const totalsBoxWidth = contentWidth - hsnBoxWidth - 10;
  const summaryBoxHeight = 100;

  // HSN Breakdown Box
  drawRect(margin, summaryBoxY - summaryBoxHeight, hsnBoxWidth, summaryBoxHeight, true, true, 0.99, 0.99, 0.99);
  drawText("GST / HSN TAX BREAKDOWN", margin + 8, summaryBoxY - 12, "F2", 8, "left", "0.2 0.2 0.2");
  drawLine(margin, summaryBoxY - 16, margin + hsnBoxWidth, summaryBoxY - 16);

  let hsnRowY = summaryBoxY - 26;
  drawText("HSN/SAC", margin + 8, hsnRowY, "F2", 7);
  drawText("Taxable", margin + 70, hsnRowY, "F2", 7, "right");
  drawText("CGST", margin + 130, hsnRowY, "F2", 7, "right");
  drawText("SGST", margin + 190, hsnRowY, "F2", 7, "right");
  drawText("IGST", margin + 250, hsnRowY, "F2", 7, "right");
  drawText("Total Tax", margin + hsnBoxWidth - 8, hsnRowY, "F2", 7, "right");

  for (const hsn of invoice.taxSummary) {
    hsnRowY -= 12;
    drawText(hsn.hsnCode, margin + 8, hsnRowY, "F1", 6.8);
    drawText(formatPaiseToRupees(hsn.taxableAmountPaise), margin + 70, hsnRowY, "F1", 6.8, "right");
    drawText(hsn.cgstAmountPaise > 0 ? formatPaiseToRupees(hsn.cgstAmountPaise) : "-", margin + 130, hsnRowY, "F1", 6.8, "right");
    drawText(hsn.sgstAmountPaise > 0 ? formatPaiseToRupees(hsn.sgstAmountPaise) : "-", margin + 190, hsnRowY, "F1", 6.8, "right");
    drawText(hsn.igstAmountPaise > 0 ? formatPaiseToRupees(hsn.igstAmountPaise) : "-", margin + 250, hsnRowY, "F1", 6.8, "right");
    drawText(formatPaiseToRupees(hsn.totalTaxPaise), margin + hsnBoxWidth - 8, hsnRowY, "F2", 6.8, "right");
  }

  // Totals Box (Right)
  const totalsBoxX = margin + hsnBoxWidth + 10;
  drawRect(totalsBoxX, summaryBoxY - summaryBoxHeight, totalsBoxWidth, summaryBoxHeight, true, true, 0.98, 0.98, 0.99);

  let totalLineY = summaryBoxY - 14;
  const labelX = totalsBoxX + 8;
  const valX = width - margin - 8;

  drawText("Subtotal:", labelX, totalLineY, "F1", 7.5);
  drawText(formatPaiseToRupees(invoice.totals.subtotalPaise), valX, totalLineY, "F1", 7.5, "right");
  totalLineY -= 11;

  if (invoice.totals.discountPaise > 0) {
    drawText("Coupon Discount:", labelX, totalLineY, "F1", 7.5);
    drawText(`-${formatPaiseToRupees(invoice.totals.discountPaise)}`, valX, totalLineY, "F1", 7.5, "right", "0 0.5 0");
    totalLineY -= 11;
  }

  drawText("Taxable Value:", labelX, totalLineY, "F1", 7.5);
  drawText(formatPaiseToRupees(invoice.totals.totalTaxableAmountPaise), valX, totalLineY, "F1", 7.5, "right");
  totalLineY -= 11;

  if (invoice.totals.totalCgstPaise > 0 || invoice.totals.totalSgstPaise > 0) {
    drawText("CGST:", labelX, totalLineY, "F1", 7.5);
    drawText(formatPaiseToRupees(invoice.totals.totalCgstPaise), valX, totalLineY, "F1", 7.5, "right");
    totalLineY -= 10;

    drawText("SGST:", labelX, totalLineY, "F1", 7.5);
    drawText(formatPaiseToRupees(invoice.totals.totalSgstPaise), valX, totalLineY, "F1", 7.5, "right");
    totalLineY -= 10;
  } else if (invoice.totals.totalIgstPaise > 0) {
    drawText("IGST:", labelX, totalLineY, "F1", 7.5);
    drawText(formatPaiseToRupees(invoice.totals.totalIgstPaise), valX, totalLineY, "F1", 7.5, "right");
    totalLineY -= 11;
  }

  if (invoice.totals.shippingAmountPaise > 0) {
    drawText("Shipping Fee:", labelX, totalLineY, "F1", 7.5);
    drawText(formatPaiseToRupees(invoice.totals.shippingAmountPaise), valX, totalLineY, "F1", 7.5, "right");
    totalLineY -= 11;
  }

  drawLine(totalsBoxX + 4, totalLineY + 2, width - margin - 4, totalLineY + 2);
  drawText("Grand Total:", labelX, totalLineY - 8, "F2", 9);
  drawText(formatPaiseToRupees(invoice.totals.grandTotalPaise), valX, totalLineY - 8, "F2", 9.5, "right");

  cursorY -= summaryBoxHeight + 12;

  // --- 5. Amount in Words Box ---
  drawRect(margin, cursorY - 22, contentWidth, 22, true, true, 0.97, 0.97, 0.97);
  drawText("Amount in Words: ", margin + 8, cursorY - 14, "F2", 7.5);
  drawText(
    numberToIndianWords(invoice.totals.grandTotalPaise),
    margin + 90,
    cursorY - 14,
    "F1",
    7.5
  );

  cursorY -= 32;

  // --- 6. Declaration & Footer ---
  drawLine(margin, margin + 40, width - margin, margin + 40);
  drawText(
    "Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
    margin,
    margin + 28,
    "F1",
    6.8,
    "left",
    "0.4 0.4 0.4"
  );
  drawText(
    "This is a digitally generated Tax Invoice and does not require physical signature.",
    margin,
    margin + 18,
    "F2",
    7,
    "left",
    "0.2 0.2 0.2"
  );
  drawText(
    `For ${invoice.seller.legalName}`,
    width - margin,
    margin + 28,
    "F2",
    7.5,
    "right"
  );
  drawText(
    "Authorized Signatory",
    width - margin,
    margin + 16,
    "F1",
    7,
    "right",
    "0.4 0.4 0.4"
  );

  // --- 7. Assemble PDF 1.4 Binary Structure ---
  const contentStream = ops.join("\n");
  const streamLength = Buffer.byteLength(contentStream, "utf-8");

  const objects: string[] = [];

  // Object 1: Catalog
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Object 2: Pages
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  // Object 3: Page
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n`
  );

  // Object 4: Helvetica
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  // Object 5: Helvetica-Bold
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

  // Object 6: Contents Stream
  objects.push(
    `6 0 obj\n<< /Length ${streamLength} >>\nstream\n${contentStream}\nendstream\nendobj\n`
  );

  // Calculate Xref offsets
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  let currentOffset = Buffer.byteLength(header, "utf-8");
  const offsets: number[] = [0];

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj, "utf-8");
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    const offsetStr = String(offsets[i]).padStart(10, "0");
    xref += `${offsetStr} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${currentOffset}\n%%EOF\n`;

  const completePdf = header + objects.join("") + xref + trailer;
  return Buffer.from(completePdf, "utf-8");
}
