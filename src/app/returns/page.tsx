import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Returns | INKs & Walls",
};

export default function ReturnsPage() {
  return <PublicPage slug="returns" />;
}
