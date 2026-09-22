"use client";

import { useEffect, useState } from "react";
import { getCartItemCountAction } from "@/app/actions/cart";

export const CART_UPDATED_EVENT = "inks_cart_updated";

/**
 * Dispatch a client-side cart update event to synchronize header badges.
 */
export function notifyCartUpdated(count?: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT, { detail: { count } }));
  }
}

/**
 * Hook to keep the cart item count synchronized across the application.
 */
export function useCartCount(initialCount: number = 0) {
  const [count, setCount] = useState<number>(initialCount);

  useEffect(() => {
    let mounted = true;

    void getCartItemCountAction()
      .then((liveCount) => {
        if (mounted) setCount(liveCount);
      })
      .catch(() => {
        // Ignore background sync errors
      });

    const handleCartEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (customEvent.detail && typeof customEvent.detail.count === "number") {
        setCount(customEvent.detail.count);
      } else {
        void getCartItemCountAction()
          .then((liveCount) => {
            if (mounted) setCount(liveCount);
          })
          .catch(() => {
            // Ignore background sync errors
          });
      }
    };

    window.addEventListener(CART_UPDATED_EVENT, handleCartEvent);
    return () => {
      mounted = false;
      window.removeEventListener(CART_UPDATED_EVENT, handleCartEvent);
    };
  }, []);

  return count;
}
