import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Toggle, ToggleIndicator } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Toggle aria-label="Show settled contracts" variant="outline">
      <ToggleIndicator fallback={<EyeOffIcon />}>
        <EyeIcon />
      </ToggleIndicator>
    </Toggle>
  );
}
