"use client";

import type { CreateToasterReturn } from "@ark-ui/react/toast";
import * as React from "react";
import { toast as sharedToaster } from "../simples/toast.js";
import { useKanzoTheme } from "../theme/KanzoThemeProvider.js";

/**
 * The copy for "the identity you chose is no longer published", shared by the two surfaces that
 * say it: this toast, and the `Alert` inside `Preferences.Colour`. One state, said once.
 *
 * Both strings are **library-authored English**, which is exactly the distinction `PreferencesColor`'s `formatSide`
 * draws with its `formatName`: the library wrote "Light" and "Dark", so a caller who translates the
 * app has to be able to translate them. An identity's `label` is the opposite case — the client
 * authored it, at runtime — and takes no formatter, because a formatter over it would only let a
 * host decorate someone else's brand name.
 */
export interface IdentityRetiredCopy {
  /** Heading (i18n). */
  title?: string;
  /**
   * Compose the body. The default frame is English; a caller who translates `title` needs this
   * too, or the notice is half-translated.
   *
   * `identity` is the retired **id**, not a label: what the tenant withdrew is gone from
   * `identities`, so its label went with it. A host that keeps its own table of retired names is
   * the reason this is a function rather than a string.
   */
  formatDescription?: (parts: { identity: string }) => string;
}

const DEFAULT_TITLE = "Brand updated";
const DEFAULT_DESCRIPTION = ({ identity }: { identity: string }) =>
  `“${identity}” is no longer offered here. You are seeing the default.`;

/** Resolve the copy once, so the toast and the panel's Alert cannot drift into two wordings. */
export function identityRetiredCopy(
  { title = DEFAULT_TITLE, formatDescription = DEFAULT_DESCRIPTION }: IdentityRetiredCopy,
  identity: string,
): { title: string; description: string } {
  return { title, description: formatDescription({ identity }) };
}

export interface IdentityNoticeProps extends IdentityRetiredCopy {
  /** Feed a second, separately-placed viewport. Defaults to the shared `toast` instance. */
  toaster?: CreateToasterReturn;
}

/**
 * IdentityNotice — says, once, that the identity this user chose is no longer published.
 *
 * **Opt-in, and it renders nothing itself.** `KanzoThemeProvider` detects the retirement, clears
 * the preference and holds the id in `retiredIdentity`; it draws no surface, because a themer that
 * draws its own surface is what `KanzoTheme` was deleted for (`index.test.ts` keeps it deleted).
 * So mount this beside the host's own `<Toaster />` — it feeds that viewport and returns `null`.
 *
 * Why it is worth saying at all: the cascade already handled the colour. An attribute selector with
 * no matching rule is inert, so a withdrawn id falls through to `:root`, which is the default
 * identity. What is left is that somebody chose gold and is looking at blue, and silence makes that
 * read as a bug in our product rather than a change in their client's.
 *
 * The panel says the same thing in `Preferences.Colour`, from the same state —
 * and cannot always say it: that section hides itself below two published identities, so a tenant
 * who retired their way down to one brand has this as the only surface left.
 */
export const IdentityNotice = ({ toaster = sharedToaster, ...copy }: IdentityNoticeProps = {}) => {
  const { retiredIdentity } = useKanzoTheme();
  const { title, description } = identityRetiredCopy(copy, retiredIdentity ?? "");

  // Keyed on the id rather than a boolean: the provider's own ref guarantees it *detects* a
  // retirement once, not that this effect runs once. Two things still reach it — StrictMode's
  // double invocation when this mounts AFTER the detection (a host that renders the notice behind
  // a route), and an inline `formatDescription`, which is a new function on every render and so a
  // changed dep. Neither is the "once per session" question, which storage already answered.
  const said = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!retiredIdentity || said.current === retiredIdentity) return;
    said.current = retiredIdentity;
    toaster.create({ title, description, type: "info" });
  }, [retiredIdentity, title, description, toaster]);

  return null;
};
