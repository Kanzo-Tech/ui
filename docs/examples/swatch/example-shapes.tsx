import { Swatch } from "@kanzo-tech/ui";

const SERIES = [
  { label: "Ingested", color: "#50fa7b" },
  { label: "Mapped", color: "#8be9fd" },
  { label: "Rejected", color: "#ff5555" },
];

export default function Example() {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex items-center gap-4">
        <Swatch color="#bd93f9" shape="square" size="md" />
        <Swatch color="#bd93f9" shape="round" size="md" />
      </div>

      {/* The label carries the identity; the swatch only repeats it in colour. */}
      <ul className="flex flex-col gap-1.5">
        {SERIES.map((series) => (
          <li className="flex items-center gap-2" key={series.label}>
            <Swatch color={series.color} shape="round" size="xs" />
            {series.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
