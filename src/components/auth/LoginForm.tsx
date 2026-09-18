"use client";

import React from "react";
import { WhatsAppOtpForm } from "@/components/auth/whatsapp-otp-form";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { getSafeCallbackUrl } from "@/lib/auth/url";

export interface LoginFormProps {
  returnUrl?: string;
}

export function LoginForm({ returnUrl = "/" }: LoginFormProps) {
  const safeReturnUrl = getSafeCallbackUrl(returnUrl);

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-serif">
          Sign In to INKs & Walls
        </h1>
        <p className="text-sm text-muted-foreground">
          Access your saved wallpaper selections and seamless checkout experience
        </p>
      </div>

      <div className="bg-card border border-border/70 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Primary Auth Method: WhatsApp OTP */}
        <WhatsAppOtpForm returnUrl={safeReturnUrl} />

        <div className="relative flex items-center justify-center my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative px-3 bg-card text-xs uppercase tracking-wider text-muted-foreground font-medium">
            or continue with
          </div>
        </div>

        {/* Alternative Auth Method: Google Login */}
        <GoogleSignInButton callbackUrl={safeReturnUrl} />
      </div>

      <p className="text-xs text-center text-muted-foreground px-4">
        By continuing, you agree to our Terms of Service & Privacy Policy. Guest browsing remains available at any time.
      </p>
    </div>
  );
}
