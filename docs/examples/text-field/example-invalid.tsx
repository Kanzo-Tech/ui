import { TextField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <TextField defaultValue="Q-9000" invalid />
      <TextField defaultValue="Q-1041" disabled />
    </div>
  );
}
