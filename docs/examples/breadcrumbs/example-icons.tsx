import { DatabaseIcon, HouseIcon } from "lucide-react";
import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "Kanzo", href: "#", icon: <HouseIcon /> },
        { label: "Connections", href: "#", icon: <DatabaseIcon /> },
        { label: "aemet-observations" },
      ]}
    />
  );
}
