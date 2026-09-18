import { describe, it } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  validateImageFile,
  detectImageFormatFromMagicBytes,
} from "../validation";
import { generateObjectKey, sanitizeKeySegment } from "../../storage/keys";
import { getVariantNameForWidth } from "../../images/r2-loader";
import { processImageVariants, VARIANT_BREAKPOINTS } from "../pipeline";

describe("Media Pipeline & Validation Tests", () => {
  describe("Magic Bytes & Format Detection", () => {
    it("detects JPEG magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      assert.equal(detectImageFormatFromMagicBytes(jpegBuffer), "jpeg");
    });

    it("detects PNG magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      assert.equal(detectImageFormatFromMagicBytes(pngBuffer), "png");
    });

    it("detects WebP magic bytes", () => {
      // 'RIFF' + 4 bytes + 'WEBP'
      const webpBuffer = Buffer.from([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]);
      assert.equal(detectImageFormatFromMagicBytes(webpBuffer), "webp");
    });

    it("returns null for non-image binary buffer", () => {
      const randomBuffer = Buffer.from("Hello world script binary content");
      assert.equal(detectImageFormatFromMagicBytes(randomBuffer), null);
    });
  });

  describe("File Validation", () => {
    it("rejects empty buffers", () => {
      const result = validateImageFile(Buffer.alloc(0), "image/jpeg");
      assert.equal(result.valid, false);
      assert.match(result.error || "", /Empty/);
    });

    it("rejects files exceeding size limit", () => {
      const dummyPng = Buffer.alloc(100);
      dummyPng[0] = 0x89;
      dummyPng[1] = 0x50;
      dummyPng[2] = 0x4e;
      dummyPng[3] = 0x47;

      const result = validateImageFile(dummyPng, "image/png", 50); // limit 50 bytes
      assert.equal(result.valid, false);
      assert.match(result.error || "", /exceeds/);
    });

    it("rejects unsupported MIME types", () => {
      const dummyBuf = Buffer.alloc(20);
      const result = validateImageFile(dummyBuf, "application/pdf");
      assert.equal(result.valid, false);
      assert.match(result.error || "", /Unsupported image MIME/);
    });

    it("passes validation for authentic PNG payload", () => {
      const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      ]);
      const result = validateImageFile(pngBuffer, "image/png");
      assert.equal(result.valid, true);
      assert.equal(result.detectedFormat, "png");
    });
  });

  describe("Safe Object Key Generation", () => {
    it("sanitizes unsafe path traversal input", () => {
      const sanitized = sanitizeKeySegment("../../admin/secret");
      assert.equal(sanitized.includes(".."), false);
      assert.equal(sanitized.includes("/"), false);
    });

    it("generates deterministic key path matching specification", () => {
      const key = generateObjectKey({
        resource: "products",
        uniqueId: "test-item-123",
        variant: "thumbnail",
        format: "webp",
      });
      assert.equal(key, "uploads/products/test-item-123/thumbnail.webp");
    });
  });

  describe("Variant Breakpoints & Loader Logic", () => {
    it("maps responsive widths to correct variant name", () => {
      assert.equal(getVariantNameForWidth(150), "thumbnail");
      assert.equal(getVariantNameForWidth(500), "small");
      assert.equal(getVariantNameForWidth(1000), "medium");
      assert.equal(getVariantNameForWidth(1600), "large");
      assert.equal(getVariantNameForWidth(2200), "original");
    });

    it("verifies variant breakpoints array", () => {
      assert.equal(VARIANT_BREAKPOINTS.length, 5);
      assert.equal(VARIANT_BREAKPOINTS[0].maxWidth, 200);
      assert.equal(VARIANT_BREAKPOINTS[4].maxWidth, 2560);
    });
  });

  describe("Sharp Processing Pipeline Integration", () => {
    it("processes sharp image variants and extracts metadata", async () => {
      // Create a 800x600 test PNG image buffer using Sharp
      const sampleBuffer = await sharp({
        create: {
          width: 800,
          height: 600,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      const result = await processImageVariants(sampleBuffer);

      assert.equal(result.sourceMetadata.width, 800);
      assert.equal(result.sourceMetadata.height, 600);
      assert.equal(result.variants.length, 5);

      const thumbnail = result.variants.find((v) => v.name === "thumbnail");
      assert.ok(thumbnail);
      assert.equal(thumbnail.width, 200);
      assert.equal(thumbnail.format, "webp");
      assert.ok(thumbnail.size > 0);

      const large = result.variants.find((v) => v.name === "large");
      assert.ok(large);
      assert.equal(large.width, 800); // withoutEnlargement: source is 800, so max 800
    });
  });
});
