import {
  SectionBody,
  SectionDescription,
  SectionHeader,
  SectionRoot,
  SectionTitle,
  SectionTitleGroup,
} from "@kanzo-tech/ui";

const sections = [
  {
    title: "Party rules",
    description: "Checked when a party signs, and again when it comes back.",
    rules: ["No more than six on a contract", "A healer on anything past the river"],
  },
  {
    title: "Payment",
    description: "Settled at the hall, in the coin the patron posted.",
    rules: ["Half on signing", "The rest on the proof of kill"],
  },
];

export default function Example() {
  return (
    <div className="flex h-64 w-96 flex-col gap-6 overflow-auto rounded-lg border p-4">
      {sections.map((section) => (
        <SectionRoot fill={false} key={section.title}>
          <SectionHeader>
            <SectionTitleGroup>
              <SectionTitle level={3}>{section.title}</SectionTitle>
              <SectionDescription>{section.description}</SectionDescription>
            </SectionTitleGroup>
          </SectionHeader>
          <SectionBody className="pt-3 text-sm">
            <ul className="list-disc ps-5">
              {section.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </SectionBody>
        </SectionRoot>
      ))}
    </div>
  );
}
