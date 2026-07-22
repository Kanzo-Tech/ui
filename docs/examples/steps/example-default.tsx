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

const steps = [
  { title: "Connect", body: "Point at a source and give it credentials." },
  { title: "Map", body: "Match incoming fields onto the target shape." },
  { title: "Review", body: "Check the diff before anything is written." },
];

export default function Example() {
  return (
    <Steps className="w-full max-w-lg" count={steps.length} defaultStep={1}>
      <StepsList>
        {steps.map((step, index) => (
          <StepsItem index={index} key={step.title}>
            <StepsTrigger>
              <StepsIndicator>{index + 1}</StepsIndicator>
              <StepsTitle>{step.title}</StepsTitle>
            </StepsTrigger>
            <StepsSeparator />
          </StepsItem>
        ))}
      </StepsList>

      {steps.map((step, index) => (
        <StepsContent
          className="text-muted-foreground text-sm"
          index={index}
          key={step.title}
        >
          {step.body}
        </StepsContent>
      ))}
      <StepsCompletedContent className="text-muted-foreground text-sm">
        All steps complete.
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
