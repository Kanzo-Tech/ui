import { AVAILABILITY } from "@/example/world";
import { Status } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-col gap-2">
      {AVAILABILITY.map((state) => (
        <span className="inline-flex items-center gap-2 text-sm" key={state.id}>
          <Status variant={state.tone} />
          {state.label}
        </span>
      ))}
    </div>
  );
}
