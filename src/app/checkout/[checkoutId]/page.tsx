import { Metadata } from "next";
import { cookies } from "next/headers";
import { getCheckoutSession } from "@/lib/checkout/checkout-service";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";
import { getCurrentUser } from "@/lib/auth/session";
import { resolveCartOwner } from "@/lib/cart/cart-service";
import { listAddresses } from "@/lib/address/address-service";
import type { AddressData } from "@/components/checkout/address-card";

export const metadata: Metadata = {
  title: "Checkout - INKs & Walls",
};

export default async function CheckoutSessionPage({
  params,
}: {
  params: Promise<{ checkoutId: string }>;
}) {
  const resolvedParams = await params;
  let session;
  let errorMessage: string | null = null;
  let initialAddresses: AddressData[] = [];
  let isGuest = true;

  try {
    const cookieStore = await cookies();
    const currentUser = await getCurrentUser();
    const owner = await resolveCartOwner(cookieStore, currentUser);
    isGuest = owner.type !== "CUSTOMER";

    session = await getCheckoutSession(resolvedParams.checkoutId, cookieStore, currentUser);

    if (owner.type === "CUSTOMER" && owner.customerId) {
      initialAddresses = await listAddresses(owner.customerId);
    }
  } catch (error) {
    errorMessage = (error as Error).message;
  }

  if (errorMessage || !session) {
    return (
      <div className="container mx-auto p-8 text-center mt-20 max-w-lg">
        <h1 className="text-2xl font-bold mb-3">Checkout Unavailable</h1>
        <p className="text-destructive mb-6 text-sm">{errorMessage || "Session unavailable."}</p>
        <a
          href="/cart"
          className="inline-flex items-center justify-center px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-neutral-800 transition-colors"
        >
          Return to Cart
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 lg:px-8 max-w-7xl">
      <h1 className="text-3xl font-bold mb-8 text-center md:text-left tracking-tight">Checkout</h1>
      <div className="flex flex-col lg:flex-row gap-12 items-start">
        {/* Main Checkout Flow */}
        <div className="flex-1 order-2 lg:order-1 w-full">
          <CheckoutFlow
            session={session}
            initialAddresses={initialAddresses}
            isGuest={isGuest}
          />
        </div>

        {/* Order Summary */}
        <div className="w-full lg:w-[380px] xl:w-[420px] order-1 lg:order-2 sticky top-6">
          <CheckoutSummary session={session} />
        </div>
      </div>
    </div>
  );
}

