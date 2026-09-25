"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CheckoutSessionSnapshot } from "@/lib/checkout/checkout-service";
import type { AddressData } from "./address-card";
import { AddressCard } from "./address-card";
import { AddressForm } from "./address-form";
import {
  selectSavedAddressAction,
  saveAndSelectNewAddressAction,
  updateCheckoutContactAction,
} from "@/app/actions/checkout";
import {
  selectPaymentMethodAction,
  prepareCodCheckoutAction,
  checkCodEligibilityAction,
} from "@/app/actions/payment";
import {
  placeCodOrderAction,
  createRazorpayOrderForCheckoutAction,
  placeRazorpayOrderAction,
} from "@/app/actions/order";
import { generateTestRazorpaySignature } from "@/lib/payment/razorpay-service";
import type { AddressInput } from "@/lib/address/address-schema";
import type { PaymentMethod } from "@/lib/payment/types";
import { formatPaiseToRupees } from "@/lib/money";

import {
  Mail,
  ShieldCheck,
  Plus,
  Loader2,
  AlertTriangle,
  CreditCard,
  Banknote,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";

export interface CheckoutFlowProps {
  session: CheckoutSessionSnapshot;
  initialAddresses: AddressData[];
  isGuest?: boolean;
  onSessionUpdated?: (newSession: CheckoutSessionSnapshot) => void;
}

export function CheckoutFlow({
  session: initialSession,
  initialAddresses,
  onSessionUpdated,
}: CheckoutFlowProps) {
  const router = useRouter();
  const [session, setSession] = useState<CheckoutSessionSnapshot>(initialSession);
  const [addresses, setAddresses] = useState<AddressData[]>(initialAddresses);
  const [showNewAddressForm, setShowNewAddressForm] = useState(
    initialAddresses.length === 0 && !session.shippingAddressId
  );
  const [emailInput, setEmailInput] = useState(session.email || "");
  const [phoneInput, setPhoneInput] = useState(session.phone || "");
  const [isContactSaved, setIsContactSaved] = useState(Boolean(session.email));
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(
    session.paymentMethod || "RAZORPAY"
  );
  const [paymentConfirmed, setPaymentConfirmed] = useState<PaymentMethod | null>(
    session.paymentMethod || null
  );
  const [isPending, startTransition] = useTransition();
  const [flowError, setFlowError] = useState<string | null>(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);

  const updateSession = (newSession: CheckoutSessionSnapshot) => {
    setSession(newSession);
    if (newSession.paymentMethod) {
      setSelectedMethod(newSession.paymentMethod);
      setPaymentConfirmed(newSession.paymentMethod);
    } else if (selectedMethod === "COD" && !newSession.codEligibility.eligible) {
      setSelectedMethod("RAZORPAY");
      setPaymentConfirmed(null);
    }
    onSessionUpdated?.(newSession);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) {
      setFlowError("Please provide a valid email address.");
      return;
    }

    setFlowError(null);
    startTransition(async () => {
      const res = await updateCheckoutContactAction(session.id, {
        email: emailInput.trim(),
        phone: phoneInput.trim() || null,
      });
      if (res.success && res.session) {
        setIsContactSaved(true);
        updateSession(res.session);
      } else {
        setFlowError(res.error || "Failed to save contact information.");
      }
    });
  };

  const handleSelectAddress = (addressId: string) => {
    setFlowError(null);
    startTransition(async () => {
      const res = await selectSavedAddressAction(session.id, addressId, "both");
      if (res.success && res.session) {
        setShowNewAddressForm(false);
        updateSession(res.session);
      } else {
        setFlowError(res.error || "Failed to select address.");
      }
    });
  };

  const handleSaveNewAddress = async (data: AddressInput) => {
    setFlowError(null);
    const res = await saveAndSelectNewAddressAction(session.id, {
      shippingAddress: data,
      useShippingAsBilling: true,
    });

    if (res.success && res.session) {
      if (res.session.shippingAddress) {
        setAddresses((prev) => [res.session!.shippingAddress as AddressData, ...prev]);
      }
      setShowNewAddressForm(false);
      updateSession(res.session);
    } else {
      throw new Error(res.error || "Failed to save address.");
    }
  };

  const handleSelectPaymentMethod = (method: PaymentMethod) => {
    if (method === "COD" && !session.codEligibility.eligible) {
      return;
    }
    setSelectedMethod(method);
    setPaymentConfirmed(null);
    setFlowError(null);
  };

  const handlePlaceOrder = () => {
    setFlowError(null);
    startTransition(async () => {
      if (selectedMethod === "COD") {
        const res = await placeCodOrderAction({ checkoutId: session.id });
        if (res.success && res.orderNumber) {
          router.push(`/checkout/success?orderNumber=${res.orderNumber}`);
        } else {
          setFlowError(res.error || "Failed to place Cash on Delivery order.");
        }
      } else {
        // Razorpay Online Payment Flow
        const orderInit = await createRazorpayOrderForCheckoutAction(session.id);
        if (!orderInit.success || !orderInit.orderId) {
          setFlowError(orderInit.error || "Failed to initialize Razorpay payment.");
          return;
        }

        // Check for Razorpay SDK on client window
        const windowWithRazorpay = typeof window !== "undefined" ? (window as unknown as { Razorpay?: new (opts: Record<string, unknown>) => { open: () => void } }) : null;
        if (windowWithRazorpay && typeof windowWithRazorpay.Razorpay === "function") {
          const options = {
            key: orderInit.keyId,
            amount: orderInit.amountPaise,
            currency: orderInit.currency || "INR",
            name: "INKs & Walls",
            description: "Custom Wallpapers & Wall Art",
            order_id: orderInit.orderId,
            handler: async function (response: {
              razorpay_payment_id: string;
              razorpay_order_id: string;
              razorpay_signature: string;
            }) {
              startTransition(async () => {
                const verifyRes = await placeRazorpayOrderAction({
                  checkoutId: session.id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                if (verifyRes.success && verifyRes.orderNumber) {
                  router.push(`/checkout/success?orderNumber=${verifyRes.orderNumber}`);
                } else {
                  setFlowError(verifyRes.error || "Payment verification failed.");
                }
              });
            },
            prefill: {
              name: session.shippingAddress
                ? `${session.shippingAddress.firstName} ${session.shippingAddress.lastName}`
                : "",
              email: session.email || "",
              contact: session.phone || session.shippingAddress?.phone || "",
            },
            theme: {
              color: "#171717",
            },
          };
          const rzp = new windowWithRazorpay.Razorpay(options);
          rzp.open();
        } else {
          // Dev / Fallback verified test authorization
          const mockPaymentId = `pay_mock_${Date.now()}`;
          const mockSignature = generateTestRazorpaySignature(
            orderInit.orderId,
            mockPaymentId
          );
          const verifyRes = await placeRazorpayOrderAction({
            checkoutId: session.id,
            razorpayOrderId: orderInit.orderId,
            razorpayPaymentId: mockPaymentId,
            razorpaySignature: mockSignature,
          });
          if (verifyRes.success && verifyRes.orderNumber) {
            router.push(`/checkout/success?orderNumber=${verifyRes.orderNumber}`);
          } else {
            setFlowError(verifyRes.error || "Payment verification failed.");
          }
        }
      }
    });
  };


  const handleRetryEligibility = async () => {
    setEligibilityLoading(true);
    setFlowError(null);
    try {
      const res = await checkCodEligibilityAction(session.id);
      if (res.success && res.session) {
        updateSession(res.session);
      } else {
        setFlowError(res.error || "Could not refresh eligibility status.");
      }
    } catch {
      setFlowError("Failed to check eligibility. Please try again.");
    } finally {
      setEligibilityLoading(false);
    }
  };

  const isDeliverable = session.totals.isDeliverable;
  const canProceedToPayment =
    isContactSaved &&
    Boolean(session.shippingAddressId) &&
    isDeliverable &&
    session.totals.status === "VALID";

  const codEligible = session.codEligibility.eligible;
  const codReasonMessage = session.codEligibility.message;

  return (
    <div className="space-y-8">
      {flowError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{flowError}</span>
          </div>
          <button
            type="button"
            onClick={handleRetryEligibility}
            className="text-xs font-semibold text-rose-900 underline flex items-center gap-1 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Step 1: Contact Information */}
      <section
        aria-labelledby="contact-heading"
        className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h2 id="contact-heading" className="text-lg font-bold text-neutral-900">
              Contact Information
            </h2>
          </div>
          {isContactSaved && (
            <button
              type="button"
              onClick={() => setIsContactSaved(false)}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 underline"
            >
              Edit
            </button>
          )}
        </div>

        {isContactSaved ? (
          <div className="pl-9 text-sm text-neutral-700 flex items-center gap-2">
            <Mail className="w-4 h-4 text-neutral-400" />
            <span className="font-medium">{session.email}</span>
            {session.phone && (
              <span className="text-neutral-500">· {session.phone}</span>
            )}
          </div>
        ) : (
          <form onSubmit={handleSaveContact} className="pl-9 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Email Address (for order updates & GST invoice) *
              </label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="you@example.com"
                className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Phone Number (optional)
              </label>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full text-sm border border-neutral-300 rounded-lg px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2 text-xs font-semibold bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Continue to Delivery</span>
            </button>
          </form>
        )}
      </section>

      {/* Step 2: Delivery & Shipping Address */}
      <section
        aria-labelledby="shipping-heading"
        className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-neutral-900 text-white text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h2 id="shipping-heading" className="text-lg font-bold text-neutral-900">
              Shipping & Delivery Address
            </h2>
          </div>
          {!showNewAddressForm && (
            <button
              type="button"
              onClick={() => setShowNewAddressForm(true)}
              className="text-xs font-semibold text-neutral-900 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New Address</span>
            </button>
          )}
        </div>

        <div className="pl-9 space-y-4">
          {/* List of Saved Addresses */}
          {!showNewAddressForm && addresses.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup">
              {addresses.map((addr) => (
                <AddressCard
                  key={addr.id}
                  address={addr}
                  isSelected={session.shippingAddressId === addr.id}
                  onSelect={handleSelectAddress}
                  disabled={isPending}
                />
              ))}
            </div>
          )}

          {/* New Address Form */}
          {showNewAddressForm && (
            <AddressForm
              onSubmit={handleSaveNewAddress}
              onCancel={addresses.length > 0 ? () => setShowNewAddressForm(false) : undefined}
              submitLabel="Save & Deliver to this Address"
            />
          )}

          {/* Undeliverable Address Warning */}
          {session.shippingAddressId && !isDeliverable && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5 mt-3">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Delivery is not available to this address</p>
                <p className="mt-0.5 text-rose-700">
                  {session.totals.deliveryError ||
                    "Please select or add a different shipping address to proceed."}
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Step 3: Payment Method Selection */}
      <section
        aria-labelledby="payment-heading"
        className={`p-6 rounded-2xl border transition-all ${
          canProceedToPayment
            ? "bg-white border-neutral-200 shadow-xs"
            : "bg-neutral-50 border-neutral-200/60 opacity-75"
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                canProceedToPayment
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-300 text-neutral-700"
              }`}
            >
              3
            </div>
            <h2 id="payment-heading" className="text-lg font-bold text-neutral-900">
              Payment Method
            </h2>
          </div>
          {eligibilityLoading && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Verifying COD eligibility...</span>
            </div>
          )}
        </div>

        <div className="pl-9 space-y-4">
          {!canProceedToPayment ? (
            <p className="text-xs text-neutral-500 italic">
              Please enter your contact information and select a valid delivery address above to unlock payment options.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment Method Options">
                {/* 1. Online Payment (Razorpay) */}
                <div
                  role="radio"
                  aria-checked={selectedMethod === "RAZORPAY"}
                  tabIndex={0}
                  onClick={() => handleSelectPaymentMethod("RAZORPAY")}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      handleSelectPaymentMethod("RAZORPAY");
                    }
                  }}
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                    selectedMethod === "RAZORPAY"
                      ? "border-neutral-900 bg-neutral-50/70 ring-1 ring-neutral-900 shadow-xs"
                      : "border-neutral-200 bg-white hover:border-neutral-300"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          selectedMethod === "RAZORPAY"
                            ? "border-neutral-900 bg-neutral-900"
                            : "border-neutral-300"
                        }`}
                      >
                        {selectedMethod === "RAZORPAY" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-semibold text-sm text-neutral-900">
                        Online Payment
                      </span>
                    </div>
                    <CreditCard className="w-4 h-4 text-neutral-700" />
                  </div>
                  <p className="text-xs text-neutral-600 mt-2 pl-6.5 leading-relaxed">
                    Pay securely via UPI (Google Pay, PhonePe, Paytm), Credit / Debit Cards, or NetBanking.
                  </p>
                  <div className="mt-3 pl-6.5 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Instant order confirmation</span>
                  </div>
                </div>

                {/* 2. Cash on Delivery (COD) */}
                <div
                  role="radio"
                  aria-checked={selectedMethod === "COD"}
                  aria-disabled={!codEligible}
                  tabIndex={codEligible ? 0 : -1}
                  onClick={() => handleSelectPaymentMethod("COD")}
                  onKeyDown={(e) => {
                    if (codEligible && (e.key === " " || e.key === "Enter")) {
                      e.preventDefault();
                      handleSelectPaymentMethod("COD");
                    }
                  }}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    !codEligible
                      ? "border-neutral-200 bg-neutral-50 opacity-70 cursor-not-allowed"
                      : selectedMethod === "COD"
                      ? "border-neutral-900 bg-neutral-50/70 ring-1 ring-neutral-900 shadow-xs cursor-pointer"
                      : "border-neutral-200 bg-white hover:border-neutral-300 cursor-pointer"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          !codEligible
                            ? "border-neutral-300 bg-neutral-200"
                            : selectedMethod === "COD"
                            ? "border-neutral-900 bg-neutral-900"
                            : "border-neutral-300"
                        }`}
                      >
                        {selectedMethod === "COD" && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <span className="font-semibold text-sm text-neutral-900">
                        Cash on Delivery (COD)
                      </span>
                    </div>
                    <Banknote className="w-4 h-4 text-neutral-700" />
                  </div>
                  <p className="text-xs text-neutral-600 mt-2 pl-6.5 leading-relaxed">
                    Pay with cash or UPI at your doorstep upon order delivery.
                  </p>

                  <div className="mt-3 pl-6.5">
                    {codEligible ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Available for PIN {session.shippingAddress?.postalCode}</span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5 text-[11px] text-amber-700 font-medium bg-amber-50/80 p-1.5 rounded-md border border-amber-200/60">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{codReasonMessage}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment State Display / Confirmation */}
              {paymentConfirmed === "COD" && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Cash on Delivery Selected</p>
                    <p className="mt-0.5 text-emerald-800">
                      Payment method is saved as <strong>Cash on Delivery (Unpaid / Pending)</strong>. Amount payable at doorstep:{" "}
                      <strong>{formatPaiseToRupees(session.totals.totalPayablePaise)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              {paymentConfirmed === "RAZORPAY" && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Online Payment Selected</p>
                    <p className="mt-0.5 text-blue-800">
                      Total amount payable via Razorpay:{" "}
                      <strong>{formatPaiseToRupees(session.totals.totalPayablePaise)}</strong>.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isPending || (selectedMethod === "COD" && !codEligible)}
                className="w-full py-3 px-6 bg-neutral-900 text-white font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing order & payment...</span>
                  </>
                ) : selectedMethod === "COD" ? (
                  <>
                    <Banknote className="w-4 h-4" />
                    <span>
                      Place Cash on Delivery Order (
                      {formatPaiseToRupees(session.totals.totalPayablePaise)})
                    </span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>
                      Pay & Place Order (
                      {formatPaiseToRupees(session.totals.totalPayablePaise)})
                    </span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
