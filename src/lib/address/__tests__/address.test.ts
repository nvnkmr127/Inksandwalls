import assert from "node:assert";
import { validateAddressInput } from "../address-schema";
import { ValidationError } from "@/lib/errors";

export function runAddressTests() {
  console.log("--> Running Micro-Phase 07.01 & 07.02: Address Validation Tests...");

  // -------------------------------------------------------------
  // Test 1: Valid Indian Address Input
  // -------------------------------------------------------------
  console.log("  1. Testing Valid Address Input...");
  const valid = validateAddressInput({
    firstName: "Rohan",
    lastName: "Sharma",
    addressLine1: "Flat 402, Sunshine Apartments",
    addressLine2: "Road No. 12, Banjara Hills",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500034",
    phone: "9876543210",
  });

  assert.strictEqual(valid.firstName, "Rohan");
  assert.strictEqual(valid.lastName, "Sharma");
  assert.strictEqual(valid.postalCode, "500034");
  assert.strictEqual(valid.phone, "+919876543210");
  assert.strictEqual(valid.country, "IN");

  // -------------------------------------------------------------
  // Test 2: Missing Required Fields Rejection
  // -------------------------------------------------------------
  console.log("  2. Testing Missing Required Fields...");
  assert.throws(
    () => validateAddressInput({ lastName: "Sharma", postalCode: "500001" }),
    ValidationError
  );
  assert.throws(
    () =>
      validateAddressInput({
        firstName: "Rohan",
        lastName: "Sharma",
        addressLine1: "",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "500001",
      }),
    ValidationError
  );

  // -------------------------------------------------------------
  // Test 3: Invalid PIN Code Rejection
  // -------------------------------------------------------------
  console.log("  3. Testing Invalid PIN Code Rejection...");
  assert.throws(
    () =>
      validateAddressInput({
        firstName: "Rohan",
        lastName: "Sharma",
        addressLine1: "Road 1",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "012345", // Starts with 0
      }),
    ValidationError
  );

  assert.throws(
    () =>
      validateAddressInput({
        firstName: "Rohan",
        lastName: "Sharma",
        addressLine1: "Road 1",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "5000A1", // Non-digit
      }),
    ValidationError
  );

  // -------------------------------------------------------------
  // Test 4: Phone Normalization & Validation
  // -------------------------------------------------------------
  console.log("  4. Testing Phone Number Formatting...");
  const phoneFormatted = validateAddressInput({
    firstName: "Rohan",
    lastName: "Sharma",
    addressLine1: "Road 1",
    city: "Hyderabad",
    state: "Telangana",
    postalCode: "500001",
    phone: "+91 98765 43210",
  });
  assert.strictEqual(phoneFormatted.phone, "+919876543210");

  assert.throws(
    () =>
      validateAddressInput({
        firstName: "Rohan",
        lastName: "Sharma",
        addressLine1: "Road 1",
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "500001",
        phone: "12345", // Too short
      }),
    ValidationError
  );

  console.log("  ✔ All Address Validation tests passed successfully!");
}
