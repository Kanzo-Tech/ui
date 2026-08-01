import { MadeWith } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col items-center gap-3">
      <MadeWith href="https://kanzo.tech" />
      <MadeWith by="The Amber Hall" href="https://amberhall.example" />
    </div>
  );
}
