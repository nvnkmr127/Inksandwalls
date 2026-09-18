import { normalizePhoneNumber, isValidPhoneNumber } from "../../../lib/auth/phone";
import { getSafeCallbackUrl } from "../../../lib/auth/url";
import { authConfig } from "../../../lib/auth/auth.config";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runAuthUiSelfTest() {
  console.log("--> Running Auth UI & Safety foundation self-tests...");

  // 1. Phone Normalization & Validation
  assert(isValidPhoneNumber("9876543210") === true, "Valid 10-digit Indian phone should pass validation");
  assert(isValidPhoneNumber("+919876543210") === true, "Valid +91 phone should pass validation");
  assert(normalizePhoneNumber("98765 43210") === "+919876543210", "Phone normalization should add +91 and strip spaces");
  assert(isValidPhoneNumber("1234567890") === false, "Indian phone starting with 1 should fail validation");
  assert(isValidPhoneNumber("abc1234567") === false, "Alphanumeric phone should fail validation");

  // 2. Open Redirect Safety
  assert(getSafeCallbackUrl("/product/wallpaper-a") === "/product/wallpaper-a", "Safe relative path should be preserved");
  assert(getSafeCallbackUrl("/") === "/", "Root path should be preserved");
  assert(getSafeCallbackUrl(undefined) === "/", "Undefined callbackUrl should fallback to '/'");
  assert(getSafeCallbackUrl("") === "/", "Empty string callbackUrl should fallback to '/'");
  assert(getSafeCallbackUrl("https://evil.com") === "/", "External HTTPS redirect must be rejected");
  assert(getSafeCallbackUrl("http://evil.com/phish") === "/", "External HTTP redirect must be rejected");
  assert(getSafeCallbackUrl("//malicious.com") === "/", "Protocol-relative double-slash redirect must be rejected");
  assert(getSafeCallbackUrl("/\\malicious.com") === "/", "Backslash redirect must be rejected");
  assert(getSafeCallbackUrl("javascript:alert(1)") === "/", "Javascript scheme redirect must be rejected");

  // 3. OTP formatting check
  const testOtpInput = " 123-456 ".replace(/\D/g, "").slice(0, 6);
  assert(testOtpInput === "123456", "OTP input digit filtering must yield 6 numeric digits");

  // 4. Verify Auth Config Page Route
  assert(authConfig.pages?.signIn === "/login", "Auth config signIn page must be set to '/login'");

  console.log("✓ All Auth UI foundation self-tests passed cleanly!");
}

runAuthUiSelfTest().catch((err) => {
  console.error("Auth UI self-test failed:", err);
  process.exit(1);
});
