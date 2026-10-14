---
"@kanzo-tech/ui": minor
---

`Questionnaire` and `Question` take their words through `translations`, as every other component does. `Questionnaire`'s are `progress(position, count)`, `navigation` (the actions row's accessible name), `previous`, `skip`, `next`, `submit`, and its questions' `unanswered`, which reach every question inside it; a `Question`'s own `translations` win for that question. An action given children still says those. **Breaking:** `QuestionnaireProgress` takes no children — translate it with `` <Questionnaire translations={{ progress: (position, count) => `Pregunta ${position} de ${count}` }}> ``, which `aria-valuetext` reads too.
