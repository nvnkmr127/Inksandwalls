"use client";

import React, { useState, useEffect } from "react";
import { Phone, Lock, ArrowRight, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export interface WhatsAppOtpFormProps {
  onSuccess?: (user: { phone: string }) => void;
}

type Step = "phone" | "otp" | "success";

export function WhatsAppOtpForm({ onSuccess }: WhatsAppOtpFormProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/whatsapp/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error?.message || "Failed to request OTP. Please try again.");
        setLoading(false);
        return;
      }

      setSuccessMessage(data.message || "OTP dispatched to your WhatsApp!");
      setStep("otp");
      setCooldown(60);
    } catch {
      setErrorMessage("Network error. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/whatsapp/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error?.message || "Invalid OTP verification attempt.");
        setLoading(false);
        return;
      }

      setStep("success");
      setSuccessMessage("Phone verified successfully!");
      if (onSuccess && data.user) {
        onSuccess(data.user);
      }
    } catch {
      setErrorMessage("Network error during OTP verification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 bg-stone-900 border border-stone-800 rounded-2xl shadow-xl text-stone-100">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-serif font-bold text-amber-500">WhatsApp Sign In</h2>
        <p className="text-sm text-stone-400 mt-1">
          {step === "phone" ? "Enter your mobile number to receive a secure OTP" : step === "otp" ? "Enter the 6-digit code sent to your WhatsApp" : "Authentication complete"}
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && step !== "success" && (
        <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {step === "phone" && (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">WhatsApp Mobile Number</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-sm focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send WhatsApp OTP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">6-Digit OTP</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                required
                className="w-full pl-10 pr-4 py-2.5 bg-stone-950 border border-stone-700 rounded-xl text-sm tracking-widest font-mono text-center focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length !== 6}
            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-stone-950 font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Verify & Sign In</span>
                <CheckCircle2 className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              disabled={cooldown > 0 || loading}
              onClick={handleRequestOtp}
              className="text-xs text-amber-500 hover:underline disabled:text-stone-600 transition-colors"
            >
              {cooldown > 0 ? `Resend OTP in ${cooldown}s` : "Resend OTP"}
            </button>
          </div>
        </form>
      )}

      {step === "success" && (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="text-lg font-medium text-stone-100">Successfully Signed In</h3>
          <p className="text-xs text-stone-400">Authenticated phone: {phone}</p>
        </div>
      )}
    </div>
  );
}
