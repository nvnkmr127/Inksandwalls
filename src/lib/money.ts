export type ProductPricingInput = {
  productType: "PER_AREA" | "FIXED" | string;
  price?: number | null;
  rate?: number | null;
};

export interface FormattedPriceDisplay {
  formattedPrice: string;
  unitLabel?: string;
  displayString: string;
}

/**
 * Format integer minor units (paise) into INR currency string.
 * e.g., 499900 -> "₹4,999"
 */
export function formatPaiseToRupees(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(rupees);
}

/**
 * Canonical product price display formatter for storefront listings and cards.
 * Adheres to PRD:
 * - PER_AREA: "From ₹<rate> / sq ft"
 * - FIXED: "₹<price>"
 */
export function formatProductPriceDisplay(product: ProductPricingInput): FormattedPriceDisplay {
  if (product.productType === "PER_AREA") {
    if (product.rate != null && product.rate > 0) {
      const formatted = formatPaiseToRupees(product.rate);
      return {
        formattedPrice: formatted,
        unitLabel: "/ sq ft",
        displayString: `From ${formatted} / sq ft`,
      };
    }
    return {
      formattedPrice: "Contact for pricing",
      displayString: "Contact for pricing",
    };
  }

  if (product.price != null && product.price > 0) {
    const formatted = formatPaiseToRupees(product.price);
    return {
      formattedPrice: formatted,
      displayString: formatted,
    };
  }

  return {
    formattedPrice: "Price on request",
    displayString: "Price on request",
  };
}
