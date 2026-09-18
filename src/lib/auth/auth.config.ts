import type { NextAuthConfig } from "next-auth";
import type { AppRole } from "@/types/next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { normalizePhoneNumber } from "./phone";
import { getOtpChallenge, verifyOtpHash, incrementAttemptCount, invalidateOtpChallenge } from "./otp";

async function sha256Short(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid profile email",
        },
      },
    }),
    Credentials({
      id: "whatsapp-otp",
      name: "WhatsApp OTP",
      credentials: {
        phone: { label: "Phone Number", type: "text" },
        otp: { label: "OTP", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.otp) {
          return null;
        }

        const normalizedPhone = normalizePhoneNumber(credentials.phone as string);
        if (!normalizedPhone) {
          return null;
        }

        const otp = String(credentials.otp);
        const challenge = await getOtpChallenge(normalizedPhone);
        if (!challenge) {
          return null;
        }

        const isValid = await verifyOtpHash(normalizedPhone, otp, challenge.otpHash);
        if (!isValid) {
          await incrementAttemptCount(normalizedPhone, challenge);
          return null;
        }

        // Invalidate challenge upon successful verification (single-use enforcement)
        await invalidateOtpChallenge(normalizedPhone);

        // Minimal user identity for Auth.js session (Phase 02.02 boundary)
        const phoneHash = await sha256Short(normalizedPhone);
        return {
          id: `usr_${phoneHash}`,
          phone: normalizedPhone,
          role: "CUSTOMER",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days session persistence
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.AUTH_SECRET || (process.env.NODE_ENV === "test" ? "test-secret-key-min-32-chars-long-phrase" : undefined),
  callbacks: {
    async jwt({ token, user, profile }) {
      if (user) {
        token.sub = user.id || token.sub;
        token.name = user.name ?? token.name ?? null;
        token.email = user.email ?? token.email ?? null;
        token.picture = user.image ?? (profile as { picture?: string })?.picture ?? token.picture ?? null;
        token.role = user.role || token.role || "CUSTOMER";
        if (user.phone) {
          token.phone = user.phone;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.sub || "";
        session.user.name = token.name ?? session.user.name ?? null;
        session.user.email = token.email ?? session.user.email ?? null;
        session.user.image = token.picture ?? session.user.image ?? null;
        session.user.role = (token.role as AppRole) || "CUSTOMER";
        session.user.phone = token.phone as string | undefined;
      }
      return session;
    },
    async authorized() {
      // Public storefront routes remain open
      return true;
    },
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
};
