import { Kbd } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex items-center gap-4">
      <Kbd>Esc</Kbd>
      <Kbd variant="outline">Esc</Kbd>
    </div>
  );
}
