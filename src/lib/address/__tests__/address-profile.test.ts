import assert from "node:assert";
import { prisma } from "@/lib/prisma";
import { 
  createAddress, 
  updateAddress, 
  deleteAddress, 
  setDefaultShippingAddress, 
  listAddresses 
} from "../address-service";
import { UnauthorizedError, NotFoundError } from "@/lib/errors";

export async function runAddressProfileTests() {
  console.log("--> Running Micro-Phase 09.01: Profile + Address Management Tests...");

  // 1. Setup Test Users
  const user1 = await prisma.user.create({
    data: { name: "Test User 1", email: "test1@example.com", phone: "1111111111", customer: { create: {} } },
    include: { customer: true }
  });
  
  const user2 = await prisma.user.create({
    data: { name: "Test User 2", email: "test2@example.com", phone: "2222222222", customer: { create: {} } },
    include: { customer: true }
  });

  const customer1 = user1.customer!;
  const customer2 = user2.customer!;

  try {
    // 2. Customer can create an address
    console.log("  1. Testing address creation...");
    const addr1 = await createAddress({
      firstName: "User", lastName: "One", addressLine1: "123 Main St", city: "Mumbai", state: "MH", postalCode: "400001", phone: "1111111111"
    }, customer1.id);
    
    assert.strictEqual(addr1.firstName, "User");
    assert.strictEqual(addr1.customerId, customer1.id);

    // 3. Customer can update their own address
    console.log("  2. Testing address update...");
    const updatedAddr1 = await updateAddress(addr1.id, { firstName: "Updated" }, customer1.id);
    assert.strictEqual(updatedAddr1.firstName, "Updated");

    // 4. Customer cannot access another customer's address
    console.log("  3. Testing cross-customer access prevention...");
    await assert.rejects(
      async () => await updateAddress(addr1.id, { firstName: "Hacked" }, customer2.id),
      UnauthorizedError
    );
    await assert.rejects(
      async () => await deleteAddress(addr1.id, customer2.id),
      UnauthorizedError
    );

    // 5. Customer can set a default address & Only one default address exists
    console.log("  4. Testing default address logic...");
    const addr2 = await createAddress({
      firstName: "Second", lastName: "Addr", addressLine1: "456 Side St", city: "Mumbai", state: "MH", postalCode: "400001", phone: "1111111111"
    }, customer1.id);
    
    await setDefaultShippingAddress(addr2.id, customer1.id);
    
    const addresses = await listAddresses(customer1.id);
    assert.strictEqual(addresses.length, 2);
    const defaults = addresses.filter(a => a.isDefaultShipping);
    assert.strictEqual(defaults.length, 1);
    assert.strictEqual(defaults[0].id, addr2.id);

    // 6. Customer can delete their own address
    console.log("  5. Testing address deletion...");
    await deleteAddress(addr1.id, customer1.id);
    const addressesAfterDelete = await listAddresses(customer1.id);
    assert.strictEqual(addressesAfterDelete.length, 1);

    // 7. Profile update tests
    console.log("  6. Testing profile update...");
    const updatedUser = await prisma.user.update({
      where: { id: user1.id },
      data: { name: "New Name" }
    });
    assert.strictEqual(updatedUser.name, "New Name");

    console.log("  ✔ All Profile + Address tests passed successfully!");
  } finally {
    // Cleanup
    await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });
  }
}
