"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { PhoneInput } from "@/components/auth/PhoneInput";
import { OtpInput } from "@/components/auth/OtpInput";
import { Button } from "@/components/ui/button";
import { normalizePhoneNumber } from "@/lib/auth/phone";
import { toast } from "@/components/feedback/toast";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

export interface WhatsAppOtpFormProps {
  returnUrl?: string;
  onSuccess?: () => void;
}

type Step = "phone" | "otp" | "success";

export function WhatsAppOtpForm({ returnUrl = "/", onSuccess }: WhatsAppOtpFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Handle request OTP submit
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPhoneError(null);
    setGeneralError(null);

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      setPhoneError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/whatsapp/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 429) {
          setGeneralError("Too many requests. Please try again later.");
        } else if (data.error?.message) {
          setGeneralError(data.error.message);
        } else {
          setGeneralError("Unable to send OTP. Please try again.");
        }
        setLoading(false);
        return;
      }

      toast.success("OTP sent to WhatsApp", `Verification code sent to ${normalized}`);
      setStep("otp");
      setOtp("");
      setOtpError(null);
      setCooldown(60);
    } catch {
      setGeneralError("Something went wrong. Please check your network connection.");
    } finally {
      setLoading(false);
    }
  };

  // Handle verify OTP submit
  const handleVerifyOtp = async (otpToVerify?: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalOtp = otpToVerify || otp;
    setOtpError(null);
    setGeneralError(null);

    if (finalOtp.length !== 6) {
      setOtpError("Please enter a complete 6-digit OTP");
      return;
    }

    const normalized = normalizePhoneNumber(phone);
    if (!normalized) {
      setPhoneError("Invalid phone number format");
      setStep("phone");
      return;
    }

    setLoading(true);

    try {
      const res = await signIn("whatsapp-otp", {
        phone: normalized,
        otp: finalOtp,
        redirect: false,
      });

      if (!res || res.error) {
        if (res?.status === 429) {
          setGeneralError("Too many requests. Please try again later.");
        } else {
          setOtpError("Invalid OTP. Please try again.");
        }
        setLoading(false);
        return;
      }

      setStep("success");
      toast.success("Authenticated", "Successfully signed in via WhatsApp");

      if (onSuccess) {
        onSuccess();
      }

      // Redirect to returnUrl
      router.push(returnUrl);
      router.refresh();
    } catch {
      setGeneralError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  // Change phone number action
  const handleChangeNumber = () => {
    setOtp("");
    setOtpError(null);
    setGeneralError(null);
    setStep("phone");
  };

  return (
    <div className="w-full space-y-6">
      {generalError && (
        <div
          role="alert"
          className="p-3.5 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-xs font-medium flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={handleRequestOtp} className="space-y-5">
          <PhoneInput
            value={phone}
            onChange={(val) => {
              setPhone(val);
              if (phoneError) setPhoneError(null);
            }}
            error={phoneError}
            disabled={loading}
            autoFocus
          />

          <Button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full py-5 text-sm font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Sending OTP...</span>
              </>
            ) : (
              <>
                <span>Send OTP via WhatsApp</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={(e) => handleVerifyOtp(undefined, e)} className="space-y-5">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/50">
            <span>OTP sent to <strong className="font-mono text-foreground">{normalizePhoneNumber(phone) || phone}</strong></span>
            <button
              type="button"
              onClick={handleChangeNumber}
              disabled={loading}
              className="text-primary hover:underline font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
            >
              Change number
            </button>
          </div>

          <OtpInput
            value={otp}
            onChange={(val) => {
              setOtp(val);
              if (otpError) setOtpError(null);
            }}
            error={otpError}
            disabled={loading}
            autoFocus
            onComplete={(completedOtp) => handleVerifyOtp(completedOtp)}
          />

          <Button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-5 text-sm font-medium flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Verify OTP & Sign In</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </Button>

          <div className="text-center pt-1">
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={() => handleRequestOtp()}
              className="text-xs text-muted-foreground hover:text-foreground font-medium disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-2 py-1"
            >
              {cooldown > 0 ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>Resend OTP in {cooldown}s</span>
                </span>
              ) : (
                "Resend OTP"
              )}
            </button>
          </div>
        </form>
      )}

      {step === "success" && (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-semibold text-foreground">Authenticated</h3>
          <p className="text-xs text-muted-foreground">Redirecting to your destination...</p>
        </div>
      )}
    </div>
  );
}
