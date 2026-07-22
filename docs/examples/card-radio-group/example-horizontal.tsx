import { CodeIcon, WandIcon } from "lucide-react";
import { CardRadioGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <CardRadioGroup
      className="w-[28rem]"
      columns={2}
      defaultValue="studio"
      options={[
        {
          value: "studio",
          label: "Studio",
          description: "Write the mapping yourself, in the editor.",
          icon: <CodeIcon />,
        },
        {
          value: "assistant",
          label: "Assistant",
          description: "Describe the result and let the assistant draft it.",
          icon: <WandIcon />,
        },
      ]}
      orientation="horizontal"
      showIndicator
    />
  );
}
