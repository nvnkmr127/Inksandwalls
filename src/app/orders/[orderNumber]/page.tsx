import { redirect } from "next/navigation";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const resolvedParams = await params;
  redirect(`/checkout/success?orderNumber=${resolvedParams.orderNumber}`);
}
