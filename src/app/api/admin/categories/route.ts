import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { createCategory, listCategories } from "@/lib/categories/category-service";
import { createErrorResponse } from "@/lib/errors";
import { extractRequestContext } from "@/lib/audit/audit";
import { getCorrelationId } from "@/lib/correlation";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const sort = searchParams.get("sort") || undefined;
    const order = (searchParams.get("order") || undefined) as "asc" | "desc" | undefined;

    const result = await listCategories({
      page,
      pageSize,
      search,
      status,
      sort,
      order,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCategoryAPI");
  }
}

export async function POST(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    const actor = await requireAdmin();
    const body = await request.json();
    const reqContext = extractRequestContext(request);

    const category = await createCategory(body, actor, reqContext);

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminCategoryAPI");
  }
}
