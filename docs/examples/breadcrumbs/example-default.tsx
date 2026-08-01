import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "The board", href: "#" },
        { label: "Ashfall Reach", href: "#" },
        { label: "Q-1058" },
      ]}
    />
  );
}
