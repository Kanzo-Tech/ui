import { OBLIGATIONS, RAMP_NAMES } from "@kanzo-tech/palette";
import { TokenScaleView } from "./token-scale-view";

/**
 * The six ramps, every step, with the duty the derivation owes each one.
 *
 * Server half, for the reason `docs/package.json` records: `@kanzo-tech/palette` is authoring-time
 * and the RSC boundary is what keeps it out of the browser bundle. What crosses is prose the
 * compiler already owns — restating the obligations here would be the second spelling again, one
 * layer up.
 *
 * `step: 0` rows are ramp-wide (`monotone`, `hue-held`, `alpha-fidelity`, `control-boundary`) and
 * belong to no column. `control-boundary` in particular must not be drawn on step 8: the ramp
 * *reports* which step first reaches 3:1 and it is 9 in light 91 times of 116 and 8 in dark 79 —
 * a column label claiming a fixed step would be the hard-coding that `boundary` exists to prevent.
 */
export function TokenScale({ families = RAMP_NAMES }: { families?: readonly string[] }) {
  const duties: Record<number, string[]> = {};
  for (const { step, id } of OBLIGATIONS) {
    if (step < 1) continue;
    (duties[step] ??= []).push(id);
  }
  return <TokenScaleView duties={duties} families={families} />;
}
