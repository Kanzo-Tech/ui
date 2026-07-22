import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup defaultValue="ttl" disabled>
        <RadioGroupItem value="ttl">Whole group disabled</RadioGroupItem>
        <RadioGroupItem value="jsonld">JSON-LD</RadioGroupItem>
      </RadioGroup>

      <RadioGroup defaultValue="ttl">
        <RadioGroupItem value="ttl">Turtle</RadioGroupItem>
        <RadioGroupItem disabled value="nq">
          N-Quads — one item disabled
        </RadioGroupItem>
      </RadioGroup>
    </div>
  );
}
