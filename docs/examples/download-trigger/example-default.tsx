import { dueOn, openQuests } from "@/example/quests";
import { Button, DownloadTrigger } from "@kanzo-tech/ui";
import { DownloadIcon } from "lucide-react";

const board = [
  "id,title,region,grade,reward,due",
  ...openQuests().map((contract) =>
    [
      contract.id,
      `"${contract.title}"`,
      contract.region,
      contract.grade,
      contract.reward,
      dueOn(contract),
    ].join(","),
  ),
].join("\n");

export default function Example() {
  return (
    <DownloadTrigger
      asChild
      data={board}
      fileName="open-contracts.csv"
      mimeType="text/csv"
    >
      <Button variant="outline">
        <DownloadIcon />
        Export the board
      </Button>
    </DownloadTrigger>
  );
}
