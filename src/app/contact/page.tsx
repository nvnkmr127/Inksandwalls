import { PublicPage } from "@/components/pages/public-page";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact | INKs & Walls",
};

export default function ContactPage() {
  return <PublicPage slug="contact" />;
}
