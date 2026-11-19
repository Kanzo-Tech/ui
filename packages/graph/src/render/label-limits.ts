/**
 * The label budgets, in a module with no React so that `./section` can state them without pulling
 * in the hooks that apply them (`parts/labels.ts`). The numbers are ours; Cosmograph v2 documents
 * 30 for both of its limits.
 */

/** The biggest points Top labels: Cosmograph's `showTopLabelsLimit`. */
export const TOP_LABELS = 150;
/** The biggest of the view's sample Visible labels: Cosmograph's `showDynamicLabelsLimit`. */
export const VISIBLE_LABELS = 100;
/** cosmos.gl's `pointSamplingDistance`, in screen pixels: the view's sample is one point per cell. */
export const CELL = 100;
