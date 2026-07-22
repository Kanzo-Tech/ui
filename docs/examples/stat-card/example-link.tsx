import { CloudIcon } from "lucide-react";
import { StatCard } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <StatCard
      description="accounts configured"
      href="#cloud-accounts"
      icon={<CloudIcon />}
      label="Cloud Accounts"
      status="success"
      value="3"
    />
  );
}
