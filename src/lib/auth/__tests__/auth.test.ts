import { authConfig } from "../auth.config";
import { getCurrentUser, isAuthenticated, isGuest } from "../session";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

async function runAuthSelfTest() {
  console.log("--> Running Auth.js Session foundation self-tests...");

  // 1. Verify Auth Config defaults & JWT session strategy
  assert(authConfig.session?.strategy === "jwt", "Session strategy must be 'jwt'");
  assert(Array.isArray(authConfig.providers) && authConfig.providers.length >= 1, "Providers must contain WhatsApp OTP provider in Micro Phase 02.02");

  // 2. Verify Authorized Callback allows public storefront routes
  if (authConfig.callbacks?.authorized) {
    const isAllowed = await authConfig.callbacks.authorized({
      auth: null,
      request: new Request("https://inksandwalls.com/") as unknown as Parameters<NonNullable<typeof authConfig.callbacks.authorized>>[0]["request"],
    });
    assert(isAllowed === true, "Authorized callback must allow public storefront browsing");
  }

  // 3. Verify JWT callback mapping
  if (authConfig.callbacks?.jwt) {
    const initialToken = { sub: "user_123" };
    const dummyUser = { id: "user_123", role: "CUSTOMER", phone: "+919876543210" };
    type JwtParam = Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0];
    const updatedToken = await authConfig.callbacks.jwt({
      token: initialToken,
      user: dummyUser as unknown as JwtParam["user"],
      account: null,
    });
    assert(Boolean(updatedToken), "JWT token returned should not be null");
    if (updatedToken) {
      assert(updatedToken.sub === "user_123", "JWT token sub mapping failed");
      assert(updatedToken.role === "CUSTOMER", "JWT token role mapping failed");
      assert(updatedToken.phone === "+919876543210", "JWT token phone mapping failed");
    }
  }

  // 4. Verify Session callback mapping
  if (authConfig.callbacks?.session) {
    const token = { sub: "user_123", role: "CUSTOMER", phone: "+919876543210" };
    const sessionInput = {
      user: { id: "", name: "Test User", email: "test@example.com" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    type SessionParam = Parameters<NonNullable<typeof authConfig.callbacks.session>>[0];
    const sessionOutput = await authConfig.callbacks.session({
      session: sessionInput as unknown as SessionParam["session"],
      token,
      user: { id: "user_123" } as unknown as SessionParam["user"],
      newSession: null,
      trigger: "update",
    });
    assert(Boolean(sessionOutput?.user), "Session user object should exist");
    if (sessionOutput?.user) {
      assert(sessionOutput.user.id === "user_123", "Session user id mapping failed");
      assert(sessionOutput.user.role === "CUSTOMER", "Session user role mapping failed");
      assert(sessionOutput.user.phone === "+919876543210", "Session user phone mapping failed");
    }
  }

  // 5. Verify Unauthenticated / Guest helpers return expected defaults
  const user = await getCurrentUser();
  assert(user === null, "getCurrentUser should return null when unauthenticated");

  const authed = await isAuthenticated();
  assert(authed === false, "isAuthenticated should return false when unauthenticated");

  const guest = await isGuest();
  assert(guest === true, "isGuest should return true when unauthenticated");

  // 6. Verify Cookie Configuration
  assert(authConfig.cookies?.sessionToken?.options?.httpOnly === true, "Session cookie must be HttpOnly");
  assert(authConfig.cookies?.sessionToken?.options?.sameSite === "lax", "Session cookie must be SameSite lax");

  console.log("✓ All Auth.js Session foundation self-tests passed cleanly!");
}

runAuthSelfTest().catch((err) => {
  console.error("Auth self-test failed:", err);
  process.exit(1);
});
