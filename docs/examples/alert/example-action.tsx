import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from "@kanzo-tech/ui";
import { TriangleAlertIcon } from "lucide-react";

/**
 * `AlertAction` is the reason `Alert` is a grid rather than a flex row: its presence is what
 * switches the root to a trailing `auto` column, so the buttons sit beside the text on a wide
 * alert and drop under it on a narrow one without either side measuring the other.
 */
export default function Example() {
  return (
    <div className="flex w-full max-w-lg flex-col gap-3">
      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Schema drift detected</AlertTitle>
        <AlertDescription>Two columns changed type since the last run.</AlertDescription>
        <AlertAction>
          <Button size="sm" variant="ghost">
            Dismiss
          </Button>
          <Button size="sm" variant="outline">
            Review
          </Button>
        </AlertAction>
      </Alert>

      <Alert>
        <AlertTitle>Draft saved</AlertTitle>
        <AlertAction>
          <Button size="sm" variant="ghost">
            Undo
          </Button>
        </AlertAction>
      </Alert>
    </div>
  );
}
