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
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline">Abandon contract</Button>
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader
          description="Q-1058 is afield with Dagfinn Roe and Solveig Marsh, and six days overdue."
          title="Abandon “A basilisk, and it knows the route”?"
        />

        <AlertDialogBody>
          The contract is marked Failed, the party is recalled, and Ash &amp; Co. forfeits the
          190 gold.
        </AlertDialogBody>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogClose asChild>
            <AlertDialogAction variant="destructive">Abandon</AlertDialogAction>
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
