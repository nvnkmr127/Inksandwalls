import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getCollectionById,
  updateCollection,
  deleteCollection,
} from "@/lib/collections/collection-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();
    const { id } = await params;

    const collection = await getCollectionById(id);
    return NextResponse.json(collection, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCollectionItemAPI");
  }
}

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

    const updated = await updateCollection(id, body, actor, reqContext);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCollectionItemAPI");
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

    const deleted = await deleteCollection(id, actor, reqContext);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCollectionItemAPI");
  }
}
