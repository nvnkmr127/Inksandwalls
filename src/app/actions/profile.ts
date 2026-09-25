"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional().nullable().or(z.literal("")),
  email: z.string().email("Invalid email address").optional().nullable().or(z.literal("")),
  phone: z.string().regex(/^\d{10}$/, "Must be a 10 digit number").optional().nullable().or(z.literal("")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export async function updateProfileAction(
  data: ProfileInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return { success: false, error: "Unauthorized" };
    }

    const validated = profileSchema.parse(data);

    // Update user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name: validated.name || null,
        email: validated.email || null,
        phone: validated.phone || null,
      },
    });

    revalidatePath("/account");
    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0].message };
    }
    const err = error as Record<string, unknown>;
    if (err.code === 'P2002') {
      const target = ((err.meta as Record<string, unknown>)?.target as string[]) || [];
      if (target.includes("email")) {
        return { success: false, error: "Email address is already in use by another account." };
      }
      if (target.includes("phone")) {
        return { success: false, error: "Phone number is already in use by another account." };
      }
      return { success: false, error: "Unique constraint failed. This value is already in use." };
    }
    return { success: false, error: (error as Error).message || "An unexpected error occurred." };
  }
}
