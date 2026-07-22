import { CardRadioGroup } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <CardRadioGroup
      className="w-96"
      columns={3}
      defaultValue="geist"
      options={[
        {
          value: "geist",
          label: "Geist",
          preview: <span className="text-2xl">Aa</span>,
        },
        {
          value: "inter",
          label: "Inter",
          preview: <span className="text-2xl">Aa</span>,
        },
        {
          value: "system",
          label: "System",
          preview: <span className="text-2xl">Aa</span>,
        },
      ]}
    />
  );
}
