"use client";

import React from "react";

export interface RazorpayCheckoutProps {
  checkoutId: string;
  amountPaise: number;
}

export function RazorpayCheckout({ checkoutId, amountPaise }: RazorpayCheckoutProps) {
  return (
    <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 text-xs text-neutral-600">
      Razorpay Gateway integration ready for checkout {checkoutId} (Amount: ₹{(amountPaise / 100).toFixed(2)}).
    </div>
  );
}
