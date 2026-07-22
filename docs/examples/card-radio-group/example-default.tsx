import { BotIcon, CodeIcon, WandIcon } from "lucide-react";
import { CardRadioGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <CardRadioGroup
      className="w-96"
      defaultValue="openai"
      options={[
        { value: "openai", label: "OpenAI", icon: <BotIcon /> },
        {
          value: "anthropic",
          label: "Anthropic",
          icon: <WandIcon />,
          badge: "Recommended",
        },
        { value: "mistral", label: "Mistral", icon: <CodeIcon /> },
      ]}
    />
  );
}
