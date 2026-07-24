import { render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  AiAssist,
  type AiFieldContext,
  FieldSuggest,
  useAiField,
  useAiFieldOptional,
} from "./ai-assist.js";
import type { Suggestion } from "./use-ai.js";

const noStream = async function* (): AsyncIterable<never> {};

describe("AiAssist provider", () => {
  it("useAiFieldOptional is null outside a provider", () => {
    const { result } = renderHook(() => useAiFieldOptional());
    expect(result.current).toBeNull();
  });

  it("completion and suggestions are null when their source prop is absent", () => {
    const { result } = renderHook(() => useAiField(), {
      wrapper: ({ children }: { children: ReactNode }) => <AiAssist>{children}</AiAssist>,
    });
    expect(result.current.completion).toBeNull();
    expect(result.current.suggestions).toBeNull();
  });

  it("exposes the engines when sources are present and routes pick to onPick", () => {
    const onPick = vi.fn();
    const { result } = renderHook(() => useAiField(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <AiAssist complete={noStream} onPick={onPick} suggest={noStream}>
          {children}
        </AiAssist>
      ),
    });
    expect(result.current.completion).not.toBeNull();
    expect(result.current.suggestions).not.toBeNull();
    result.current.pick("hello");
    expect(onPick).toHaveBeenCalledWith("hello");
  });

  it("keeps a stable hook count when `complete` toggles (both engines mount unconditionally)", () => {
    let captured: AiFieldContext | null = null;
    function Capture() {
      captured = useAiField();
      return null;
    }
    function Harness({ complete }: { complete?: typeof noStream }) {
      return (
        <AiAssist complete={complete}>
          <Capture />
        </AiAssist>
      );
    }
    const { rerender } = render(<Harness />);
    expect(captured!.completion).toBeNull();
    // A re-render that flips the source must not throw "rendered more/fewer hooks".
    rerender(<Harness complete={noStream} />);
    expect(captured!.completion).not.toBeNull();
  });
});

describe("FieldSuggest", () => {
  const suggest = async function* (): AsyncIterable<Suggestion> {
    yield { value: "alpha" };
    yield { value: "beta" };
  };

  it("opening starts the stream and lists candidates; picking routes and closes", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(
      <AiAssist onPick={onPick} suggest={suggest}>
        <FieldSuggest label="Suggest" />
      </AiAssist>,
    );

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    const alpha = await screen.findByText("alpha");
    await user.click(alpha);

    expect(onPick).toHaveBeenCalledWith("alpha");
    await waitFor(() => expect(screen.queryByText("beta")).toBeNull());
  });

  it("dismissing a candidate removes it from the list", async () => {
    const user = userEvent.setup();
    render(
      <AiAssist onPick={vi.fn()} suggest={suggest}>
        <FieldSuggest label="Suggest" />
      </AiAssist>,
    );

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    await screen.findByText("alpha");
    const dismiss = screen.getAllByRole("button", { name: "Dismiss suggestion" })[0]!;
    await user.click(dismiss);

    await waitFor(() => expect(screen.queryByText("alpha")).toBeNull());
  });

  it("closing mid-load cancels the in-flight stream", async () => {
    const user = userEvent.setup();
    let aborted = false;
    const slow = async function* (signal?: AbortSignal): AsyncIterable<Suggestion> {
      signal?.addEventListener("abort", () => {
        aborted = true;
      });
      yield { value: "one" };
      await new Promise((r) => setTimeout(r, 2000)); // keep the window loading
    };
    render(
      <AiAssist onPick={vi.fn()} suggest={slow}>
        <FieldSuggest label="Suggest" />
      </AiAssist>,
    );

    await user.click(screen.getByRole("button", { name: "Suggest" }));
    await screen.findByText("one");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(aborted).toBe(true));
  });
});
