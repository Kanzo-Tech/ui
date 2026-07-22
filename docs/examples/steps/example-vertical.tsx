import {
  Steps,
  StepsCompletedContent,
  StepsContent,
  StepsDescription,
  StepsIndicator,
  StepsItem,
  StepsList,
  StepsSeparator,
  StepsTitle,
  StepsTrigger,
} from "@kanzo-tech/ui";

const steps = [
  { title: "Connect", description: "Source + credentials", body: "Point at a source." },
  { title: "Map", description: "Field matching", body: "Match incoming fields." },
  { title: "Review", description: "Final diff", body: "Check before writing." },
];

export default function Example() {
  return (
    <Steps
      className="w-full max-w-lg"
      count={steps.length}
      defaultStep={1}
      orientation="vertical"
    >
      <StepsList>
        {steps.map((step, index) => (
          <StepsItem index={index} key={step.title}>
            <StepsTrigger>
              <StepsIndicator>{index + 1}</StepsIndicator>
              <span className="flex flex-col items-start gap-1">
                <StepsTitle>{step.title}</StepsTitle>
                <StepsDescription>{step.description}</StepsDescription>
              </span>
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
    </Steps>
  );
}
