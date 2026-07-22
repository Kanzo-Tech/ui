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
        <Button variant="outline">Delete dataset</Button>
      </AlertDialogTrigger>

      <AlertDialogContent size="sm">
        <AlertDialogHeader
          description="This removes customers.ttl and its 1,204 triples."
          title="Delete customers.ttl?"
        />

        <AlertDialogBody>Mappings that reference the graph will start failing.</AlertDialogBody>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogClose asChild>
            <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
          </AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
