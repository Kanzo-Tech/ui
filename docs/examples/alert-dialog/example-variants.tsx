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
            description="The graph is re-materialised from source."
            title="Re-run the mapping?"
          />

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogClose asChild>
              <AlertDialogAction>Re-run</AlertDialogAction>
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
            description="Revoking the key breaks every client using it."
            title="Revoke API key?"
          />

          <AlertDialogBody>There is no way to restore the same key afterwards.</AlertDialogBody>

          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogClose asChild>
              <AlertDialogAction variant="destructive">Revoke</AlertDialogAction>
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
