import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy | INKs & Walls",
};

export default function PrivacyPage() {
  return <PublicPage slug="privacy" />;
}
