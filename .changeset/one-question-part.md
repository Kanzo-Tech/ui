---
"@kanzo-tech/ui": minor
"@kanzo-tech/ai": minor
---

A question put to the person is one part, `@kanzo-tech/ui`'s `Question` — `QuestionPrompt`, `QuestionDescription`, `QuestionChoices`, `QuestionChoice`, `QuestionInput`, `QuestionTextarea` and `QuestionError` — usable on its own, as a guided chat draws a decision in a turn, and inside a `Questionnaire`, which is now only the sequence around its questions: the root, `QuestionnaireProgress` and the actions. On its own a question holds its answer as `value`, `defaultValue` and `onValueChange({ value })`, and a pick answers it in one press; inside a `Questionnaire` the answer is the questionnaire's, under the question's `name`. `name` is also the form field's name, so a question in a plain `<form>` submits its answer.

**Breaking** in `@kanzo-tech/ai`: `Question`, `QuestionPrompt`, `QuestionDescription`, `QuestionOptions` and `QuestionOption` are gone. Import the question part from `@kanzo-tech/ui`, give `Question` a `name`, and write `QuestionChoices` for `QuestionOptions` and `QuestionChoice` for `QuestionOption`:

```tsx
import { Question, QuestionChoice, QuestionChoices, QuestionPrompt } from "@kanzo-tech/ui";

<Question name={decision.id} value={chosen ?? null} onValueChange={(d) => choose(d.value)}>
  <QuestionPrompt>{decision.question}</QuestionPrompt>
  <QuestionChoices>
    {decision.options.map((o) => <QuestionChoice key={o.id} value={o.id}>{o.label}</QuestionChoice>)}
  </QuestionChoices>
</Question>
```

`d.value` is a `QuestionAnswer` — a `string` here, a `string[]` for a `multiple` question. A choice is drawn as `Questionnaire`'s card, not as an outline button.

**Breaking** in `@kanzo-tech/ui`: inside a `Questionnaire`, `QuestionnaireItem` is `Question`, `QuestionnaireTitle` is `QuestionPrompt`, `QuestionnaireDescription` is `QuestionDescription`, `QuestionnaireChoices` is `QuestionChoices`, `QuestionnaireChoice` is `QuestionChoice`, `QuestionnaireInput` is `QuestionInput`, `QuestionnaireTextarea` is `QuestionTextarea` and `QuestionnaireError` is `QuestionError`, with the same props; `useQuestionnaireItem` is `useQuestion`, which also carries the `answer` and `setAnswer`. The types follow: `QuestionnaireItemProps`, `QuestionnaireChoicesProps` and `QuestionnaireChoiceProps` are `QuestionProps`, `QuestionChoicesProps` and `QuestionChoiceProps`, and `QuestionnaireAnswer` is `QuestionAnswer`. `useQuestionnaire()` carries `answers`, `questions`, `steps` and `translations`; its `blocked`, `indexOf`, `setAnswer` and `shortcuts` are gone — answer from inside a question with `useQuestion().setAnswer`. The parts' `data-slot`s follow their names: `questionnaire-item` is `question`, `questionnaire-title` is `question-prompt`, and every other `questionnaire-…` slot of a question's part is `question-…`.
