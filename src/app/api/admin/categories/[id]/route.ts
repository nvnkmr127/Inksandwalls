import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "@/lib/categories/category-service";
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

    const category = await getCategoryById(id);
    return NextResponse.json(category, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCategoryItemAPI");
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

    const updated = await updateCategory(id, body, actor, reqContext);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCategoryItemAPI");
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

    const deleted = await deleteCategory(id, actor, reqContext);
    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCategoryItemAPI");
  }
}
