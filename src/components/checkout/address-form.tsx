"use client";

import React, { useState } from "react";
import { validatePincode } from "@/lib/pincode/pincode-service";
import type { AddressInput } from "@/lib/address/address-schema";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export interface AddressFormProps {
  initialValues?: Partial<AddressInput>;
  onSubmit: (data: AddressInput) => Promise<void> | void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  submitLabel?: string;
}

export function AddressForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
  submitLabel = "Save & Deliver Here",
}: AddressFormProps) {
  const [formData, setFormData] = useState<Partial<AddressInput>>({
    firstName: initialValues?.firstName || "",
    lastName: initialValues?.lastName || "",
    addressLine1: initialValues?.addressLine1 || "",
    addressLine2: initialValues?.addressLine2 || "",
    city: initialValues?.city || "",
    state: initialValues?.state || "",
    postalCode: initialValues?.postalCode || "",
    country: initialValues?.country || "IN",
    phone: initialValues?.phone || "",
    isDefaultShipping: initialValues?.isDefaultShipping ?? true,
    isDefaultBilling: initialValues?.isDefaultBilling ?? true,
  });

  const [pincodeState, setPincodeState] = useState<{
    valid: boolean;
    isDeliverable: boolean;
    message?: string;
  } | null>(null);

  const [formError, setFormError] = useState<string | null>(null);

  const handlePincodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value.replace(/\D/g, "").slice(0, 6);
    setFormData((prev) => ({ ...prev, postalCode: rawVal }));

    if (rawVal.length === 6) {
      const res = validatePincode(rawVal);
      if (res.valid) {
        setPincodeState({
          valid: true,
          isDeliverable: res.isDeliverable,
          message: res.isDeliverable
            ? `Deliverable to ${res.city || ""}, ${res.state || ""}`
            : res.error || "Delivery not available to this pincode",
        });
        if (res.state && !formData.state) {
          setFormData((prev) => ({ ...prev, state: res.state, city: res.city || prev.city }));
        }
      } else {
        setPincodeState({
          valid: false,
          isDeliverable: false,
          message: res.error || "Invalid PIN code",
        });
      }
    } else {
      setPincodeState(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.firstName?.trim()) {
      setFormError("First name is required.");
      return;
    }
    if (!formData.lastName?.trim()) {
      setFormError("Last name is required.");
      return;
    }
    if (!formData.addressLine1?.trim()) {
      setFormError("Address line 1 is required.");
      return;
    }
    if (!formData.city?.trim()) {
      setFormError("City is required.");
      return;
    }
    if (!formData.state?.trim()) {
      setFormError("State is required.");
      return;
    }
    if (!formData.postalCode || formData.postalCode.length !== 6) {
      setFormError("A valid 6-digit postal code is required.");
      return;
    }

    try {
      await onSubmit(formData as AddressInput);
    } catch (err) {
      setFormError((err as Error).message || "Failed to save address.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-xl border border-neutral-200">
      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            First Name *
          </label>
          <input
            type="text"
            required
            value={formData.firstName || ""}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            Last Name *
          </label>
          <input
            type="text"
            required
            value={formData.lastName || ""}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">
          Address Line 1 (Flat, House no., Building, Street) *
        </label>
        <input
          type="text"
          required
          value={formData.addressLine1 || ""}
          onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
          className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">
          Address Line 2 (Area, Landmark - Optional)
        </label>
        <input
          type="text"
          value={formData.addressLine2 || ""}
          onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
          className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            PIN Code *
          </label>
          <input
            type="text"
            required
            maxLength={6}
            placeholder="6 digits (e.g. 500001)"
            value={formData.postalCode || ""}
            onChange={handlePincodeChange}
            className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 font-mono focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
          />
          {pincodeState && (
            <p
              className={`text-[11px] mt-1 flex items-center gap-1 ${
                pincodeState.isDeliverable ? "text-emerald-700 font-medium" : "text-rose-600"
              }`}
            >
              {pincodeState.isDeliverable ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
              )}
              <span>{pincodeState.message}</span>
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            City *
          </label>
          <input
            type="text"
            required
            value={formData.city || ""}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">
            State *
          </label>
          <input
            type="text"
            required
            value={formData.state || ""}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-neutral-700 mb-1">
          Phone Number for Delivery Updates (10 digits)
        </label>
        <input
          type="tel"
          placeholder="e.g. 9876543210"
          value={formData.phone || ""}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{submitLabel}</span>
        </button>
      </div>
    </form>
  );
}
