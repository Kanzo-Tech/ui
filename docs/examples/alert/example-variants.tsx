import { Alert, AlertDescription, AlertTitle } from "@kanzo-tech/ui";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "lucide-react";

/**
 * All five variants together, because the point of a status colour is the contrast BETWEEN
 * them — one alert on its own tells you nothing about whether the palette reads correctly.
 */
export default function Example() {
  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <Alert>
        <AlertTitle>Standing orders</AlertTitle>
        <AlertDescription>
          Checked when a party signs, and again when it comes back.
        </AlertDescription>
      </Alert>

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Q-1073 is a second attempt</AlertTitle>
        <AlertDescription>
          A re-posting is not the place to blood a copper.
        </AlertDescription>
      </Alert>

      <Alert variant="success">
        <CircleCheckIcon />
        <AlertTitle>Q-1043 settled</AlertTitle>
        <AlertDescription>
          Delivered, verified by an archivist, and paid.
        </AlertDescription>
      </Alert>

      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Q-1078 is two days overdue</AlertTitle>
        <AlertDescription>
          Something is relighting the lamps, and the party is still in Duskfen.
        </AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Q-1058 breaches the standing orders</AlertTitle>
        <AlertDescription>
          A writ may not be signed by fewer than four, one of them a warden.
        </AlertDescription>
      </Alert>
    </div>
  );
}
