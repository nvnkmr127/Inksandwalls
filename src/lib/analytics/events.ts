import { analyticsConfig } from "./config";

export type CommerceEvent =
  | "view_item"
  | "view_item_list"
  | "select_item"
  | "add_to_cart"
  | "remove_from_cart"
  | "view_cart"
  | "begin_checkout"
  | "add_payment_info"
  | "purchase";

export interface AnalyticsProduct {
  id: string;
  name: string;
  category?: string;
  variant?: string;
  price: number;
  quantity: number;
  currency?: string;
}

export interface AnalyticsEventPayload {
  event: CommerceEvent;
  currency?: string;
  value?: number;
  items?: AnalyticsProduct[];
  transaction_id?: string;
  payment_type?: string;
}

export function pushDataLayerEvent(payload: AnalyticsEventPayload) {
  if (typeof window === "undefined") return;
  
  if (!analyticsConfig.gtmContainerId && !analyticsConfig.ga4MeasurementId) {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null }); // Clear previous ecommerce object
  window.dataLayer.push({
    event: payload.event,
    ecommerce: {
      currency: payload.currency || "INR",
      value: payload.value,
      transaction_id: payload.transaction_id,
      payment_type: payload.payment_type,
      items: payload.items?.map((item, index) => ({
        item_id: item.id,
        item_name: item.name,
        item_category: item.category,
        item_variant: item.variant,
        price: item.price,
        quantity: item.quantity,
        index: index,
      })),
    },
  });
}

// Ensure TypeScript knows about window.dataLayer
declare global {
  interface Window {
    dataLayer: any[];
  }
}
