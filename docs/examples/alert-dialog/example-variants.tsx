import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogBody,
  AlertDialogCancel,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger,
  Button,
} from "@kanzo-tech/ui";

export default function Example() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Confirm</Button>
        </AlertDialogTrigger>

        <AlertDialogContent size="sm">
          <AlertDialogHeader
            description="It goes back on the board as a second attempt, open to any chartered hall."
            title="Re-post “Map the drowned lane”?"
          />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogClose asChild>
              <AlertDialogAction>Re-post</AlertDialogAction>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">Destructive</Button>
        </AlertDialogTrigger>

        <AlertDialogContent size="sm">
          <AlertDialogHeader
            description="Fenn Aldabra, Ansel Thibault and Beatrix Odemba are recalled."
            title="Abandon Q-1078?"
          />

          <AlertDialogBody>
            A settled or failed contract is already closed; only an open, claimed or afield one
            can be abandoned, and abandoning it is what fails it.
          </AlertDialogBody>

          <AlertDialogFooter>
            <AlertDialogCancel>Leave it afield</AlertDialogCancel>
            <AlertDialogClose asChild>
              <AlertDialogAction variant="destructive">Abandon</AlertDialogAction>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
