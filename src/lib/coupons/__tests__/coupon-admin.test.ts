import assert from "node:assert";
import { DiscountType, Role } from "@prisma/client";
import { validateCouponInput } from "../validation";
import {
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponById,
  listCoupons,
  getCouponUsages,
} from "../coupon-service";
import { hasPermission } from "@/lib/auth/permissions";
import { ValidationError } from "@/lib/errors";
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from "@/lib/audit/actions";
import { prisma } from "@/lib/prisma";

export async function runCouponAdminTests() {
  console.log("--> Running Micro-Phase 06.04: Coupon Admin Tests...");

  // =========================================================================
  // Section 1: Coupon Input Validation Unit Tests
  // =========================================================================
  console.log("  1. Testing Coupon Input Validation & Normalization...");

  // 1.1 Valid Percentage Coupon
  const validPercent = validateCouponInput({
    code: " festive20 ",
    discountType: "PERCENTAGE",
    discountValue: 20,
    minCartValuePaise: 100000,
    maxDiscountPaise: 50000,
    startDate: "2026-10-01T00:00:00Z",
    expiryDate: "2026-10-31T23:59:59Z",
    usageLimit: 100,
    perCustomerLimit: 2,
    isActive: true,
  });

  assert.strictEqual(validPercent.code, "FESTIVE20");
  assert.strictEqual(validPercent.discountType, DiscountType.PERCENTAGE);
  assert.strictEqual(validPercent.discountValue, 20);
  assert.strictEqual(validPercent.minCartValuePaise, 100000);
  assert.strictEqual(validPercent.maxDiscountPaise, 50000);
  assert.strictEqual(validPercent.usageLimit, 100);
  assert.strictEqual(validPercent.perCustomerLimit, 2);
  assert.strictEqual(validPercent.isActive, true);
  assert(validPercent.startDate instanceof Date);
  assert(validPercent.expiryDate instanceof Date);

  // 1.2 Valid Fixed Amount Coupon (maxDiscount should be ignored/null)
  const validFixed = validateCouponInput({
    code: "FLAT500",
    discountType: DiscountType.FIXED_AMOUNT,
    discountValue: 50000, // ₹500 in paise
    minCartValuePaise: 200000,
    maxDiscountPaise: 100000, // Should be nullified for FIXED_AMOUNT
    isActive: false,
  });

  assert.strictEqual(validFixed.code, "FLAT500");
  assert.strictEqual(validFixed.discountType, DiscountType.FIXED_AMOUNT);
  assert.strictEqual(validFixed.discountValue, 50000);
  assert.strictEqual(validFixed.maxDiscountPaise, null);
  assert.strictEqual(validFixed.isActive, false);

  // 1.3 Validation Errors: Missing / Invalid Code
  assert.throws(() => validateCouponInput({ code: "" }), ValidationError);
  assert.throws(() => validateCouponInput({ code: "A" }), ValidationError); // too short
  assert.throws(() => validateCouponInput({ code: "INVALID CODE WITH SPACES" }), ValidationError);
  assert.throws(() => validateCouponInput({ code: "SPECIAL@!#$" }), ValidationError);

  // 1.4 Validation Errors: Percentage bounds
  assert.throws(
    () => validateCouponInput({ code: "ZERO_PCT", discountType: "PERCENTAGE", discountValue: 0 }),
    ValidationError
  );
  assert.throws(
    () => validateCouponInput({ code: "NEG_PCT", discountType: "PERCENTAGE", discountValue: -10 }),
    ValidationError
  );
  assert.throws(
    () => validateCouponInput({ code: "OVER_PCT", discountType: "PERCENTAGE", discountValue: 101 }),
    ValidationError
  );

  // 1.5 Validation Errors: Fixed amount bounds
  assert.throws(
    () => validateCouponInput({ code: "ZERO_FIXED", discountType: "FIXED_AMOUNT", discountValue: 0 }),
    ValidationError
  );
  assert.throws(
    () => validateCouponInput({ code: "NEG_FIXED", discountType: "FIXED_AMOUNT", discountValue: -500 }),
    ValidationError
  );

  // 1.6 Validation Errors: Invalid Date relationships
  assert.throws(
    () =>
      validateCouponInput({
        code: "INVALID_DATES",
        discountType: "PERCENTAGE",
        discountValue: 10,
        startDate: "2026-10-31T00:00:00Z",
        expiryDate: "2026-10-01T00:00:00Z", // Expiry before start date
      }),
    ValidationError
  );

  // 1.7 Validation Errors: Invalid usage limits
  assert.throws(
    () =>
      validateCouponInput({
        code: "INVALID_LIMIT",
        discountType: "PERCENTAGE",
        discountValue: 10,
        usageLimit: 0,
      }),
    ValidationError
  );
  assert.throws(
    () =>
      validateCouponInput({
        code: "INVALID_CUST_LIMIT",
        discountType: "PERCENTAGE",
        discountValue: 10,
        perCustomerLimit: -1,
      }),
    ValidationError
  );

  // =========================================================================
  // Section 2: RBAC and Permission Checks
  // =========================================================================
  console.log("  2. Testing RBAC Coupon Permissions...");

  assert.strictEqual(hasPermission(Role.STORE_ADMIN, "coupons.read"), true);
  assert.strictEqual(hasPermission(Role.STORE_ADMIN, "coupons.write"), true);
  assert.strictEqual(hasPermission(Role.SUPER_ADMIN, "coupons.read"), true);
  assert.strictEqual(hasPermission(Role.SUPER_ADMIN, "coupons.write"), true);
  assert.strictEqual(hasPermission(Role.CUSTOMER, "coupons.read"), false);
  assert.strictEqual(hasPermission(Role.CUSTOMER, "coupons.write"), false);
  assert.strictEqual(hasPermission(Role.GUEST, "coupons.read"), false);
  assert.strictEqual(hasPermission(Role.GUEST, "coupons.write"), false);

  // =========================================================================
  // Section 3: Coupon Service Database & Audit Operations
  // =========================================================================
  console.log("  3. Testing Coupon Service CRUD, Audit Logging & Delete Safeguards...");

  interface MockCouponRecord {
    id: string;
    code: string;
    discountType: DiscountType;
    discountValue: number;
    minCartValuePaise: number | null;
    maxDiscountPaise: number | null;
    startDate: Date | null;
    expiryDate: Date | null;
    usageLimit: number | null;
    perCustomerLimit: number | null;
    currentUsageCount: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }

  interface MockUsageRecord {
    id: string;
    couponId: string;
    customerId: string | null;
    cartId: string | null;
    usedAt: Date;
  }

  interface MockAuditRecord {
    id: string;
    actorUserId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }

  const couponsDb: MockCouponRecord[] = [];
  const usagesDb: MockUsageRecord[] = [];
  const auditDb: MockAuditRecord[] = [];

  const origPrisma = {
    couponFindUnique: prisma.coupon.findUnique,
    couponFindFirst: prisma.coupon.findFirst,
    couponFindMany: prisma.coupon.findMany,
    couponCreate: prisma.coupon.create,
    couponUpdate: prisma.coupon.update,
    couponDelete: prisma.coupon.delete,
    couponCount: prisma.coupon.count,
    couponUsageFindMany: prisma.couponUsage.findMany,
    couponUsageCount: prisma.couponUsage.count,
    auditLogCreate: prisma.auditLog.create,
    transaction: prisma.$transaction,
  };

  const adminActor = {
    id: "usr_admin_test",
    name: "Admin User",
    email: "admin@inksandwalls.com",
    role: Role.STORE_ADMIN,
    status: "ACTIVE" as const,
  };

  const reqContext = {
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0 Unit Test",
  };

  try {
    (prisma.coupon.findUnique as unknown) = async (args: {
      where: { code?: string; id?: string };
      include?: Record<string, unknown>;
    }) => {
      let match: MockCouponRecord | undefined;
      if (args.where.id) {
        match = couponsDb.find((c) => c.id === args.where.id);
      } else if (args.where.code) {
        match = couponsDb.find((c) => c.code === args.where.code);
      }
      if (!match) return null;

      const result: Record<string, unknown> = { ...match };
      if (args.include?._count) {
        const usageCount = usagesDb.filter((u) => u.couponId === match!.id).length;
        result._count = { usages: usageCount, carts: 0 };
      }
      if (args.include?.usages) {
        result.usages = usagesDb
          .filter((u) => u.couponId === match!.id)
          .map((u) => ({
            ...u,
            customer: {
              user: {
                id: "usr-cust-1",
                name: "Customer Rohan",
                email: "rohan@test.com",
                phone: "+919876543210",
              },
            },
          }));
      }
      return result;
    };

    (prisma.coupon.findFirst as unknown) = async (args: {
      where: { code?: string; NOT?: { id?: string } };
    }) => {
      return (
        couponsDb.find((c) => {
          if (args.where.code && c.code !== args.where.code) return false;
          if (args.where.NOT?.id && c.id === args.where.NOT.id) return false;
          return true;
        }) || null
      );
    };

    (prisma.coupon.create as unknown) = async (args: { data: Record<string, unknown> }) => {
      const newRec: MockCouponRecord = {
        id: `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: args.data.code as string,
        discountType: args.data.discountType as DiscountType,
        discountValue: args.data.discountValue as number,
        minCartValuePaise: (args.data.minCartValuePaise as number) || null,
        maxDiscountPaise: (args.data.maxDiscountPaise as number) || null,
        startDate: (args.data.startDate as Date) || null,
        expiryDate: (args.data.expiryDate as Date) || null,
        usageLimit: (args.data.usageLimit as number) || null,
        perCustomerLimit: (args.data.perCustomerLimit as number) || null,
        currentUsageCount: 0,
        isActive: args.data.isActive !== undefined ? (args.data.isActive as boolean) : true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      couponsDb.push(newRec);
      return newRec;
    };

    (prisma.coupon.update as unknown) = async (args: {
      where: { id: string };
      data: Partial<MockCouponRecord>;
    }) => {
      const idx = couponsDb.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error("Coupon not found");
      couponsDb[idx] = { ...couponsDb[idx], ...args.data, updatedAt: new Date() };
      return couponsDb[idx];
    };

    (prisma.coupon.delete as unknown) = async (args: { where: { id: string } }) => {
      const idx = couponsDb.findIndex((c) => c.id === args.where.id);
      if (idx === -1) throw new Error("Coupon not found");
      const [removed] = couponsDb.splice(idx, 1);
      return removed;
    };

    (prisma.coupon.count as unknown) = async () => {
      return couponsDb.length;
    };

    (prisma.coupon.findMany as unknown) = async (args: {
      where?: Record<string, unknown>;
      orderBy?: Record<string, "asc" | "desc">;
      skip?: number;
      take?: number;
    }) => {
      let filtered = [...couponsDb];
      if (args.where?.code && typeof args.where.code === "object") {
        const codeFilter = args.where.code as { contains?: string };
        if (codeFilter.contains) {
          const search = codeFilter.contains.toLowerCase();
          filtered = filtered.filter((c) => c.code.toLowerCase().includes(search));
        }
      }
      if (args.where?.isActive !== undefined) {
        filtered = filtered.filter((c) => c.isActive === args.where!.isActive);
      }
      if (args.where?.discountType) {
        filtered = filtered.filter((c) => c.discountType === args.where!.discountType);
      }
      const skip = args.skip || 0;
      const take = args.take || filtered.length;
      return filtered.slice(skip, skip + take);
    };

    (prisma.couponUsage.count as unknown) = async (args: { where: { couponId: string } }) => {
      return usagesDb.filter((u) => u.couponId === args.where.couponId).length;
    };

    (prisma.couponUsage.findMany as unknown) = async (args: {
      where: { couponId: string };
      skip?: number;
      take?: number;
    }) => {
      const items = usagesDb.filter((u) => u.couponId === args.where.couponId);
      const skip = args.skip || 0;
      const take = args.take || items.length;
      return items.slice(skip, skip + take).map((u) => ({
        ...u,
        customer: {
          user: {
            id: "usr-cust-1",
            name: "Customer Rohan",
            email: "rohan@test.com",
            phone: "+919876543210",
          },
        },
      }));
    };

    (prisma.auditLog.create as unknown) = async (args: { data: Record<string, unknown> }) => {
      const rec: MockAuditRecord = {
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        actorUserId: (args.data.actorUserId as string) || null,
        action: args.data.action as string,
        resourceType: args.data.resourceType as string,
        resourceId: (args.data.resourceId as string) || null,
        metadata: args.data.metadata,
        ipAddress: (args.data.ipAddress as string) || null,
        userAgent: (args.data.userAgent as string) || null,
        createdAt: new Date(),
      };
      auditDb.push(rec);
      return rec;
    };

    (prisma.$transaction as unknown) = async (
      cb: Promise<unknown>[] | ((tx: typeof prisma) => Promise<unknown>)
    ) => {
      if (Array.isArray(cb)) {
        const results = [];
        for (const op of cb) {
          results.push(await op);
        }
        return results;
      }
      return cb(prisma);
    };

    // 3.1 Test Create Coupon
    const createdCoupon = await createCoupon(
      {
        code: "diwali2026",
        discountType: "PERCENTAGE",
        discountValue: 15,
        minCartValuePaise: 250000,
        maxDiscountPaise: 100000,
        startDate: "2026-10-15T00:00:00Z",
        expiryDate: "2026-11-15T23:59:59Z",
        usageLimit: 500,
        perCustomerLimit: 1,
        isActive: true,
      },
      adminActor,
      reqContext
    );

    assert.strictEqual(createdCoupon.code, "DIWALI2026");
    assert.strictEqual(createdCoupon.discountValue, 15);
    assert.strictEqual(couponsDb.length, 1);

    // Verify Audit Log for CREATE
    const createAudit = auditDb.find((a) => a.action === AUDIT_ACTIONS.COUPON_CREATED);
    assert(createAudit !== undefined);
    assert.strictEqual(createAudit.resourceType, AUDIT_RESOURCE_TYPES.COUPON);
    assert.strictEqual(createAudit.actorUserId, adminActor.id);
    assert.strictEqual(createAudit.ipAddress, reqContext.ipAddress);

    // 3.2 Test Unique Code Constraint on Create
    await assert.rejects(
      async () =>
        await createCoupon(
          {
            code: "DIWALI2026",
            discountType: "PERCENTAGE",
            discountValue: 20,
          },
          adminActor,
          reqContext
        ),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /already exists/i);
        return true;
      }
    );

    // 3.3 Test Get Coupon By ID
    const fetchedCoupon = await getCouponById(createdCoupon.id);
    assert.strictEqual(fetchedCoupon.id, createdCoupon.id);
    assert.strictEqual(fetchedCoupon.code, "DIWALI2026");

    // 3.4 Test Update Coupon & Deactivate
    const updatedCoupon = await updateCoupon(
      createdCoupon.id,
      {
        code: "DIWALI2026_V2",
        discountType: "PERCENTAGE",
        discountValue: 20,
        minCartValuePaise: 200000,
        maxDiscountPaise: 100000,
        isActive: false, // Deactivating
      },
      adminActor,
      reqContext
    );

    assert.strictEqual(updatedCoupon.code, "DIWALI2026_V2");
    assert.strictEqual(updatedCoupon.discountValue, 20);
    assert.strictEqual(updatedCoupon.isActive, false);

    // Verify Audit Log for DEACTIVATED
    const deactAudit = auditDb.find((a) => a.action === AUDIT_ACTIONS.COUPON_DEACTIVATED);
    assert(deactAudit !== undefined);
    assert.strictEqual(deactAudit.resourceId, createdCoupon.id);

    // 3.5 Test Reactivate Coupon
    await updateCoupon(
      createdCoupon.id,
      {
        code: "DIWALI2026_V2",
        discountType: "PERCENTAGE",
        discountValue: 20,
        isActive: true, // Activating back
      },
      adminActor,
      reqContext
    );
    const actAudit = auditDb.find((a) => a.action === AUDIT_ACTIONS.COUPON_ACTIVATED);
    assert(actAudit !== undefined);

    // 3.6 Test Delete Protection when historical usage exists
    // Create another coupon and simulate usage
    const couponWithUsage = await createCoupon(
      {
        code: "USED_COUPON",
        discountType: "FIXED_AMOUNT",
        discountValue: 50000,
      },
      adminActor,
      reqContext
    );

    // Record usage
    usagesDb.push({
      id: "usg_101",
      couponId: couponWithUsage.id,
      customerId: "cust_1",
      cartId: "cart_1",
      usedAt: new Date(),
    });
    couponWithUsage.currentUsageCount = 1;

    // Attempting to delete must throw ValidationError
    await assert.rejects(
      async () => await deleteCoupon(couponWithUsage.id, adminActor, reqContext),
      (err: Error) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /cannot delete a coupon that has been redeemed/i);
        return true;
      }
    );

    // 3.7 Test Delete Allowed when NO usages exist
    const unusedCoupon = await createCoupon(
      {
        code: "UNUSED_COUPON",
        discountType: "PERCENTAGE",
        discountValue: 10,
      },
      adminActor,
      reqContext
    );

    const deleted = await deleteCoupon(unusedCoupon.id, adminActor, reqContext);
    assert.strictEqual(deleted.id, unusedCoupon.id);
    const deleteAudit = auditDb.find((a) => a.action === AUDIT_ACTIONS.COUPON_DELETED);
    assert(deleteAudit !== undefined);
    assert.strictEqual(deleteAudit.resourceId, unusedCoupon.id);

    // =========================================================================
    // Section 4: Query Search, Filters, Sorting & Pagination
    // =========================================================================
    console.log("  4. Testing List Query, Search, Filters, Whitelist Sorting & Pagination...");

    // Create a few more coupons for query testing
    await createCoupon(
      {
        code: "SUMMER50",
        discountType: "FIXED_AMOUNT",
        discountValue: 5000,
        isActive: true,
      },
      adminActor,
      reqContext
    );

    await createCoupon(
      {
        code: "WINTER10",
        discountType: "PERCENTAGE",
        discountValue: 10,
        isActive: false,
      },
      adminActor,
      reqContext
    );

    // Search by code
    const searchRes = await listCoupons({ search: "summer" });
    assert(searchRes.items.some((c) => c.code === "SUMMER50"));

    // Filter by discountType
    const typeRes = await listCoupons({ discountType: "FIXED_AMOUNT" });
    assert(typeRes.items.every((c) => c.discountType === "FIXED_AMOUNT"));

    // Pagination calculations
    const pageRes = await listCoupons({ page: 1, pageSize: 2 });
    assert.strictEqual(pageRes.pageSize, 2);
    assert.strictEqual(pageRes.page, 1);

    // Usages query
    const usagesResult = await getCouponUsages(couponWithUsage.id, 1, 10);
    assert.strictEqual(usagesResult.totalCount, 1);
    assert.strictEqual(usagesResult.items.length, 1);
    assert.strictEqual(usagesResult.items[0].couponId, couponWithUsage.id);

    console.log("  ✔ All Micro-Phase 06.04: Coupon Admin tests passed successfully!");
  } finally {
    // Restore prisma methods
    prisma.coupon.findUnique = origPrisma.couponFindUnique;
    prisma.coupon.findFirst = origPrisma.couponFindFirst;
    prisma.coupon.findMany = origPrisma.couponFindMany;
    prisma.coupon.create = origPrisma.couponCreate;
    prisma.coupon.update = origPrisma.couponUpdate;
    prisma.coupon.delete = origPrisma.couponDelete;
    prisma.coupon.count = origPrisma.couponCount;
    prisma.couponUsage.findMany = origPrisma.couponUsageFindMany;
    prisma.couponUsage.count = origPrisma.couponUsageCount;
    prisma.auditLog.create = origPrisma.auditLogCreate;
    prisma.$transaction = origPrisma.transaction;
  }
}
