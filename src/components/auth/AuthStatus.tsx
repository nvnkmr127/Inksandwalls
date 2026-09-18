"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { User, LogIn } from "lucide-react";

export interface AuthStatusProps {
  onNavClick?: () => void;
  mobile?: boolean;
}

export function AuthStatus({ onNavClick, mobile = false }: AuthStatusProps) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-9 w-20 bg-muted/60 animate-pulse rounded-md" aria-label="Loading authentication status" />
    );
  }

  if (session?.user) {
    if (mobile) {
      return (
        <div className="flex flex-col gap-3 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2.5 px-2 text-sm text-foreground font-medium">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="truncate">{session.user.name || session.user.phone || session.user.email || "Account"}</span>
          </div>
          <Link
            href="/account"
            onClick={onNavClick}
            className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2 rounded-md hover:bg-accent"
          >
            Account
          </Link>
          <LogoutButton
            variant="outline"
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={onNavClick}
          >
            Logout
          </LogoutButton>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        <Link href="/account" passHref>
          <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
            <User className="w-4 h-4 text-muted-foreground" />
            <span>Account</span>
          </Button>
        </Link>
        <LogoutButton variant="outline" size="sm" />
      </div>
    );
  }

  // Guest shopper state
  if (mobile) {
    return (
      <div className="pt-2 border-t border-border/50">
        <Link href="/login" onClick={onNavClick} passHref>
          <Button variant="default" className="w-full justify-center gap-2">
            <LogIn className="w-4 h-4" />
            <span>Login</span>
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <Link href="/login" passHref>
      <Button variant="default" size="sm" className="gap-2 font-medium">
        <LogIn className="w-4 h-4" />
        <span>Login</span>
      </Button>
    </Link>
  );
}
