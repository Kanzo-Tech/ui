import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardMedia,
  CardTitle,
} from "@kanzo-tech/ui";
import { DatabaseIcon } from "lucide-react";

/**
 * The variants live on `CardMedia`, not on `Card` — which is why they were hard to find. The
 * card itself is a surface; what changes is how the media slot at its top behaves.
 */
export default function Example() {
  return (
    <div className="grid w-full gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Plain</CardTitle>
          <CardDescription>No media. A surface with content on it.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          1,204 triples · updated today
        </CardContent>
      </Card>

      <Card>
        <CardMedia variant="icon">
          <DatabaseIcon />
        </CardMedia>
        <CardHeader>
          <CardTitle>Icon</CardTitle>
          <CardDescription>Sizes the glyph and keeps the card's padding.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          For a card that is about a thing with a type.
        </CardContent>
      </Card>

      <Card>
        <CardMedia variant="image">
          <img
            alt=""
            src="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='160'%3E%3Crect width='400' height='160' fill='%23cbd5e1'/%3E%3C/svg%3E"
          />
        </CardMedia>
        <CardHeader>
          <CardTitle>Image</CardTitle>
          <CardDescription>Bleeds to the edges and clips to the radius.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
