import { authConfig } from "../auth.config";
import { getCurrentUser, isAuthenticated, isGuest } from "../session";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${msg}`);
  }
}

function getProviderId(p: unknown): string {
  if (!p) return "";
  const obj = typeof p === "function" ? (p as () => { id?: string; options?: { id?: string } })() : (p as { id?: string; options?: { id?: string } });
  return obj?.options?.id || obj?.id || "";
}

async function runGoogleAuthTests() {
  console.log("--> Running Phase 02.03 Google OAuth self-tests...");

  // 1. Verify Google Provider Registration in Auth.js Config
  assert(Array.isArray(authConfig.providers), "Providers array must exist in authConfig");
  const googleProvider = authConfig.providers.find((p) => getProviderId(p) === "google");
  assert(Boolean(googleProvider), "Google provider must be registered in authConfig");
  assert(getProviderId(googleProvider) === "google", "Google provider ID must be 'google'");

  // 2. Verify Google JWT Callback Mapping
  if (authConfig.callbacks?.jwt) {
    const googleUser = {
      id: "google_sub_10928374",
      name: "Aditi Sharma",
      email: "aditi@example.com",
      image: "https://lh3.googleusercontent.com/a/acme-avatar.jpg",
      role: "CUSTOMER",
    };
    const initialToken = {};
    type JwtParam = Parameters<NonNullable<typeof authConfig.callbacks.jwt>>[0];
    const updatedToken = await authConfig.callbacks.jwt({
      token: initialToken,
      user: googleUser as unknown as JwtParam["user"],
      account: null,
    });

    assert(Boolean(updatedToken), "JWT token returned should not be null");
    if (updatedToken) {
      assert(updatedToken.sub === "google_sub_10928374", "JWT sub mapping failed for Google user");
      assert(updatedToken.name === "Aditi Sharma", "JWT name mapping failed for Google user");
      assert(updatedToken.email === "aditi@example.com", "JWT email mapping failed for Google user");
      assert(updatedToken.picture === "https://lh3.googleusercontent.com/a/acme-avatar.jpg", "JWT picture mapping failed");
      assert(updatedToken.role === "CUSTOMER", "JWT role mapping failed for Google user");
    }
  }

  // 3. Verify Google Session Callback Mapping
  if (authConfig.callbacks?.session) {
    const token = {
      sub: "google_sub_10928374",
      name: "Aditi Sharma",
      email: "aditi@example.com",
      picture: "https://lh3.googleusercontent.com/a/acme-avatar.jpg",
      role: "CUSTOMER",
    };
    const sessionInput = {
      user: { id: "", name: "", email: "" },
      expires: new Date(Date.now() + 86400000).toISOString(),
    };
    type SessionParam = Parameters<NonNullable<typeof authConfig.callbacks.session>>[0];
    const sessionOutput = await authConfig.callbacks.session({
      session: sessionInput as unknown as SessionParam["session"],
      token,
      user: { id: "google_sub_10928374" } as unknown as SessionParam["user"],
      newSession: null,
      trigger: "update",
    });

    assert(Boolean(sessionOutput?.user), "Session user object must exist");
    if (sessionOutput?.user) {
      assert(sessionOutput.user.id === "google_sub_10928374", "Session user.id mapping failed");
      assert(sessionOutput.user.name === "Aditi Sharma", "Session user.name mapping failed");
      assert(sessionOutput.user.email === "aditi@example.com", "Session user.email mapping failed");
      assert(sessionOutput.user.image === "https://lh3.googleusercontent.com/a/acme-avatar.jpg", "Session user.image mapping failed");
      assert(sessionOutput.user.role === "CUSTOMER", "Session user.role mapping failed");
    }
  }

  // 4. Regression Test: Ensure WhatsApp OTP Credentials Provider remains operational
  const whatsappProvider = authConfig.providers.find((p) => getProviderId(p) === "whatsapp-otp");
  assert(Boolean(whatsappProvider), "WhatsApp OTP credentials provider must remain registered");

  // 5. Unauthenticated State Helper Checks
  const currentUser = await getCurrentUser();
  assert(currentUser === null, "getCurrentUser must return null when unauthenticated");
  assert((await isAuthenticated()) === false, "isAuthenticated must return false when unauthenticated");
  assert((await isGuest()) === true, "isGuest must return true when unauthenticated");

  // 6. Security Boundaries Check
  assert(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET === undefined, "GOOGLE_CLIENT_SECRET must never be exposed via NEXT_PUBLIC_");

  console.log("✓ All Phase 02.03 Google OAuth self-tests passed cleanly!");
}

runGoogleAuthTests().catch((err) => {
  console.error("Google OAuth self-test failed:", err);
  process.exit(1);
});
