import { Badge } from "@kanzo-tech/ui";

const datasets = [
  { name: "customers.ttl", state: "Mapped", variant: "success" },
  { name: "orders.ttl", state: "Partial", variant: "warning" },
  { name: "legacy.csv", state: "Failed", variant: "destructive" },
] as const;

export default function Example() {
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      {datasets.map(({ name, state, variant }) => (
        <div className="flex items-center justify-between gap-3" key={name}>
          <span className="truncate">{name}</span>
          <Badge variant={variant}>{state}</Badge>
        </div>
      ))}
    </div>
  );
}
