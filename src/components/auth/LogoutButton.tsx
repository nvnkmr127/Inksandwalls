"use client";

import React, { useState } from "react";
import { signOut } from "next-auth/react";
import { Button, ButtonProps } from "@/components/ui/button";
import { LogOut, Loader2 } from "lucide-react";

export interface LogoutButtonProps extends ButtonProps {
  callbackUrl?: string;
  showIcon?: boolean;
}

export function LogoutButton({
  callbackUrl = "/",
  showIcon = true,
  variant = "ghost",
  size = "sm",
  className,
  children,
  ...props
}: LogoutButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut({ callbackUrl });
    } catch (err) {
      console.error("Logout error", err);
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={loading}
      onClick={handleLogout}
      className={className}
      aria-label="Log out"
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" aria-hidden="true" />
      ) : showIcon ? (
        <LogOut className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <span>{children || "Logout"}</span>
    </Button>
  );
}
