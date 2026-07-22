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
        <AlertTitle>Default</AlertTitle>
        <AlertDescription>Neutral. Use it when nothing is wrong.</AlertDescription>
      </Alert>

      <Alert variant="info">
        <InfoIcon />
        <AlertTitle>Info</AlertTitle>
        <AlertDescription>Context the user did not ask for but benefits from.</AlertDescription>
      </Alert>

      <Alert variant="success">
        <CircleCheckIcon />
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Something finished. Nothing to do.</AlertDescription>
      </Alert>

      <Alert variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Proceeding is allowed, but has a consequence.</AlertDescription>
      </Alert>

      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Destructive</AlertTitle>
        <AlertDescription>Something failed, or is about to be lost.</AlertDescription>
      </Alert>
    </div>
  );
}
