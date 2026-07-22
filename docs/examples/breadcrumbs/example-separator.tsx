import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "abfss:", href: "#" },
        { label: "raw@kanzo", href: "#" },
        { label: "aemet" },
      ]}
      separator={<span aria-hidden>/</span>}
    />
  );
}
