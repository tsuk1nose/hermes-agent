import { expect, it, vi } from "vitest";
import { executeWebChatSlash } from "./web-chat-slash";

it("keeps multiline alias arguments and sends skill content with its display label", async () => {
  const arg = "fix this:\n  keep indentation\n\n  and blank lines";
  const body = "Skill instructions\nApply the requested fix.";
  const request = vi.fn()
    .mockRejectedValueOnce(new Error("dispatch required"))
    .mockResolvedValueOnce({ type: "alias", target: "work" })
    .mockRejectedValueOnce(new Error("dispatch required"))
    .mockResolvedValueOnce({ type: "skill", name: "work", message: body, display: `/work ${arg}` });
  const callbacks = { sys: vi.fn(), send: vi.fn(), prefill: vi.fn() };

  await executeWebChatSlash({ command: `/Build ${arg}`, sessionId: "chat-session", gw: { request }, callbacks });

  expect(request).toHaveBeenNthCalledWith(2, "command.dispatch", {
    name: "build", arg, session_id: "chat-session",
  });
  expect(request).toHaveBeenNthCalledWith(4, "command.dispatch", {
    name: "work", arg, session_id: "chat-session",
  });
  expect(callbacks.send).toHaveBeenCalledWith(body, `/work ${arg}`);
  expect(callbacks.sys).not.toHaveBeenCalled();
  expect(callbacks.prefill).not.toHaveBeenCalled();
});

it("puts backend prefill directives in the composer without submitting a prompt", async () => {
  const draft = "Review the plan before sending.";
  const request = vi.fn()
    .mockRejectedValueOnce(new Error("dispatch required"))
    .mockResolvedValueOnce({ type: "prefill", message: draft, notice: "Draft ready" });
  const callbacks = { sys: vi.fn(), send: vi.fn(), prefill: vi.fn() };

  await executeWebChatSlash({ command: "/plan", sessionId: "chat-session", gw: { request }, callbacks });

  expect(callbacks.prefill).toHaveBeenCalledWith(draft);
  expect(callbacks.sys).toHaveBeenCalledWith("Draft ready");
  expect(callbacks.send).not.toHaveBeenCalled();
});
