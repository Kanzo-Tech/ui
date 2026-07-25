import { Avatar, AvatarBadge, AvatarFallback } from "@kanzo-tech/ui";

const presence = [
  { initials: "ÁI", label: "Online", variant: "success" },
  { initials: "MR", label: "Away", variant: "warning" },
  { initials: "JD", label: "Busy", variant: "destructive" },
  { initials: "LP", label: "Offline", variant: "default" },
] as const;

export default function Example() {
  return (
    <div className="flex items-start gap-6">
      {presence.map(({ initials, label, variant }) => (
        <div className="flex flex-col items-center gap-2" key={label}>
          <Avatar size="lg">
            <AvatarFallback>{initials}</AvatarFallback>
            <AvatarBadge variant={variant} />
          </Avatar>
          <span className="text-muted-foreground text-xs">{label}</span>
        </div>
      ))}
    </div>
  );
}
