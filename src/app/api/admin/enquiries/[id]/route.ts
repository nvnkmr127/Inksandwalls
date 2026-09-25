import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { createErrorResponse, NotFoundError } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { recordAuditEvent, extractRequestContext } from "@/lib/audit/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const existing = await prisma.enquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Enquiry not found");
    }

    const updated = await prisma.enquiry.update({
      where: { id },
      data: {
        status: body.status,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      action: "UPDATE",
      resourceType: "ENQUIRY",
      resourceId: id,
      metadata: { from: existing.status, to: updated.status },
      ...reqContext,
    });

    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminEnquiryAPI");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const reqContext = extractRequestContext(request);

    const existing = await prisma.enquiry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Enquiry not found");
    }

    await prisma.enquiry.delete({ where: { id } });

    await recordAuditEvent({
      actorUserId: actor.id,
      action: "DELETE",
      resourceType: "ENQUIRY",
      resourceId: id,
      ...reqContext,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminEnquiryAPI");
  }
}
