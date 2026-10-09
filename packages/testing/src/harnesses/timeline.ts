import { ComponentHarness, type By, type HarnessEnvironment, type Handle, type HarnessQuery } from "../environment";
import { ChartHarness } from "./chart";

/**
 * **A `ChartTimeline`**: a chart, found by its title and brushed in data as `ChartHarness` brushes
 * one, plus what `/docs/design/timeline` names for a test to read — play and pause are one button,
 * `aria-pressed` while it plays, and the brushed range is a group whose `aria-valuetext` reads
 * *1950 – 1960*.
 */
export class TimelineHarness extends ComponentHarness {
  static readonly by: By = { role: "figure" };

  static with(options: { title: string | RegExp }): HarnessQuery<TimelineHarness> {
    return { type: TimelineHarness, by: { role: "figure", name: options.title } };
  }

  private readonly chart: ChartHarness;

  constructor(env: HarnessEnvironment, host: Handle) {
    super(env, host);
    this.chart = new ChartHarness(env, host);
  }

  /** Brushes `[from, to]` on the time axis and waits for the range to read something else. */
  async brush([from, to]: readonly [unknown, unknown]): Promise<void> {
    const before = await this.range();
    await this.chart.brush({ x: [from, to] });
    await this.env.until(async () => (await this.range()) !== before, "the timeline's range did not move");
  }

  /** The brushed range as the group reads it — *1950 – 1960* — or `null` with no window. */
  async range(): Promise<string | null> {
    const [group] = await this.host.find({ role: "group" });
    return group ? group.attribute("aria-valuetext") : null;
  }

  /** Starts playback and waits for the button to say so. */
  play(): Promise<void> {
    return this.transport(true);
  }

  pause(): Promise<void> {
    return this.transport(false);
  }

  private async transport(playing: boolean): Promise<void> {
    const button = await this.one({ role: "button", name: /^(play|pause)/i }, "the timeline has no play button");
    const pressed = async () => (await button.attribute("aria-pressed")) === "true";
    if ((await pressed()) === playing) return;
    await button.click();
    await this.env.until(async () => (await pressed()) === playing, playing ? "the timeline did not start" : "the timeline did not stop");
  }
}
