import {
  Button,
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit dataset</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader
          description="Update the display name. Changes apply immediately."
          title="Edit dataset"
        />

        <DialogBody>The name becomes the graph id, so it must stay unique.</DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Save</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
