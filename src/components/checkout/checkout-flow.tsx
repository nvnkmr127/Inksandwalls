export interface CheckoutFlowProps {
  session: Record<string, unknown>;
}

export function CheckoutFlow({ session }: CheckoutFlowProps) {
  return <div>Checkout Flow (Session: {String(session?.id || "Active")})</div>;
}
