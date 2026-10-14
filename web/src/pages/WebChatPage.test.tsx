// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProfileContext } from "@/contexts/profile-context";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  getModelInfo: vi.fn(),
  getSessions: vi.fn(),
  getSessionMessages: vi.fn(),
  getModelOptions: vi.fn(),
  getConfig: vi.fn(),
  saveConfig: vi.fn(),
  setTitle: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ api: mocks }));
vi.mock("@/contexts/usePageHeader", () => ({ usePageHeader: () => ({ setTitle: mocks.setTitle }) }));
vi.mock("@/lib/gatewayClient", () => ({
  GatewayClient: class {
    stateListener?: (state: string) => void;
    request = mocks.request;
    on() { return () => {}; }
    onState(listener: (state: string) => void) { this.stateListener = listener; return () => {}; }
    async connect() { this.stateListener?.("open"); }
    close() {}
  },
}));

import { WebChatPage } from "./WebChatPage";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  // jsdom has dialog elements but does not implement the browser's modal API.
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } },
    close: { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } },
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  mocks.getModelInfo.mockResolvedValue({ model: "test/chat-model" });
  mocks.getSessions.mockResolvedValue({ sessions: [{ id: "stored-chat", title: "Existing chat" }] });
  mocks.getSessionMessages.mockResolvedValue({ messages: [] });
  mocks.getModelOptions.mockResolvedValue({ model: "chat-model", provider: "test", providers: [] });
  mocks.request.mockImplementation(async (method: string) => {
    if (method === "session.resume") return { session_id: "runtime-chat" };
    if (method === "config.get") return { value: "medium" };
    if (method === "config.set") return { key: "reasoning", value: "high" };
    throw new Error(`Unexpected method: ${method}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function renderPage(path = "/web-chat") {
  await act(async () => root.render(
    <ProfileContext.Provider value={{ profile: "research", currentProfile: "default", profiles: ["research"], setProfile: vi.fn() }}>
      <MemoryRouter initialEntries={[path]}><WebChatPage /></MemoryRouter>
    </ProfileContext.Provider>,
  ));
}

it("keeps the mobile session list off the conversation until opened and closes it on selection", async () => {
  await renderPage();
  expect(document.querySelector("dialog")).toBeNull();
  expect(container.textContent).not.toContain("Existing chat");
  expect(container.querySelector("h1")?.parentElement?.querySelector("button")).toBeNull();

  const toggle = container.querySelector<HTMLButtonElement>('[aria-label="会话列表"]')!;
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  await act(async () => toggle.click());
  const drawer = document.querySelector<HTMLDialogElement>('dialog[aria-label="会话列表"]')!;
  expect(drawer.open).toBe(true);
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  expect(document.body.style.overflow).toBe("hidden");
  const session = Array.from(drawer.querySelectorAll<HTMLElement>('[role="button"]')).find((row) => row.textContent?.includes("Existing chat"))!;
  await act(async () => session.click());
  expect(document.querySelector("dialog")).toBeNull();
  expect(document.body.style.overflow).not.toBe("hidden");
  expect(mocks.request).toHaveBeenCalledWith("session.resume", { session_id: "stored-chat", profile: "research" });
});

it.each([
  { path: "/web-chat?session=stored-chat", sessionId: "runtime-chat" },
  { path: "/web-chat", sessionId: undefined },
])("applies reasoning effort to the correct session or profile default ($path)", async ({ path, sessionId }) => {
  await renderPage(path);
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="模型与思考强度"]')!.click());
  expect(mocks.request).toHaveBeenCalledWith("config.get", {
    key: "reasoning", profile: "research", session_id: sessionId,
  });
  const picker = document.querySelector('[role="group"][aria-label="思考强度"]')!;
  const select = picker.querySelector<HTMLButtonElement>('[role="combobox"]')!;
  expect(select.disabled).toBe(false);
  await act(async () => select.click());
  const high = Array.from(picker.querySelectorAll<HTMLElement>('[role="option"]')).find((option) => option.textContent === "High")!;
  await act(async () => high.click());
  expect(mocks.request).toHaveBeenCalledWith("config.set", {
    key: "reasoning", value: "high", profile: "research", session_id: sessionId,
  });
  expect(select.textContent).toContain("High");
  expect(mocks.saveConfig).not.toHaveBeenCalled();
});
