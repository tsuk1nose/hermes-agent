// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolStepCard } from "./ToolStepCard";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  document.body.replaceChildren();
});

it.each([
  {
    name: "thinking",
    render: (active: boolean) => <ThinkingBlock content="Detailed reasoning" isThinking={active} />,
    toggle: "button",
    details: "Detailed reasoning",
  },
  {
    name: "tool execution",
    render: (active: boolean) => <ToolStepCard execution={{
      id: "tool-call", name: "terminal", status: active ? "running" : "complete",
      params: { command: "pwd" }, output: "Detailed tool output",
    }} />,
    toggle: '[role="button"]',
    details: "Detailed tool output",
  },
])("$name stays collapsed until opened and respects the user's choice across status updates", async ({ render, toggle, details }) => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  try {
    await act(async () => root.render(render(true)));
    expect(container.textContent).not.toContain(details);

    await act(async () => root.render(render(false)));
    expect(container.textContent).not.toContain(details);

    await act(async () => container.querySelector<HTMLElement>(toggle)!.click());
    expect(container.textContent).toContain(details);

    await act(async () => root.render(render(true)));
    expect(container.textContent).toContain(details);
    await act(async () => root.render(render(false)));
    expect(container.textContent).toContain(details);

    await act(async () => container.querySelector<HTMLElement>(toggle)!.click());
    expect(container.textContent).not.toContain(details);
  } finally {
    await act(async () => root.unmount());
  }
});
