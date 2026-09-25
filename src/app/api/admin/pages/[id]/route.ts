import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/guards";
import { updatePageSchema } from "@/lib/pages/types";
import { createErrorResponse } from "@/lib/errors";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const page = await prisma.page.findUnique({ where: { id: resolvedParams.id } });
    if (!page) return NextResponse.json({ error: { message: "Page not found" } }, { status: 404 });
    return NextResponse.json(page);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const json = await request.json();
    const data = updatePageSchema.parse(json);

    if (data.slug) {
      const existing = await prisma.page.findFirst({
        where: { slug: data.slug, NOT: { id: resolvedParams.id } },
      });
      if (existing) {
        return NextResponse.json({ error: { message: "Slug is already in use" } }, { status: 409 });
      }
    }

    const page = await prisma.page.update({
      where: { id: resolvedParams.id },
      data,
    });
    return NextResponse.json(page);
  } catch (error) {
    return createErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const resolvedParams = await params;
    const page = await prisma.page.findUnique({ where: { id: resolvedParams.id } });
    if (!page) return NextResponse.json({ error: { message: "Page not found" } }, { status: 404 });
    
    const requiredSlugs = ["shipping", "returns", "privacy", "terms", "about", "contact"];
    if (requiredSlugs.includes(page.slug)) {
      return NextResponse.json({ error: { message: "Cannot delete a core system page" } }, { status: 403 });
    }
    
    await prisma.page.delete({ where: { id: resolvedParams.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return createErrorResponse(error);
  }
}
