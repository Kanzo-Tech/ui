import { Status } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <Status size="sm" variant="success" />
      <Status size="md" variant="success" />
      <Status size="lg" variant="success" />
    </div>
  );
}
