import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getR2Client, getR2BucketName, isR2Configured } from "@/lib/storage/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export async function GET(
  req: NextRequest,
  { params }: { params: any }
) {
  try {
    await requireAdmin();

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      select: { invoiceR2Key: true, invoiceNumber: true },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    if (!order.invoiceR2Key) {
      return NextResponse.json({ error: "Invoice not generated yet" }, { status: 404 });
    }

    if (!isR2Configured()) {
      return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
    }

    const r2 = getR2Client();
    const bucketName = getR2BucketName();

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: order.invoiceR2Key,
    });

    const data = await r2.send(command);

    if (!data.Body) {
      return NextResponse.json({ error: "Invoice file is empty" }, { status: 404 });
    }

    // Convert WebStream/NodeStream to Response
    const response = new NextResponse(data.Body as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${order.invoiceNumber}.pdf"`,
      },
    });

    return response;
  } catch (error: any) {
    console.error("Failed to download invoice:", error);
    if (error.name === "ForbiddenError" || error.name === "AuthError") {
      return NextResponse.json(
        { error: error.message },
        { status: error.name === "AuthError" ? 401 : 403 }
      );
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
