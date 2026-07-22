import { MadeWithKanzo } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-center gap-3">
      <MadeWithKanzo href="https://kanzo.tech" />
      <MadeWithKanzo by="ACME Data" href="https://example.com" />
    </div>
  );
}
