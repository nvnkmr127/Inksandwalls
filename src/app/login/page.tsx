import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSafeCallbackUrl } from "@/lib/auth/url";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your INKs & Walls account using WhatsApp OTP or Google.",
};

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    returnUrl?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawReturnUrl = params.returnUrl || params.callbackUrl;
  const safeReturnUrl = getSafeCallbackUrl(rawReturnUrl);

  // If already authenticated, redirect to destination
  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect(safeReturnUrl);
  }

  return (
    <div className="flex-1 flex flex-col justify-center items-center py-12 px-4 sm:px-6 lg:px-8 bg-muted/20">
      <LoginForm returnUrl={safeReturnUrl} />
    </div>
  );
}
