import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/address/address-service";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./profile-form";
import AddressList from "./address-list";

export const metadata: Metadata = {
  title: "My Account | INKs & Walls",
  description: "Manage your account profile and addresses.",
};

export default async function AccountPage() {
  const user = await getCurrentUser();

  if (!user || !user.id || user.role === "GUEST") {
    redirect("/login?callbackUrl=/account");
  }

  // Ensure customer record exists
  let customer = await prisma.customer.findUnique({
    where: { userId: user.id },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: { userId: user.id },
    });
  }

  const addresses = await listAddresses(customer.id);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Account</h1>
        <p className="text-neutral-500">Manage your profile information and saved addresses.</p>
      </div>

      <div className="space-y-12">
        <section>
          <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
          <ProfileForm 
            initialData={{ 
              name: user.name || "", 
              email: user.email || "", 
              phone: user.phone || "" 
            }} 
          />
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Saved Addresses</h2>
          <AddressList initialAddresses={addresses} />
        </section>
      </div>
    </div>
  );
}
