-- CreateEnum
CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'ABANDONED');

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "customer_id" TEXT,
    "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_type" "ProductType" NOT NULL,
    "variant_id" TEXT,
    "variant_name" TEXT,
    "sku" TEXT,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "unit" TEXT,
    "width_ft" DOUBLE PRECISION,
    "height_ft" DOUBLE PRECISION,
    "entered_area_sqft" DOUBLE PRECISION,
    "wastage_pct" DOUBLE PRECISION,
    "wastage_area_sqft" DOUBLE PRECISION,
    "area_with_wastage_sqft" DOUBLE PRECISION,
    "min_area_sqft" DOUBLE PRECISION,
    "is_min_area_applied" BOOLEAN,
    "billable_area_sqft" DOUBLE PRECISION,
    "roll_width_ft" DOUBLE PRECISION,
    "panels_needed" INTEGER,
    "rate_paise" INTEGER,
    "unit_price_paise" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price_paise" INTEGER NOT NULL,
    "options" JSONB,
    "media_key" TEXT,
    "returnable" BOOLEAN NOT NULL DEFAULT true,
    "hsn_code" TEXT,
    "config_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carts_session_id_key" ON "carts"("session_id");

-- CreateIndex
CREATE INDEX "carts_session_id_idx" ON "carts"("session_id");

-- CreateIndex
CREATE INDEX "carts_customer_id_idx" ON "carts"("customer_id");

-- CreateIndex
CREATE INDEX "carts_status_idx" ON "carts"("status");

-- CreateIndex
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

-- CreateIndex
CREATE INDEX "cart_items_product_id_idx" ON "cart_items"("product_id");

-- CreateIndex
CREATE INDEX "cart_items_variant_id_idx" ON "cart_items"("variant_id");

-- CreateIndex
CREATE INDEX "cart_items_config_hash_idx" ON "cart_items"("config_hash");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_config_hash_key" ON "cart_items"("cart_id", "config_hash");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
