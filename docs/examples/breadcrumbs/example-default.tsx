import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "Kanzo", href: "#" },
        { label: "Connections", href: "#" },
        { label: "aemet-observations" },
      ]}
    />
  );
}
