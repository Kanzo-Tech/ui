import { CardRadioGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-96 flex-col gap-6">
      <CardRadioGroup
        defaultValue="openai"
        options={[
          { value: "openai", label: "OpenAI" },
          {
            value: "mistral",
            label: "Mistral",
            badge: "Not configured",
            disabled: true,
          },
        ]}
      />

      <CardRadioGroup
        defaultValue="openai"
        invalid
        options={[
          { value: "openai", label: "OpenAI" },
          { value: "anthropic", label: "Anthropic" },
        ]}
      />
    </div>
  );
}
