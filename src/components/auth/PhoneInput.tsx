"use client";

import React from "react";
import { Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  disabled?: boolean;
  id?: string;
  label?: string;
  autoFocus?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  error,
  disabled = false,
  id = "phone-input",
  label = "WhatsApp Mobile Number",
  autoFocus = false,
}: PhoneInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Keep raw numeric input or formatted digits typed by user
    const input = e.target.value;
    onChange(input);
  };

  return (
    <div className="space-y-2 text-left">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <div className="relative flex items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
        <div className="flex items-center gap-1.5 px-3 py-2 border-r border-input bg-muted/50 text-muted-foreground text-sm font-mono shrink-0 select-none">
          <Phone className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>+91</span>
        </div>
        <Input
          id={id}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          placeholder="98765 43210"
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-base sm:text-sm tracking-wider"
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
