import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { createBlogPostSchema } from "@/lib/blog/types";
import { createErrorResponse } from "@/lib/errors";
import { recordAuditEvent, extractRequestContext } from "@/lib/audit/audit";

export async function GET(request: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) {
      where.status = status;
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      data: posts,
      metadata: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin();
    const reqContext = extractRequestContext(request);

    const json = await request.json();
    const data = createBlogPostSchema.parse(json);

    const existing = await prisma.blogPost.findUnique({
      where: { slug: data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: { message: "Slug is already in use", code: "CONFLICT" } },
        { status: 409 }
      );
    }

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        publishedAt: data.status === "PUBLISHED" ? new Date() : null,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      action: "CREATE",
      resourceType: "BLOG_POST",
      resourceId: post.id,
      ...reqContext,
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
