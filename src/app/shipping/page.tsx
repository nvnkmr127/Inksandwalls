import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shipping | INKs & Walls",
};

export default function ShippingPage() {
  return <PublicPage slug="shipping" />;
}
