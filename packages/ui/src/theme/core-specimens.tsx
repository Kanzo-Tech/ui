import { themeData } from "@kanzo-tech/theme";
import type { PrefSpecimen } from "./section-context.js";

/**
 * The core's pictures — what its owner, the theme provider, hands every `<Pref>` beneath it.
 *
 * Density is drawn at its real size: the card resets to the browser's own size (`medium`) and the
 * specimen takes the step's percentage of it, which is exactly what `<html>` does with it.
 */
export const CORE_SPECIMENS: Readonly<Record<string, PrefSpecimen>> = {
  density: (option) => (
    <span className="leading-none" style={{ fontSize: "medium" }}>
      <span
        className="flex items-center gap-1 text-foreground"
        style={{ fontSize: themeData.densities[option.value as keyof typeof themeData.densities] }}
      >
        <span className="rounded-[0.25em] bg-primary px-[0.4em] py-[0.15em] text-[0.7em] font-medium text-primary-foreground">
          Aa
        </span>
        <span className="text-[0.8em]">abc</span>
      </span>
    </span>
  ),
};
