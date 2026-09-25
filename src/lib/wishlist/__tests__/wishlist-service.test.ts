import { addProductToWishlist, removeProductFromWishlist, checkProductInWishlist, getCustomerWishlist } from "../wishlist-service";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/guards";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: jest.fn(),
    },
    wishlist: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/auth/guards", () => ({
  requireAuth: jest.fn(),
}));

describe("Wishlist Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addProductToWishlist", () => {
    it("adds a product successfully", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.wishlist.create as jest.Mock).mockResolvedValue({ id: "w_1", customerId: "cust_1", productId: "prod_1" });

      const result = await addProductToWishlist("prod_1");
      expect(result.id).toBe("w_1");
      expect(prisma.wishlist.create).toHaveBeenCalledWith({
        data: { customerId: "cust_1", productId: "prod_1" },
      });
    });

    it("returns existing entry if already wishlisted", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.findUnique as jest.Mock).mockResolvedValue({ id: "w_1", customerId: "cust_1", productId: "prod_1" });

      const result = await addProductToWishlist("prod_1");
      expect(result.id).toBe("w_1");
      expect(prisma.wishlist.create).not.toHaveBeenCalled();
    });
  });

  describe("removeProductFromWishlist", () => {
    it("removes a product successfully", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.delete as jest.Mock).mockResolvedValue({ id: "w_1" });

      const result = await removeProductFromWishlist("prod_1");
      expect(result).not.toBeNull();
      expect(prisma.wishlist.delete).toHaveBeenCalledWith({
        where: { customerId_productId: { customerId: "cust_1", productId: "prod_1" } },
      });
    });
  });

  describe("checkProductInWishlist", () => {
    it("returns true if wishlisted", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.findUnique as jest.Mock).mockResolvedValue({ id: "w_1" });

      const result = await checkProductInWishlist("prod_1");
      expect(result).toBe(true);
    });

    it("returns false if not wishlisted", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkProductInWishlist("prod_1");
      expect(result).toBe(false);
    });

    it("returns false if unauthenticated", async () => {
      (requireAuth as jest.Mock).mockRejectedValue(new Error("Auth error"));
      const result = await checkProductInWishlist("prod_1");
      expect(result).toBe(false);
    });
  });

  describe("getCustomerWishlist", () => {
    it("returns the wishlist for the current customer", async () => {
      (requireAuth as jest.Mock).mockResolvedValue({ id: "user_1" });
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue({ id: "cust_1", userId: "user_1" });
      (prisma.wishlist.findMany as jest.Mock).mockResolvedValue([{ id: "w_1" }]);

      const result = await getCustomerWishlist();
      expect(result.length).toBe(1);
      expect(prisma.wishlist.findMany).toHaveBeenCalled();
    });
  });
});
