import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "Bestiary", href: "#" },
        { label: "Cold-blooded", href: "#" },
        { label: "Basilisk" },
      ]}
      separator={<span aria-hidden>/</span>}
    />
  );
}
