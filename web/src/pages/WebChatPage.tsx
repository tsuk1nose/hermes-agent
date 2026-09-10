import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import { WebChatSidebar } from "@/components/web-chat/WebChatSidebar";
import { MessageStream } from "@/components/web-chat/MessageStream";
import { Composer, type ComposerAttachment } from "@/components/web-chat/Composer";
import { LandingHero } from "@/components/web-chat/LandingHero";
import type { ChatMessage } from "@/components/web-chat/MessageBubble";
import type { ToolExecution } from "@/components/web-chat/ToolStepCard";
import type { ApprovalChoice, ApprovalRequest } from "@/components/web-chat/ApprovalCard";
import { ModelPickerDialog } from "@/components/ModelPickerDialog";
import { GatewayClient } from "@/lib/gatewayClient";
import { api } from "@/lib/api";
import { executeSlash } from "@/lib/slashExec";
import { useProfileScope } from "@/contexts/useProfileScope";
import { usePageHeader } from "@/contexts/usePageHeader";
import { Sparkles, WifiOff, AlertCircle } from "lucide-react";

interface RawMessage {
  id?: string;
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  text?: string;
  tool_calls?: Array<{
    id: string;
    type?: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  timestamp?: number | string;
}

interface SessionCreateResult {
  session_id: string;
  stored_session_id: string;
}

interface SessionResumeResult {
  inflight?: {
    assistant?: string;
    streaming?: boolean;
  } | null;
  session_id: string;
  running?: boolean;
}

interface AttachResult {
  ref_text?: string;
  text?: string;
}

function messageTimestamp(value: number | string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed > 1e11 ? parsed : parsed * 1000;
}

function toolOutput(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function parseStoredMessages(rawList: RawMessage[]): ChatMessage[] {
  const parsed: ChatMessage[] = [];

  for (const m of rawList) {
    const content = m.content ?? m.text ?? "";
    if (m.role === "user" || m.role === "system") {
      parsed.push({
        id: m.id || `${m.role}-${crypto.randomUUID()}`,
        role: m.role,
        content,
        timestamp: messageTimestamp(m.timestamp),
      });
    } else if (m.role === "assistant") {
      const tools: ToolExecution[] = (m.tool_calls || []).map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        params: tc.function.arguments,
        status: "complete",
      }));
      parsed.push({
        id: m.id || `assistant-${crypto.randomUUID()}`,
        role: "assistant",
        content,
        tools: tools.length > 0 ? tools : undefined,
        timestamp: messageTimestamp(m.timestamp),
      });
    } else if (m.tool_call_id) {
      for (let i = parsed.length - 1; i >= 0; i--) {
        const targetTool = parsed[i].tools?.find((tool) => tool.id === m.tool_call_id);
        if (targetTool) {
          targetTool.output = content;
          break;
        }
      }
    }
  }

  return parsed;
}

export function WebChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSessionId = searchParams.get("session");
  const { profile } = useProfileScope();
  const { setTitle } = usePageHeader();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [connected, setConnected] = useState(false);
  const [modelName, setModelName] = useState<string>("");
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runtimeSessionId, setRuntimeSessionId] = useState<string | null>(null);

  const gwRef = useRef<GatewayClient | null>(null);
  const runtimeSessionIdRef = useRef<string | null>(runtimeSessionId);
  runtimeSessionIdRef.current = runtimeSessionId;
  const runtimeStoredIdRef = useRef<string | null>(null);
  const skipNextResumeRef = useRef<string | null>(null);

  // Set page header title
  useEffect(() => {
    setTitle("Web Chat");
  }, [setTitle]);

  // Load Model Info
  useEffect(() => {
    api.getModelInfo(profile)
      .then((info) => {
        const name = (info as any)?.model || (info as any)?.default_model || "";
        if (name) {
          setModelName(name.split("/").pop() || name);
        }
      })
      .catch(() => {});
  }, [profile]);

  // Initialize and connect GatewayClient
  useEffect(() => {
    const gw = new GatewayClient();
    gwRef.current = gw;
    let disposed = false;
    let reconnectTimer: number | undefined;
    let reconnectDelay = 1_000;
    const isCurrentEvent = (ev: { session_id?: string }) =>
      Boolean(runtimeSessionIdRef.current && ev.session_id === runtimeSessionIdRef.current);

    gw.on("gateway.ready", () => {
      setConnected(true);
      setErrorMessage(null);
    });

    gw.on("message.start", (ev) => {
      if (!isCurrentEvent(ev)) return;
      setIsGenerating(true);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) return prev;
        return [
          ...prev,
          {
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            content: "",
            streaming: true,
            timestamp: Date.now(),
          },
        ];
      });
    });

    // Handle token deltas
    gw.on("message.delta", (ev) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const text = payload?.text || payload?.content || payload?.delta || "";
      if (!text) return;

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: last.content + text,
              isThinking: false,
              streaming: true,
            },
          ];
        }
        return prev;
      });
    });

    // Handle thinking / reasoning deltas
    const handleReasoning = (ev: any) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const delta = payload?.text || payload?.delta || payload?.content || "";
      if (!delta) return;

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              thinking: (last.thinking || "") + delta,
              isThinking: true,
            },
          ];
        }
        return prev;
      });
    };
    gw.on("thinking.delta" as any, handleReasoning);
    gw.on("reasoning.delta" as any, handleReasoning);

    // Handle Tool Start
    gw.on("tool.start" as any, (ev) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const toolId = payload?.tool_id || payload?.id || `tool-${Date.now()}`;
      const toolName = payload?.name || payload?.tool || "tool";
      const params = payload?.args || payload?.args_text || payload?.context;

      const newTool: ToolExecution = {
        id: toolId,
        name: toolName,
        params,
        status: "running",
      };

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          const existingTools = last.tools || [];
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              isThinking: false,
              tools: [...existingTools, newTool],
            },
          ];
        }
        return prev;
      });
    });

    // Handle Tool Progress
    gw.on("tool.progress" as any, (ev) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const toolId = payload?.tool_id || payload?.id;
      const output = payload?.preview || payload?.output || payload?.delta || "";
      const toolName = payload?.name;

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && last.tools) {
          const updatedTools = last.tools.map((t) =>
            t.id === toolId || (!toolId && (!toolName || t.name === toolName))
              ? { ...t, output: (t.output || "") + output }
              : t
          );
          return [...prev.slice(0, -1), { ...last, tools: updatedTools }];
        }
        return prev;
      });
    });

    // Handle Tool Complete
    gw.on("tool.complete" as any, (ev) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const toolId = payload?.tool_id || payload?.id;
      const output = payload?.result_text ?? payload?.summary ?? toolOutput(payload?.result);
      const error = payload?.error;
      const durationMs = payload?.duration_ms ??
        (typeof payload?.duration_s === "number" ? payload.duration_s * 1000 : undefined);

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && last.tools) {
          const updatedTools = last.tools.map((t) => {
            if (t.id === toolId || (!toolId && t.status === "running")) {
              return {
                ...t,
                status: error ? ("error" as const) : ("complete" as const),
                output: output !== undefined ? String(output) : t.output,
                error: error ? String(error) : undefined,
                durationMs: durationMs || t.durationMs,
              };
            }
            return t;
          });
          return [...prev.slice(0, -1), { ...last, tools: updatedTools }];
        }
        return prev;
      });
    });

    // Handle Approval Request
    gw.on("approval.request" as any, (ev) => {
      if (!isCurrentEvent(ev)) return;
      const payload = ev.payload as any;
      const requestId = payload?.request_id;
      const sessionId = ev.session_id;
      if (!requestId || !sessionId) return;

      void gw.request("approval.received", {
        request_id: requestId,
        session_id: sessionId,
      }).catch(() => {});

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              approval: {
                requestId,
                sessionId,
                choices: payload.choices,
                command: payload.command,
                description: payload.description,
                tool: payload.tool,
              },
            },
          ];
        }
        return prev;
      });
    });

    // Handle Message Complete
    gw.on("message.complete", (ev) => {
      if (!isCurrentEvent(ev)) return;
      setIsGenerating(false);
      const payload = ev.payload as any;
      const finalText = payload?.text || payload?.content;

      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: finalText || last.content,
              streaming: false,
              isThinking: false,
            },
          ];
        }
        return prev;
      });
    });

    const scheduleReconnect = () => {
      if (disposed || reconnectTimer !== undefined) return;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 15_000);
    };

    const connect = async () => {
      try {
        await gw.connect();
        reconnectDelay = 1_000;
      } catch (err) {
        console.warn("Gateway connection failed", err);
        scheduleReconnect();
      }
    };

    const offState = gw.onState((state) => {
      const open = state === "open";
      setConnected(open);
      if (!open && (state === "closed" || state === "error")) scheduleReconnect();
    });

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      offState();
      gw.close();
      if (gwRef.current === gw) gwRef.current = null;
    };
  }, []);

  // Load session messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setIsGenerating(false);
      setRuntimeSessionId(null);
      runtimeStoredIdRef.current = null;
      return;
    }
    if (!connected) return;

    if (skipNextResumeRef.current === activeSessionId) {
      skipNextResumeRef.current = null;
      return;
    }

    let cancelled = false;
    const gw = gwRef.current;
    if (!gw) return;

    runtimeSessionIdRef.current = null;
    runtimeStoredIdRef.current = null;
    setRuntimeSessionId(null);
    setMessages([]);
    setIsGenerating(false);
    setErrorMessage(null);

    void (async () => {
      try {
        const history = await api.getSessionMessages(activeSessionId, profile);
        const resumed = await gw.request<SessionResumeResult>("session.resume", {
          session_id: activeSessionId,
          profile,
        });
        if (cancelled) return;

        const parsed = parseStoredMessages((history.messages || []) as RawMessage[]);
        if (resumed.inflight?.assistant || resumed.running) {
          parsed.push({
            id: `assistant-${crypto.randomUUID()}`,
            role: "assistant",
            content: resumed.inflight?.assistant ?? "",
            streaming: resumed.inflight?.streaming ?? resumed.running ?? false,
            timestamp: Date.now(),
          });
        }

        runtimeStoredIdRef.current = activeSessionId;
        runtimeSessionIdRef.current = resumed.session_id;
        setRuntimeSessionId(resumed.session_id);
        setIsGenerating(Boolean(resumed.running));
        setMessages(parsed);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to resume session", err);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeSessionId, connected, profile]);

  // Send message
  const handleSend = async (text: string, attachments?: ComposerAttachment[]) => {
    const gw = gwRef.current;
    if (!gw || !connected) return;
    setErrorMessage(null);

    let targetSid = runtimeSessionIdRef.current;
    let targetStoredId = runtimeStoredIdRef.current;

    // If no active session, create one first
    if (!targetSid) {
      if (activeSessionId) {
        setErrorMessage("This session is still resuming. Please try again in a moment.");
        return;
      }
      try {
        const res = await gw.request<SessionCreateResult>("session.create", { profile });
        targetSid = res.session_id;
        targetStoredId = res.stored_session_id;
        runtimeSessionIdRef.current = targetSid;
        runtimeStoredIdRef.current = targetStoredId;
        setRuntimeSessionId(targetSid);
      } catch (e) {
        console.error("Failed to create session", e);
        setErrorMessage("Failed to create new chat session");
        return;
      }
    }

    if (text.startsWith("/") && !attachments?.length) {
      await executeSlash({
        command: text,
        sessionId: targetSid,
        gw,
        callbacks: {
          send: (message) => handleSend(message),
          sys: (content) => setMessages((prev) => [
            ...prev,
            { id: `system-${crypto.randomUUID()}`, role: "system", content, timestamp: Date.now() },
          ]),
        },
      });
      return;
    }

    let submitText = text;
    try {
      for (const attachment of attachments ?? []) {
        if (!attachment.file) continue;
        const dataUrl = attachment.url?.startsWith("data:")
          ? attachment.url
          : await readFileAsDataUrl(attachment.file);
        let result: AttachResult;
        if (attachment.type?.startsWith("image/")) {
          result = await gw.request<AttachResult>("image.attach_bytes", {
            session_id: targetSid,
            data: dataUrl,
            filename: attachment.name,
          });
        } else if (attachment.type === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf")) {
          result = await gw.request<AttachResult>("pdf.attach", {
            session_id: targetSid,
            data: dataUrl,
            filename: attachment.name,
          });
        } else {
          result = await gw.request<AttachResult>("file.attach", {
            session_id: targetSid,
            data_url: dataUrl,
            name: attachment.name,
          });
        }
        if (result.ref_text) submitText = [submitText, result.ref_text].filter(Boolean).join("\n");
      }
    } catch (err) {
      setErrorMessage(`Attachment failed: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      attachments: attachments?.map((a) => ({ name: a.name, url: a.url, type: a.type })),
      timestamp: Date.now(),
    };

    const assistantPlaceholder: ChatMessage = {
      id: `asst-${Date.now()}`,
      role: "assistant",
      content: "",
      streaming: true,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsGenerating(true);

    try {
      await gw.request("prompt.submit", {
        session_id: targetSid,
        text: submitText,
      });
      if (!activeSessionId && targetStoredId) {
        skipNextResumeRef.current = targetStoredId;
        setSearchParams({ session: targetStoredId });
      }
    } catch (e: any) {
      console.error("Prompt submit failed", e);
      setIsGenerating(false);
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          ...assistantPlaceholder,
          content: `Error: ${e?.message || "Failed to send message to agent"}`,
          streaming: false,
        },
      ]);
    }
  };

  // Stop / Interrupt turn
  const handleStop = async () => {
    const gw = gwRef.current;
    const sid = runtimeSessionIdRef.current;
    if (!gw || !sid) return;

    try {
      await gw.request("prompt.interrupt", { session_id: sid });
    } catch (e) {
      console.error("Interrupt failed", e);
    } finally {
      setIsGenerating(false);
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant") {
          return [...prev.slice(0, -1), { ...last, streaming: false, isThinking: false }];
        }
        return prev;
      });
    }
  };

  // Respond to approval request
  const handleApprovalRespond = async (request: ApprovalRequest, choice: ApprovalChoice) => {
    const gw = gwRef.current;
    if (!gw) throw new Error("Gateway is not connected");

    await gw.request("approval.respond", {
      session_id: request.sessionId,
      request_id: request.requestId,
      choice,
    });
  };

  // Select session
  const handleSelectSession = (sid: string) => {
    runtimeSessionIdRef.current = null;
    runtimeStoredIdRef.current = null;
    setRuntimeSessionId(null);
    setSearchParams({ session: sid });
  };

  // New Chat
  const handleNewChat = () => {
    runtimeSessionIdRef.current = null;
    runtimeStoredIdRef.current = null;
    setRuntimeSessionId(null);
    setSearchParams({});
    setMessages([]);
    setIsGenerating(false);
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Multi-Session Sidebar */}
      <WebChatSidebar
        activeSessionId={activeSessionId}
        onSelectSession={handleSelectSession}
        onNewChat={handleNewChat}
        profile={profile}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main Conversation Surface */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Top Status & Model Bar */}
        <div className="h-11 border-b border-border/50 px-4 flex items-center justify-between shrink-0 bg-background/60 backdrop-blur-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="font-semibold text-xs tracking-tight text-foreground">Web Chat</span>
            {modelName && (
              <button
                type="button"
                onClick={() => setModelPickerOpen(true)}
                className="ml-2 text-[11px] font-mono px-2 py-0.5 rounded-full border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
              >
                {modelName}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {connected ? (
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="hidden sm:inline">Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <WifiOff className="w-3 h-3" />
                <span className="hidden sm:inline">Connecting...</span>
              </div>
            )}
          </div>
        </div>

        {errorMessage && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-xs text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Message Stream or Landing Hero */}
        {messages.length === 0 ? (
          <LandingHero onSelectPrompt={(prompt) => handleSend(prompt)} />
        ) : (
          <MessageStream
            messages={messages}
            onApprovalRespond={handleApprovalRespond}
            isGenerating={isGenerating}
          />
        )}

        {/* Composer Bar */}
        <Composer
          onSend={handleSend}
          onStop={handleStop}
          isGenerating={isGenerating}
          gw={gwRef.current}
          modelName={modelName}
          onOpenModelPicker={() => setModelPickerOpen(true)}
          disabled={!connected || Boolean(activeSessionId && !runtimeSessionId)}
        />
      </div>

      {/* Model Picker Dialog */}
      {modelPickerOpen && (
        <ModelPickerDialog
          loader={() => api.getModelOptions(profile)}
          alwaysGlobal
          onApply={async ({ provider, model, confirmExpensiveModel }) => {
            await api.setModelAssignment(
              {
                confirm_expensive_model: confirmExpensiveModel,
                scope: "main",
                provider,
                model,
              },
              profile
            );
            setModelName(model.split("/").pop() || model);
            setModelPickerOpen(false);
          }}
          onClose={() => setModelPickerOpen(false)}
        />
      )}
    </div>
  );
}
