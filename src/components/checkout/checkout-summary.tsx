export interface CheckoutSummaryProps {
  session: Record<string, unknown>;
}

export function CheckoutSummary({ session }: CheckoutSummaryProps) {
  return <div>Checkout Summary (Total: {String(session?.totalAmountPaise ?? "0")} paise)</div>;
}
