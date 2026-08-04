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
        <Button variant="outline">Claim contract</Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader
          description="Q-1041 · Thornmarch · Grade 2, Nuisance"
          title="Something is eating the bell-ropes"
        />

        <DialogBody>
          Signing commits the party until the contract settles. Nobody can be sent on two
          contracts at once.
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Not yet</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button>Sign for it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
