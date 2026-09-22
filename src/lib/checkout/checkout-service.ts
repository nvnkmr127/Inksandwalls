import "server-only";
import { prisma } from "@/lib/prisma";
import { CheckoutStatus, CartStatus } from "@prisma/client";
import { getCartWithFreshPricing, resolveCartOwner, CookieStoreLike } from "@/lib/cart/cart-service";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { ValidationError, UnauthorizedError } from "@/lib/errors";
import { cookies } from "next/headers";
import {
  AddressInput,
  CheckoutContactInput,
  UpdateCheckoutAddressInput,
  SelectDeliveryOptionInput,
} from "./checkout-schema";

export async function startCheckout(
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);
  
  // Get cart and recalculate authoritative pricing
  const cartView = await getCartWithFreshPricing(cookieStore, currentUser);
  
  if (!cartView || cartView.items.length === 0) {
    throw new ValidationError("Your cart is empty.");
  }
  
  if (cartView.hasUnavailableItems) {
    throw new ValidationError("Some items in your cart are currently unavailable.");
  }

  // Find existing active checkout for this cart
  let checkoutSession = await prisma.checkoutSession.findFirst({
    where: {
      cartId: cartView.cartId,
      status: CheckoutStatus.ACTIVE,
    },
  });

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

  if (!checkoutSession) {
    // Create new checkout session
    checkoutSession = await prisma.checkoutSession.create({
      data: {
        cartId: cartView.cartId,
        customerId: owner.type === "CUSTOMER" ? owner.customerId : null,
        sessionId: owner.type === "GUEST" ? owner.sessionId : null,
        status: CheckoutStatus.ACTIVE,
        email: currentUser?.email || "",
        phone: currentUser?.phone || null,
        subtotalPaise: cartView.subtotalPaise,
        taxAmountPaise: 0, // Implement tax logic if needed
        totalAmountPaise: cartView.subtotalPaise,
        expiresAt,
      },
    });
  } else {
    // Update pricing snapshot if it changed
    if (checkoutSession.subtotalPaise !== cartView.subtotalPaise) {
      checkoutSession = await prisma.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: {
          subtotalPaise: cartView.subtotalPaise,
          totalAmountPaise: cartView.subtotalPaise + (checkoutSession.deliveryAmountPaise || 0),
          expiresAt, // Reset expiration
        },
      });
    }
  }

  return checkoutSession;
}

export async function getCheckoutSession(checkoutId: string, customStore?: CookieStoreLike, customUser?: CurrentUser | null) {
  const cookieStore = customStore || (await cookies());
  const currentUser = customUser !== undefined ? customUser : await getCurrentUser();
  const owner = await resolveCartOwner(cookieStore, currentUser);

  const checkoutSession = await prisma.checkoutSession.findUnique({
    where: { id: checkoutId },
    include: {
      shippingAddress: true,
      billingAddress: true,
      cart: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!checkoutSession) {
    throw new ValidationError("Checkout session not found.");
  }

  // Verify ownership
  if (owner.type === "CUSTOMER" && checkoutSession.customerId !== owner.customerId) {
    throw new UnauthorizedError("Unauthorized access to checkout session.");
  }
  
  if (owner.type === "GUEST" && checkoutSession.sessionId !== owner.sessionId) {
    throw new UnauthorizedError("Unauthorized access to checkout session.");
  }

  if (checkoutSession.status === CheckoutStatus.EXPIRED || new Date() > checkoutSession.expiresAt) {
    if (checkoutSession.status !== CheckoutStatus.EXPIRED) {
      await prisma.checkoutSession.update({
        where: { id: checkoutSession.id },
        data: { status: CheckoutStatus.EXPIRED },
      });
    }
    throw new ValidationError("This checkout session has expired. Please restart checkout.");
  }

  return checkoutSession;
}

export async function updateCheckoutContact(
  checkoutId: string,
  input: CheckoutContactInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const session = await getCheckoutSession(checkoutId, customStore, customUser);

  return await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      email: input.email,
      phone: input.phone || null,
    },
  });
}

export async function updateCheckoutAddress(
  checkoutId: string,
  input: UpdateCheckoutAddressInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const session = await getCheckoutSession(checkoutId, customStore, customUser);
  const owner = await resolveCartOwner(customStore, customUser);

  const customerId = owner.type === "CUSTOMER" ? owner.customerId : null;

  // Create or update shipping address
  const shippingAddress = await prisma.address.create({
    data: {
      ...input.shippingAddress,
      customerId,
    },
  });

  let billingAddress = shippingAddress;
  if (!input.useShippingAsBilling && input.billingAddress) {
    billingAddress = await prisma.address.create({
      data: {
        ...input.billingAddress,
        customerId,
      },
    });
  }

  return await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      shippingAddressId: shippingAddress.id,
      billingAddressId: billingAddress.id,
    },
    include: {
      shippingAddress: true,
      billingAddress: true,
    },
  });
}

export async function selectDeliveryOption(
  checkoutId: string,
  input: SelectDeliveryOptionInput,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const session = await getCheckoutSession(checkoutId, customStore, customUser);

  // In a real implementation, you would validate the option and calculate the cost.
  // For now, we stub it based on PRD requirements.
  const deliveryAmountPaise = input.deliveryOption === "standard" ? 50000 : 100000; // Fake prices for now
  
  return await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      deliveryOption: input.deliveryOption,
      deliveryAmountPaise,
      totalAmountPaise: session.subtotalPaise + session.taxAmountPaise + deliveryAmountPaise,
    },
  });
}

export async function confirmCheckout(
  checkoutId: string,
  customStore?: CookieStoreLike,
  customUser?: CurrentUser | null
) {
  const session = await getCheckoutSession(checkoutId, customStore, customUser);

  if (!session.shippingAddressId || !session.billingAddressId) {
    throw new ValidationError("Shipping and billing addresses are required.");
  }
  
  if (!session.email) {
    throw new ValidationError("Contact information is required.");
  }

  // Double check cart pricing before final confirmation
  const cartView = await getCartWithFreshPricing(customStore, customUser);
  
  if (cartView.subtotalPaise !== session.subtotalPaise || cartView.hasUnavailableItems) {
     throw new ValidationError("Cart totals have changed. Please review your order.");
  }

  return await prisma.checkoutSession.update({
    where: { id: session.id },
    data: {
      status: CheckoutStatus.COMPLETED,
    },
  });
}
