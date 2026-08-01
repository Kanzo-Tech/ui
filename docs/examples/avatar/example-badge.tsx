import { Avatar, AvatarBadge, AvatarFallback } from "@kanzo-tech/ui";
import { initialsOf } from "@/example/people";
import { ROSTER } from "@/example/roster";
import { AVAILABILITY } from "@/example/world";

// One member per state the board can put someone in — the dot repeats what the caption says.
const shown = AVAILABILITY.flatMap((state) => {
  const entry = ROSTER.find((candidate) => candidate.availability === state.id);
  return entry ? [{ ...state, name: entry.name }] : [];
});

export default function Example() {
  return (
    <div className="flex items-start gap-6">
      {shown.map(({ id, label, name, tone }) => (
        <div className="flex flex-col items-center gap-2" key={id}>
          <Avatar size="lg">
            <AvatarFallback>{initialsOf(name)}</AvatarFallback>
            <AvatarBadge variant={tone} />
          </Avatar>
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}
