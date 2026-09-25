import { test, describe } from "node:test";
import assert from "node:assert";
import { getWhatsAppUrl } from "../whatsapp-button";

describe("WhatsApp Enquiry Button URL Builder", () => {
  test("generates correct wa.me link with clean number and encoded message", () => {
    const url = getWhatsAppUrl("+91 98765-43210", "Hello world!");
    assert.strictEqual(url, "https://wa.me/919876543210?text=Hello%20world!");
  });

  test("handles product context in message", () => {
    const url = getWhatsAppUrl("919876543210", "Hi, I would like to know more about the product: Vintage Floral Wallpaper (http://localhost:3000/products/vintage-floral)");
    assert.ok(url.includes("https://wa.me/919876543210?text="));
    assert.ok(url.includes("Vintage%20Floral%20Wallpaper"));
    assert.ok(url.includes("http%3A%2F%2Flocalhost%3A3000%2Fproducts%2Fvintage-floral"));
  });
});
