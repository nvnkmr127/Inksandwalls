"use client";

import React from "react";
import { Check, MapPin, Phone } from "lucide-react";

export interface AddressData {
  id: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefaultShipping?: boolean;
  isDefaultBilling?: boolean;
}

export interface AddressCardProps {
  address: AddressData;
  isSelected: boolean;
  onSelect: (addressId: string) => void;
  disabled?: boolean;
}

export function AddressCard({
  address,
  isSelected,
  onSelect,
  disabled = false,
}: AddressCardProps) {
  return (
    <div
      onClick={() => !disabled && onSelect(address.id)}
      role="radio"
      aria-checked={isSelected}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect(address.id);
        }
      }}
      className={`p-4 rounded-xl border text-left cursor-pointer transition-all relative ${
        isSelected
          ? "border-neutral-900 bg-neutral-50/70 ring-1 ring-neutral-900 shadow-xs"
          : "border-neutral-200 hover:border-neutral-300 bg-white"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-neutral-500 shrink-0" />
          <p className="font-semibold text-sm text-neutral-900">
            {address.firstName} {address.lastName}
          </p>
        </div>
        {address.isDefaultShipping && (
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
            Default
          </span>
        )}
      </div>

      <div className="mt-2 text-xs text-neutral-600 space-y-0.5 leading-relaxed pl-6">
        <p>{address.addressLine1}</p>
        {address.addressLine2 && <p>{address.addressLine2}</p>}
        <p>
          {address.city}, {address.state} - <span className="font-medium text-neutral-900">{address.postalCode}</span>
        </p>
        {address.phone && (
          <p className="flex items-center gap-1 text-neutral-500 mt-1">
            <Phone className="w-3 h-3" />
            <span>{address.phone}</span>
          </p>
        )}
      </div>

      {isSelected && (
        <div className="absolute bottom-3 right-3 w-5 h-5 bg-neutral-900 text-white rounded-full flex items-center justify-center">
          <Check className="w-3 h-3" />
        </div>
      )}
    </div>
  );
}
