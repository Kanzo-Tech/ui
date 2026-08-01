import {
  Button,
  Steps,
  StepsCompletedContent,
  StepsContent,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsNext,
  StepsPrevious,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
} from "@kanzo-tech/ui";
import { QUEST_STATUSES } from "@/example/world";

export default function Example() {
  return (
    <Steps className="w-full max-w-2xl" count={QUEST_STATUSES.length} defaultStep={1}>
      <StepsList>
        {QUEST_STATUSES.map((state, index) => (
          <StepsItem index={index} key={state.id}>
            <StepsTrigger>
              <StepsIndicator>{index + 1}</StepsIndicator>
              <StepsTitle>{state.label}</StepsTitle>
            </StepsTrigger>
            <StepsSeparator />
          </StepsItem>
        ))}
      </StepsList>

      {QUEST_STATUSES.map((state, index) => (
        <StepsContent
          className="text-muted-foreground text-sm"
          index={index}
          key={state.id}
        >
          {state.description}
        </StepsContent>
      ))}
      <StepsCompletedContent className="text-muted-foreground text-sm">
        Off the board.
      </StepsCompletedContent>

      <div className="flex gap-2">
        <StepsPrevious asChild>
          <Button size="sm" variant="outline">
            Back
          </Button>
        </StepsPrevious>
        <StepsNext asChild>
          <Button size="sm">Next</Button>
        </StepsNext>
      </div>
    </Steps>
  );
}
