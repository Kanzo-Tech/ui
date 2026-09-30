"use client";

import { useBlocker } from "@kanzo-tech/navigation";
import { Link, useRouter } from "@kanzo-tech/navigation/next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  Button,
  Input,
} from "@kanzo-tech/ui";
import { useState } from "react";

const ELSEWHERE = "/fixtures/navigation-guard/elsewhere";

export function GuardedForm() {
  const [dirty, setDirty] = useState(false);
  const router = useRouter();
  const blocker = useBlocker({ shouldBlockFn: () => true, disabled: !dirty, withResolver: true });

  return (
    <div className="flex max-w-md flex-col gap-4 p-8">
      <h1>The form</h1>
      <Input aria-label="Name" onChange={() => setDirty(true)} />
      <output data-testid="dirty">{String(dirty)}</output>
      <output data-testid="action">{blocker.action ?? "none"}</output>
      <output data-testid="next">{blocker.next?.pathname ?? "none"}</output>

      <Link href={ELSEWHERE}>Link</Link>
      <Button onClick={() => router.push(ELSEWHERE)}>router.push</Button>
      <Button onClick={() => router.back()}>router.back</Button>
      <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${ELSEWHERE}`}>plain anchor</a>
      <a href="https://example.com/">external anchor</a>

      <AlertDialog
        open={blocker.status === "blocked"}
        onOpenChange={(details) => {
          if (!details.open) blocker.reset?.();
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader title="Unsaved changes" description="Leave, and what you typed is lost." />
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={blocker.proceed}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
