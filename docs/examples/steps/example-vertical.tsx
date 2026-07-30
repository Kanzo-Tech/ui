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
  {
    title: "Read the terms",
    description: "Grade and due date",
    body: "A writ needs a hall's seal and a written heir.",
  },
  {
    title: "Name a party",
    description: "Who is going",
    body: "Only members the board has not already sent out.",
  },
  {
    title: "Sign",
    description: "Warden and archivist",
    body: "The archivist reads it; the warden signs for the party.",
  },
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
        The contract is claimed.
      </StepsCompletedContent>
    </Steps>
  );
}
