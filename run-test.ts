import { runOrderListTests } from "./src/lib/order/__tests__/order-list-service.test";
import { runAddressProfileTests } from "./src/lib/address/__tests__/address-profile.test";

async function main() {
  await runOrderListTests().catch(console.error);
  await runAddressProfileTests().catch(console.error);
}

main();
