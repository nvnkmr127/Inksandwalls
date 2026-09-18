import { DefaultSession } from "next-auth";
import type { Role, UserStatus } from "@prisma/client";

export type AppRole = Role | "GUEST" | "CUSTOMER" | "STORE_ADMIN" | "SUPER_ADMIN";
export type AppUserStatus = UserStatus | "ACTIVE" | "SUSPENDED";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: AppRole;
      status?: AppUserStatus;
      phone?: string;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: AppRole;
    status?: AppUserStatus;
    phone?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    sub?: string;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    role?: AppRole;
    status?: AppUserStatus;
    phone?: string;
  }
}


