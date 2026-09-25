import "server-only";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";
import { Prisma } from "@prisma/client";

export async function addProductToWishlist(productId: string) {
  const user = await requireAuth();
  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  
  if (!customer) throw new Error("Customer not found");

  const existing = await prisma.wishlist.findUnique({
    where: {
      customerId_productId: { customerId: customer.id, productId }
    }
  });

  if (existing) return existing;

  return prisma.wishlist.create({
    data: {
      customerId: customer.id,
      productId,
    }
  });
}

export async function removeProductFromWishlist(productId: string) {
  const user = await requireAuth();
  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  
  if (!customer) throw new Error("Customer not found");

  try {
    return await prisma.wishlist.delete({
      where: {
        customerId_productId: { customerId: customer.id, productId }
      }
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

export async function checkProductInWishlist(productId: string) {
  try {
    const user = await requireAuth();
    const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (!customer) return false;

    const entry = await prisma.wishlist.findUnique({
      where: {
        customerId_productId: { customerId: customer.id, productId }
      }
    });
    return !!entry;
  } catch (e) {
    return false; // Silently fail for unauthenticated
  }
}

export async function getCustomerWishlist() {
  const user = await requireAuth();
  const customer = await prisma.customer.findUnique({ where: { userId: user.id } });
  
  if (!customer) return [];

  return prisma.wishlist.findMany({
    where: { customerId: customer.id },
    include: {
      product: {
        include: {
          media: {
            where: { isPrimary: true },
            take: 1
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}
