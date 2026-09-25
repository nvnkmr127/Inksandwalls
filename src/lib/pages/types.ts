import { z } from "zod";
import { PostStatus } from "@prisma/client";

export const createPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(100, "Title is too long"),
  slug: z.string().min(1, "Slug is required")
    .regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase letters, numbers, and hyphens"),
  content: z.string().min(1, "Content is required"),
  status: z.nativeEnum(PostStatus).default(PostStatus.DRAFT),
});

export const updatePageSchema = createPageSchema.partial();

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;

export interface PageView {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: PostStatus;
  createdAt: string;
  updatedAt: string;
}
