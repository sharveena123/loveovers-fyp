import type { Href, Router } from "expo-router";

/** Tab & common buyer routes — use as `returnTo` when pushing modal screens */
export const BUYER_ROUTES = {
  home: "/(buyer)/buyerhome",
  profile: "/(buyer)/buyerprofile",
  orders: "/(buyer)/buyerorders",
  chat: "/(buyer)/buychat",
  map: "/(buyer)/buyermap",
  cart: "/(buyer)/buyercart",
} as const;

export type BuyerReturnTo = (typeof BUYER_ROUTES)[keyof typeof BUYER_ROUTES];

export const SELLER_ROUTES = {
  dashboard: "/(seller)/(tabs)/dashboard",
  profile: "/(seller)/(tabs)/profile",
  orders: "/(seller)/(tabs)/orders",
  chat: "/(seller)/(tabs)/sellerchat",
} as const;

export type SellerReturnTo = (typeof SELLER_ROUTES)[keyof typeof SELLER_ROUTES];

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Push a screen and remember where to return (fixes tab back going to wrong tab). */
export function pushWithReturn(
  router: Router,
  pathname: string,
  returnTo: string,
  params?: Record<string, string>,
) {
  router.push({
    pathname,
    params: { ...(params ?? {}), returnTo },
  } as never);
}

/**
 * Prefer explicit returnTo from the screen that opened this one;
 * otherwise pop the stack; otherwise go to fallback tab.
 */
export function goBackToReturn(
  router: Router,
  returnTo: string | string[] | undefined,
  fallback: string,
) {
  const target = firstParam(returnTo);
  if (target) {
    router.navigate(target as Href);
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.navigate(fallback as Href);
}
