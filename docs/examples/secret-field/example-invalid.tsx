import { SecretField } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3">
      <SecretField defaultValue="hunter2" invalid revealable={false} />
      <SecretField defaultValue="hunter2" disabled />
    </div>
  );
}
