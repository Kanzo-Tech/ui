import { RadioGroup, RadioGroupItem } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-6">
      <RadioGroup defaultValue="amber" disabled>
        <RadioGroupItem value="amber">Whole group disabled</RadioGroupItem>
        <RadioGroupItem value="salt">The Order of Salt</RadioGroupItem>
      </RadioGroup>

      <RadioGroup defaultValue="amber">
        <RadioGroupItem value="amber">The Amber Hall</RadioGroupItem>
        <RadioGroupItem disabled value="lanternwood">
          Lanternwood — invited, not chartered
        </RadioGroupItem>
      </RadioGroup>
    </div>
  );
}
