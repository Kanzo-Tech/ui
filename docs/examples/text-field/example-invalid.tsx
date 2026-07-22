import { TextField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <TextField defaultValue="My Dataset" invalid />
      <TextField defaultValue="urn:kanzo:customers" disabled />
    </div>
  );
}
