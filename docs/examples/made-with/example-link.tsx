import { MadeWith } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-center gap-3">
      <MadeWith href="https://kanzo.tech" />
      <MadeWith by="ACME Data" href="https://example.com" />
    </div>
  );
}
