import { CopyIcon, RefreshCcwIcon, ScrollTextIcon } from "lucide-react";
import { Alert, AlertDescription, Button, ButtonGroup } from "@kanzo-tech/ui";
import {
  Message,
  MessageActions,
  MessageAvatar,
  MessageContent,
  MessageList,
} from "@kanzo-tech/ai";
import { FEATURED, partyOf } from "@/example/quests";
import { VIEWER } from "@/example/people";
import { hall, role } from "@/example/world";

const writ = FEATURED.writ;
const crew = partyOf(writ);

export default function Example() {
  return (
    <MessageList className="max-w-xl">
      {/* A system note is not a speaker, so it takes neither surface. `Alert` is the aside the
          library already ships — a wash, a border, `role="status"`, and it wraps. */}
      <Message role="system">
        <Alert>
          <ScrollTextIcon />
          <AlertDescription>
            Standing orders loaded. Answers are drawn from the board and the roster, and nothing
            else.
          </AlertDescription>
        </Alert>
      </Message>

      <Message role="user">
        <MessageAvatar name={VIEWER.name} />
        <MessageContent>{writ.title} — is it properly crewed?</MessageContent>
      </Message>

      <Message>
        <MessageAvatar name={hall(writ.hall).short} />
        <MessageContent>
          Yes. {crew.length} signatures on a grade {writ.grade}, and one of them is a{" "}
          {role(crew[0].role).label.toLowerCase()}:{" "}
          {crew.map((member) => `${member.name} (${hall(member.hall).short})`).join(", ")}. Four
          charters between them, which is why the party column crosses halls.
        </MessageContent>
        <MessageActions>
          <ButtonGroup aria-label="About this answer">
            <Button aria-label="Copy" size="icon-sm" variant="ghost">
              <CopyIcon />
            </Button>
            <Button aria-label="Ask again" size="icon-sm" variant="ghost">
              <RefreshCcwIcon />
            </Button>
            <Button size="sm" variant="ghost">
              <ScrollTextIcon />
              {writ.id}
            </Button>
          </ButtonGroup>
        </MessageActions>
      </Message>
    </MessageList>
  );
}
