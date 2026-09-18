"use client";

import React, { useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  label?: string;
  autoFocus?: boolean;
  onComplete?: (otp: string) => void;
}

export function OtpInput({
  value,
  onChange,
  error,
  disabled = false,
  id = "otp-input",
  label = "6-Digit WhatsApp OTP",
  autoFocus = true,
  onComplete,
}: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits up to 6 characters
    const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 6);
    onChange(digitsOnly);
    if (digitsOnly.length === 6 && onComplete) {
      onComplete(digitsOnly);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    const digitsOnly = pastedText.replace(/\D/g, "").slice(0, 6);
    if (digitsOnly) {
      onChange(digitsOnly);
      if (digitsOnly.length === 6 && onComplete) {
        onComplete(digitsOnly);
      }
    }
  };

  return (
    <div className="space-y-2 text-left">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex items-center justify-center pl-3 text-muted-foreground shrink-0 select-none">
          <Lock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
        </div>
        <Input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={value}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder="0 0 0 0 0 0"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="one-time-code"
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-center text-lg tracking-[0.4em] sm:tracking-[0.5em] font-semibold"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
