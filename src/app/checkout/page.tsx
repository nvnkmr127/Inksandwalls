import { Metadata } from "next";
import { redirect } from "next/navigation";
import { startCheckout } from "@/lib/checkout/checkout-service";
import { ValidationError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Checkout - INKs & Walls",
  description: "Complete your purchase securely.",
};

export default async function CheckoutPage() {
  let checkoutSession;
  try {
    checkoutSession = await startCheckout();
  } catch (error) {
    if (error instanceof ValidationError) {
      // Empty cart or unavailable items, redirect to cart
      return (
        <div className="container mx-auto p-8 text-center mt-20">
          <h1 className="text-2xl font-bold mb-4">Checkout Error</h1>
          <p className="text-red-600 mb-6">{error.message}</p>
          <a href="/cart" className="px-6 py-2 bg-black text-white rounded hover:bg-gray-800">
            Return to Cart
          </a>
        </div>
      );
    }
    // Handle other errors gracefully
    throw error;
  }

  // If checkout was successfully initialized, we would render the checkout client component here.
  // We can pass the `checkoutSession.id` to a client component that manages the multistep flow.
  
  redirect(`/checkout/${checkoutSession.id}`);
}
