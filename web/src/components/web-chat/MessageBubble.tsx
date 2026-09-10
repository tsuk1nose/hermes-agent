import { useState } from "react";
import { Copy, Check, User, Sparkles, FileText } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@nous-research/ui/ui/components/button";
import { ToolStepCard, type ToolExecution } from "./ToolStepCard";
import { ThinkingBlock } from "./ThinkingBlock";
import { ApprovalCard, type ApprovalChoice, type ApprovalRequest } from "./ApprovalCard";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  tools?: ToolExecution[];
  approval?: ApprovalRequest;
  streaming?: boolean;
  attachments?: Array<{ name: string; url?: string; type?: string }>;
  timestamp?: number;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onApprovalRespond?: (request: ApprovalRequest, choice: ApprovalChoice) => Promise<void>;
  className?: string;
}

export function MessageBubble({ message, onApprovalRespond, className }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 py-4 px-4 rounded-xl transition-colors",
        isUser
          ? "bg-muted/40 max-w-[85%] ml-auto text-foreground"
          : "bg-transparent w-full text-foreground/95",
        className
      )}
    >
      <div className="shrink-0 pt-0.5">
        <div
          className={cn(
            "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold select-none",
            isUser
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-primary/10 text-primary border border-primary/20"
          )}
        >
          {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
        </div>
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-xs text-foreground/90">
            {isUser ? "You" : "Hermes Agent"}
          </span>
          {message.timestamp && (
            <span className="text-[10px] text-muted-foreground/60">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>

        {/* Attachments preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 my-2">
            {message.attachments.map((att, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1.5 p-1.5 rounded-md border border-border/60 bg-background/80 text-xs font-mono"
              >
                {att.url && att.type?.startsWith("image/") ? (
                  <img src={att.url} alt={att.name} className="w-12 h-12 object-cover rounded" />
                ) : (
                  <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                )}
                <span className="truncate max-w-[120px] text-xs">{att.name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Thinking Block */}
        {message.thinking || message.isThinking ? (
          <ThinkingBlock content={message.thinking || ""} isThinking={message.isThinking} />
        ) : null}

        {/* Tool Executions */}
        {message.tools && message.tools.length > 0 && (
          <div className="my-2 space-y-1">
            {message.tools.map((tool) => (
              <ToolStepCard key={tool.id} execution={tool} />
            ))}
          </div>
        )}

        {/* Approval Card */}
        {message.approval && onApprovalRespond && (
          <ApprovalCard
            request={message.approval}
            onRespond={(choice) => onApprovalRespond(message.approval!, choice)}
          />
        )}

        {/* Markdown Content */}
        {message.content ? (
          <div className="break-words">
            <Markdown content={message.content} streaming={message.streaming} />
          </div>
        ) : null}

        {/* Copy action footer for assistant */}
        {!isUser && message.content && (
          <div className="pt-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
            <Button
              ghost
              size="sm"
              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
            >
              {copied ? <Check className="w-3 h-3 mr-1 text-emerald-500" /> : <Copy className="w-3 h-3 mr-1" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
