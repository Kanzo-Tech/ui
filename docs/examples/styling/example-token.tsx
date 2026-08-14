import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@kanzo-tech/ui";
import { HALLS } from "@/example/world";

const hall = HALLS[0];

/**
 * The first escape hatch: move a token, and everything under it re-skins.
 *
 * `--radius` is set on the wrapper, so it inherits down to the card, the button and the badge at
 * once — none of which is told anything. This is a custom property cascading normally, not a theme:
 * the five user axes are attributes on `<html>` because Ark's overlays portal to `document.body`
 * and would escape a wrapper. A token that only styles what is inside it has no such problem.
 */
export default function Example() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row">
      <Card className="flex-1">
        <CardHeader>
          <CardTitle>{hall.short}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <Badge>{hall.standing}</Badge>
          <Button size="sm">Open</Button>
        </CardContent>
      </Card>

      <div className="flex-1" style={{ "--radius": "0px" } as React.CSSProperties}>
        <Card>
          <CardHeader>
            <CardTitle>{hall.short}</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Badge>{hall.standing}</Badge>
            <Button size="sm">Open</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
