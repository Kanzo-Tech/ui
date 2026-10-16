# @kanzo-tech/testing

Component harnesses for a page built with Kanzo UI: a class per component that finds it by its ARIA
and drives it, in Angular CDK's shape, run by Playwright in a host's end-to-end suite or by Testing
Library in a unit test.

```sh
pnpm add -D @kanzo-tech/testing
```

```ts
import { ChartHarness, FilterBarHarness, playwright } from "@kanzo-tech/testing";

const env = await playwright(page);
await page.goto("/archive");
await (await env.getHarness(ChartHarness.with({ title: "Count by Airport.lon" }))).brush({ x: [-125, -100] });
await expect.poll(async () => (await env.getHarness(FilterBarHarness)).readout()).toBe("611 of 3,218 airports");
```

`dom(container)` from `@kanzo-tech/testing/dom` is the same environment over Testing Library, for
jsdom. It imports none of the components: where a graph canvas draws, its element says, as
Observable Plot's output says what its scales are. `playwright(page, { models })` registers a scripted
provider per model id in `@kanzo-tech/llm/local`'s provider registry before the page loads, so
`localModel(id)` resolves the script in place of the model as it resolves any provider, and
`env.prompts(id)` reads what it was asked.

The reference is <https://kanzo-tech.github.io/ui/docs/testing>, and why it is shaped this way is
<https://kanzo-tech.github.io/ui/docs/design/testing>.
