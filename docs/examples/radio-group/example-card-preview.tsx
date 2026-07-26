import { RadioGroup, RadioGroupCard, RadioGroupText } from "@kanzo-tech/ui";

const FONTS = [
  { value: "geist", label: "Geist" },
  { value: "inter", label: "Inter" },
  { value: "system", label: "System" },
];

export default function Example() {
  return (
    <RadioGroup
      className="w-96 text-center *:flex-col *:items-center *:justify-center"
      columns={3}
      defaultValue="geist"
    >
      {FONTS.map((font) => (
        <RadioGroupCard key={font.value} value={font.value}>
          <span className="text-2xl">Aa</span>
          <RadioGroupText>{font.label}</RadioGroupText>
        </RadioGroupCard>
      ))}
    </RadioGroup>
  );
}
