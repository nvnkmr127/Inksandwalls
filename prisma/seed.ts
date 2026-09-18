import { PrismaClient, Role, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding development identities for Phase 03.01...");

  // 1. Customer Seed User
  const customerUser = await prisma.user.upsert({
    where: { email: "customer@inksandwalls.dev" },
    update: {
      phone: "+919876543210",
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: "Dev Customer",
      email: "customer@inksandwalls.dev",
      phone: "+919876543210",
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      customer: {
        create: {},
      },
    },
    include: { customer: true },
  });

  if (!customerUser.customer) {
    await prisma.customer.create({
      data: { userId: customerUser.id },
    });
  }

  // 2. Store Admin Seed User
  await prisma.user.upsert({
    where: { email: "admin@inksandwalls.dev" },
    update: {
      phone: "+919876543211",
      role: Role.STORE_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: "Dev Store Admin",
      email: "admin@inksandwalls.dev",
      phone: "+919876543211",
      role: Role.STORE_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // 3. Super Admin Seed User
  await prisma.user.upsert({
    where: { email: "superadmin@inksandwalls.dev" },
    update: {
      phone: "+919876543212",
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      name: "Dev Super Admin",
      email: "superadmin@inksandwalls.dev",
      phone: "+919876543212",
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  console.log("✓ Seeded development roles cleanly (CUSTOMER, STORE_ADMIN, SUPER_ADMIN).");
}

main()
  .catch((e) => {
    console.error("Error during database seed execution:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
