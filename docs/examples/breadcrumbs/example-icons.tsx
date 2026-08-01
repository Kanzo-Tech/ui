import { MapPinIcon, ScrollTextIcon } from "lucide-react";
import { Breadcrumbs } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Breadcrumbs
      items={[
        { label: "The board", href: "#", icon: <ScrollTextIcon /> },
        { label: "Ashfall Reach", href: "#", icon: <MapPinIcon /> },
        { label: "Q-1058" },
      ]}
    />
  );
}
