import { auth } from "./index";
import { logger } from "../logger";

export interface CurrentUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string;
  phone?: string;
}

/**
 * Get current server-side session.
 * Safe helper for Server Components, Server Actions, and Route Handlers.
 */
export async function getSession() {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    logger.error("Failed to retrieve authentication session", { component: "AuthSession" }, error as Error);
    return null;
  }
}

/**
 * Get current authenticated user or null if guest / unauthenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session?.user) {
    return null;
  }
  return {
    id: session.user.id || "",
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
    phone: session.user.phone,
  };
}

/**
 * Check if the current request is from an authenticated user.
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.user?.id);
}

/**
 * Check if the current request is from a guest shopper.
 */
export async function isGuest(): Promise<boolean> {
  const authenticated = await isAuthenticated();
  return !authenticated;
}
