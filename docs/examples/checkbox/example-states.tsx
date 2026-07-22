import { Checkbox } from "@kanzo-tech/ui";

/** The four states side by side, including indeterminate — which is the one people forget
 *  exists and then reimplement with a second boolean. */
export default function Example() {
  return (
    <div className="flex flex-col gap-3">
      <Checkbox>Unchecked</Checkbox>
      <Checkbox defaultChecked>Checked</Checkbox>
      <Checkbox defaultChecked="indeterminate">Indeterminate</Checkbox>
      <Checkbox defaultChecked disabled>
        Disabled
      </Checkbox>
    </div>
  );
}
