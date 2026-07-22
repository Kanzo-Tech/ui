import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "@kanzo-tech/ui";

const SIZES = ["sm", "md", "lg", "xl", "2xl"] as const;

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {SIZES.map((size) => (
        <Dialog key={size}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              {size}
            </Button>
          </DialogTrigger>

          <DialogContent size={size}>
            <DialogHeader title={`size="${size}"`} />
            <DialogBody>Only the max-width changes — the dialog still shrinks to fit narrow viewports.</DialogBody>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
