"use client";

import { useSyncExternalStore } from "react";
import { STORES, storeFor, type StoreId } from "@/lib/site";

// The visitor's browser never changes while the page is open: nothing to subscribe to.
const subscribe = () => () => {};
const browserStore = (): StoreId => storeFor(navigator.userAgent).id;
const builtStore = (): StoreId => "chrome";

// "Add to Chrome", "Add to Firefox" or "Add to Edge", for the visitor's browser. The page is built
// with the Chrome link, so it works before (and without) this script; the browser then shows its
// own store.
export function InstallButton({ className, shortLabel }: { className: string; shortLabel?: string }) {
  const id = useSyncExternalStore(subscribe, browserStore, builtStore);
  const store = STORES.find((candidate) => candidate.id === id) ?? STORES[0];
  return (
    <a href={store.url} className={className} rel="noopener">
      {shortLabel ? (
        <>
          {/* Phones keep the header on one line with the short label. */}
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{store.label}</span>
        </>
      ) : (
        store.label
      )}
    </a>
  );
}
