import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | INKs & Walls",
};

export default function AboutPage() {
  return <PublicPage slug="about" />;
}
