"use client";

import { blockers, bypass, evaluate, locationOf, type Blocker } from "./registry";
import type { HistoryAction } from "./types";

/**
 * The browser half: the Navigation API's `navigate` event and `beforeunload`. Nothing here knows a
 * router, and nothing here touches `history` — every navigation is either cancelled through a
 * public event or left alone.
 *
 * The listeners exist only while a blocker does. MDN: a `beforeunload` listener costs a page its
 * back/forward cache in Firefox, so a page with nothing to protect must carry none.
 */

/** The slice of the Navigation API this reads. TypeScript's DOM lib does not declare it yet. */
interface HistoryEntry {
  key: string;
  index: number;
  url: string | null;
}

interface NavigateEvent extends Event {
  navigationType: "push" | "replace" | "reload" | "traverse";
  destination: {
    url: string;
    key: string;
    index: number;
    sameDocument: boolean;
    getState(): unknown;
  };
  formData: FormData | null;
  downloadRequest: string | null;
}

export interface Navigation extends EventTarget {
  currentEntry: HistoryEntry | null;
  navigate(url: string, options?: { history?: "push" | "replace"; state?: unknown }): unknown;
  traverseTo(key: string): unknown;
}

const navigationOf = (): Navigation | undefined =>
  (window as unknown as { navigation?: Navigation }).navigation;

function actionOf(event: NavigateEvent, navigation: Navigation): HistoryAction {
  if (event.navigationType === "push") return "PUSH";
  if (event.navigationType === "replace") return "REPLACE";
  const delta = event.destination.index - (navigation.currentEntry?.index ?? -2);
  return delta === -1 ? "BACK" : delta === 1 ? "FORWARD" : "GO";
}

/** Replays a navigation `proceed` allowed, past the blockers it was cancelled by. */
function replay(event: NavigateEvent, navigation: Navigation) {
  bypass.navigate = true;
  if (!event.destination.sameDocument) bypass.beforeunload = true;
  if (event.navigationType === "traverse") {
    navigation.traverseTo(event.destination.key);
    return;
  }
  navigation.navigate(event.destination.url, {
    history: event.navigationType === "replace" ? "replace" : "push",
    state: event.destination.getState(),
  });
}

function onNavigate(raw: Event) {
  const event = raw as NavigateEvent;
  const navigation = navigationOf();
  if (!navigation) return;
  if (bypass.navigate) {
    bypass.navigate = false;
    return;
  }
  // A reload is `beforeunload`'s. A same-document push or replace is a router writing the URL of a
  // page it has already rendered — too late to cancel — or a hash, which leaves nothing.
  if (event.navigationType === "reload") return;
  if (event.navigationType !== "traverse" && event.destination.sameDocument) return;
  // A POST cannot be replayed through `navigation.navigate`, and a download leaves the page as it
  // was. Both stay with the browser, which asks through `beforeunload` where it applies.
  if (event.formData !== null || event.downloadRequest !== null) return;
  // Browser UI, and a traversal with no history-action activation left: the platform decides.
  if (!event.cancelable) return;

  const verdict = evaluate({
    current: locationOf(location.href),
    next: locationOf(event.destination.url),
    action: actionOf(event, navigation),
  });
  if (verdict === false) return;
  event.preventDefault();
  if (verdict === true) return;
  void verdict.then((block) => {
    if (!block) replay(event, navigation);
  });
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (bypass.beforeunload) {
    bypass.beforeunload = false;
    return;
  }
  if (!blockers.some((blocker) => blocker.enableBeforeUnload())) return;
  event.preventDefault();
  // Still required by Chromium-based browsers for the dialog to show; the text itself is ignored.
  event.returnValue = "";
}

function listen() {
  window.addEventListener("beforeunload", onBeforeUnload);
  navigationOf()?.addEventListener("navigate", onNavigate);
}

function unlisten() {
  window.removeEventListener("beforeunload", onBeforeUnload);
  navigationOf()?.removeEventListener("navigate", onNavigate);
  bypass.navigate = false;
  bypass.beforeunload = false;
}

/** Adds a blocker at the end of the order and returns what removes it. */
export function register(blocker: Blocker): () => void {
  if (blockers.length === 0) listen();
  blockers.push(blocker);
  return () => {
    const at = blockers.indexOf(blocker);
    if (at === -1) return;
    blockers.splice(at, 1);
    if (blockers.length === 0) unlisten();
  };
}
