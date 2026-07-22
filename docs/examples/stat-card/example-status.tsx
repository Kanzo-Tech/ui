import { BoxesIcon, BriefcaseIcon, CloudIcon, DatabaseIcon } from "lucide-react";
import { StatCard } from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <StatCard
        description="catalogs generated"
        icon={<BoxesIcon />}
        label="DCAT Catalogs"
        value="7"
      />
      <StatCard
        description="accounts configured"
        icon={<CloudIcon />}
        label="Cloud Accounts"
        status="success"
        value="3"
      />
      <StatCard
        description="waiting on review"
        icon={<DatabaseIcon />}
        label="Drafts"
        status="warning"
        value="2"
      />
      <StatCard
        description="last run failed"
        icon={<BriefcaseIcon />}
        label="Jobs"
        status="danger"
        value="12"
      />
    </div>
  );
}
