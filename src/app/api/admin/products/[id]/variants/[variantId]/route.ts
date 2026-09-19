import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import {
  getVariantById,
  updateProductVariant,
  deleteProductVariant,
} from "@/lib/product-variants/variant-service";
import { createErrorResponse, ValidationError } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();
    const { id: productId, variantId } = await params;

    const variant = await getVariantById(variantId);
    if (variant.productId !== productId) {
      throw new ValidationError("Variant does not belong to the specified product.");
    }

    return NextResponse.json(variant, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductVariantItemAPI");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId, variantId } = await params;

    // IDOR protection check: verify variant belongs to product
    const existing = await getVariantById(variantId);
    if (existing.productId !== productId) {
      throw new ValidationError("Variant does not belong to the specified product.");
    }

    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const updated = await updateProductVariant(variantId, body, actor, reqContext);
    return NextResponse.json(updated, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductVariantItemAPI");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const { id: productId, variantId } = await params;

    // IDOR protection check: verify variant belongs to product
    const existing = await getVariantById(variantId);
    if (existing.productId !== productId) {
      throw new ValidationError("Variant does not belong to the specified product.");
    }

    const reqContext = extractRequestContext(request);
    const deleted = await deleteProductVariant(variantId, actor, reqContext);

    return NextResponse.json(deleted, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminProductVariantItemAPI");
  }
}
