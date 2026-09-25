import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { createErrorResponse } from "@/lib/errors";
import { getCorrelationId } from "@/lib/correlation";
import { Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const correlationId = getCorrelationId(request);

  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 10;
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const sort = searchParams.get("sort") || "createdAt";
    const order = (searchParams.get("order") || "desc") as "asc" | "desc";

    const where: Prisma.EnquiryWhereInput = {};

    if (status && status !== "all") {
      where.status = status.toUpperCase() as any;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { message: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, totalCount] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.enquiry.count({ where }),
    ]);

    return NextResponse.json({ items, totalCount, page, pageSize }, { status: 200 });
  } catch (error) {
    return createErrorResponse(error, correlationId, "AdminEnquiryAPI");
  }
}
