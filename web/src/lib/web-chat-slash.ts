import { parseCommandDispatch, parseSlashCommand } from "@hermes/shared";
import type { GatewayClient } from "./gatewayClient";

interface SlashExecResponse {
  output?: string;
  warning?: string;
}

interface WebChatSlashOptions {
  command: string;
  sessionId: string;
  gw: Pick<GatewayClient, "request">;
  callbacks: {
    sys(text: string): void;
    send(message: string, display?: string): Promise<void> | void;
    prefill(message: string): void;
  };
}

/** Render backend command directives using the shared slash wire contract. */
export async function executeWebChatSlash(options: WebChatSlashOptions): Promise<void> {
  const { command, sessionId, gw, callbacks } = options;
  const { name, arg } = parseSlashCommand(command);
  if (!name) {
    callbacks.sys("empty slash command");
    return;
  }

  try {
    const result = await gw.request<SlashExecResponse>("slash.exec", {
      command: command.replace(/^\/+/, ""),
      session_id: sessionId,
    });
    const body = result.output || `/${name}: no output`;
    callbacks.sys(result.warning ? `warning: ${result.warning}\n${body}` : body);
    return;
  } catch {
    // Skills and client directives are resolved by command.dispatch.
  }

  try {
    const directive = parseCommandDispatch(await gw.request("command.dispatch", {
      name,
      arg,
      session_id: sessionId,
    }));
    if (!directive) {
      callbacks.sys("error: invalid response: command.dispatch");
      return;
    }

    switch (directive.type) {
      case "exec":
      case "plugin":
        callbacks.sys(directive.output ?? "(no output)");
        return;
      case "alias":
        await executeWebChatSlash({
          ...options,
          command: `/${directive.target}${arg ? ` ${arg}` : ""}`,
        });
        return;
      case "prefill":
        if (directive.notice) callbacks.sys(directive.notice);
        callbacks.prefill(directive.message);
        return;
      case "skill":
      case "send":
        if (!directive.message?.trim()) {
          callbacks.sys(`/${name}: missing message`);
          return;
        }
        if (directive.type === "send" && directive.notice) callbacks.sys(directive.notice);
        await callbacks.send(directive.message, directive.display || command);
        return;
    }
  } catch (error) {
    callbacks.sys(`error: ${error instanceof Error ? error.message : String(error)}`);
  }
}
