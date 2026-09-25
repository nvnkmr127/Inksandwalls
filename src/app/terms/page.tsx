import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms | INKs & Walls",
};

export default function TermsPage() {
  return <PublicPage slug="terms" />;
}
