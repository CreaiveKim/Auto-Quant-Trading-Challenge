import type { PortfolioResponse } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __paperAccounts__: Record<string, PortfolioResponse> | undefined;
}

export const paperStore: Record<string, PortfolioResponse> =
  global.__paperAccounts__ ?? {};

if (!global.__paperAccounts__) {
  global.__paperAccounts__ = paperStore;
}
