import { JsonTreeView } from "@kanzo-tech/ui";

const data = {
  "@context": "https://schema.org",
  "@type": "Dataset",
  name: "Air quality readings",
  keywords: ["air", "quality", "sensor"],
  distribution: {
    "@type": "DataDownload",
    encodingFormat: "text/csv",
    contentSize: 20_480,
  },
  isAccessibleForFree: true,
  license: null,
};

export default function Example() {
  return (
    <div className="w-full max-w-md">
      <JsonTreeView data={data} defaultExpandedDepth={2} />
    </div>
  );
}
