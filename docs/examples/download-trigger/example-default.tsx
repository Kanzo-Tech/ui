import { Button, DownloadTrigger } from "@kanzo-tech/ui";
import { DownloadIcon } from "lucide-react";

const schema = JSON.stringify(
  { "@context": "https://schema.org", "@type": "Dataset", name: "Readings" },
  null,
  2
);

export default function Example() {
  return (
    <DownloadTrigger
      asChild
      data={schema}
      fileName="schema.json"
      mimeType="application/json"
    >
      <Button variant="outline">
        <DownloadIcon />
        Download schema.json
      </Button>
    </DownloadTrigger>
  );
}
