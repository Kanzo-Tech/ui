import { Status } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <Status variant="success" />
      Ready
    </span>
  );
}
