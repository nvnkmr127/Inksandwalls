import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { updateBlogPostSchema } from "@/lib/blog/types";
import { createErrorResponse, NotFoundError } from "@/lib/errors";
import { recordAuditEvent, extractRequestContext } from "@/lib/audit/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const reqContext = extractRequestContext(request);

    const json = await request.json();
    const data = updateBlogPostSchema.parse(json);

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) throw new NotFoundError("Blog post not found");

    if (data.slug && data.slug !== existing.slug) {
      const slugConflict = await prisma.blogPost.findUnique({
        where: { slug: data.slug },
      });
      if (slugConflict) {
        return NextResponse.json(
          { error: { message: "Slug is already in use", code: "CONFLICT" } },
          { status: 409 }
        );
      }
    }

    let publishedAt = existing.publishedAt;
    if (data.status === "PUBLISHED" && existing.status !== "PUBLISHED") {
      publishedAt = new Date();
    } else if (data.status === "DRAFT" && existing.status !== "DRAFT") {
      publishedAt = null;
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...data,
        publishedAt,
      },
    });

    await recordAuditEvent({
      actorUserId: actor.id,
      action: "UPDATE",
      resourceType: "BLOG_POST",
      resourceId: post.id,
      metadata: { from: existing.status, to: post.status },
      ...reqContext,
    });

    return NextResponse.json(post);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireAdmin();
    const { id } = await params;
    const reqContext = extractRequestContext(request);

    const existing = await prisma.blogPost.findUnique({
      where: { id },
    });

    if (!existing) throw new NotFoundError("Blog post not found");

    await prisma.blogPost.delete({ where: { id } });

    await recordAuditEvent({
      actorUserId: actor.id,
      action: "DELETE",
      resourceType: "BLOG_POST",
      resourceId: id,
      ...reqContext,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return createErrorResponse(error);
  }
}
