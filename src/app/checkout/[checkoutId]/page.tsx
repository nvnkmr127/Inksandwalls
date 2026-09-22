import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCheckoutSession } from "@/lib/checkout/checkout-service";
import { CheckoutFlow } from "@/components/checkout/checkout-flow";
import { CheckoutSummary } from "@/components/checkout/checkout-summary";

export const metadata: Metadata = {
  title: "Checkout - INKs & Walls",
};

export default async function CheckoutSessionPage({
  params,
}: {
  params: { checkoutId: string };
}) {
  try {
    const session = await getCheckoutSession(params.checkoutId);

    return (
      <div className="container mx-auto px-4 py-8 lg:px-8 max-w-7xl">
        <h1 className="text-3xl font-bold mb-8 text-center md:text-left">Checkout</h1>
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Main Checkout Flow */}
          <div className="flex-1 order-2 lg:order-1">
            <CheckoutFlow session={session} />
          </div>

          {/* Order Summary */}
          <div className="w-full lg:w-[400px] xl:w-[450px] order-1 lg:order-2">
            <CheckoutSummary session={session} />
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return (
      <div className="container mx-auto p-8 text-center mt-20">
        <h1 className="text-2xl font-bold mb-4">Checkout Error</h1>
        <p className="text-red-600 mb-6">{(error as Error).message}</p>
        <a href="/cart" className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800">
          Return to Cart
        </a>
      </div>
    );
  }
}
