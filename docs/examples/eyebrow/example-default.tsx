import { Eyebrow } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <section className="flex w-full max-w-xs flex-col gap-2">
      <Eyebrow asChild>
        <h3>How it fits together</h3>
      </Eyebrow>
      <ul className="flex flex-col divide-y text-sm">
        <li className="py-1.5">A laureate won an award</li>
        <li className="py-1.5">An award is in a category</li>
        <li className="py-1.5">A laureate studied at a university</li>
      </ul>
    </section>
  );
}
