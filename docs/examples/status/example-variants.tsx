import { Status } from "@kanzo-tech/ui";

const states = [
  { variant: "default", label: "Unknown" },
  { variant: "success", label: "Connected" },
  { variant: "info", label: "Syncing" },
  { variant: "warning", label: "Degraded" },
  { variant: "destructive", label: "Failed" },
] as const;

export default function Example() {
  return (
    <div className="flex flex-col gap-2">
      {states.map((state) => (
        <span
          className="inline-flex items-center gap-2 text-sm"
          key={state.variant}
        >
          <Status variant={state.variant} />
          {state.label}
        </span>
      ))}
    </div>
  );
}
