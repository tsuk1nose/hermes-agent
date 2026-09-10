import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, User, Sparkles, FileText, X } from "lucide-react";
import { Markdown } from "@/components/Markdown";
import { Button } from "@nous-research/ui/ui/components/button";
import { ToolStepCard, type ToolExecution } from "./ToolStepCard";
import { ThinkingBlock } from "./ThinkingBlock";
import { ApprovalCard, type ApprovalChoice, type ApprovalRequest } from "./ApprovalCard";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface MessageAttachment {
  name: string;
  path?: string;
  type?: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  isThinking?: boolean;
  tools?: ToolExecution[];
  approval?: ApprovalRequest;
  streaming?: boolean;
  attachments?: MessageAttachment[];
  timestamp?: number;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onApprovalRespond?: (request: ApprovalRequest, choice: ApprovalChoice) => Promise<void>;
  profile?: string;
  className?: string;
}

function AttachmentPreview({ attachment, profile }: { attachment: MessageAttachment; profile?: string }) {
  const [imageUrl, setImageUrl] = useState(attachment.url);
  const [previewOpen, setPreviewOpen] = useState(false);
  const isImage = attachment.type?.startsWith("image/");

  useEffect(() => {
    if (attachment.url || !attachment.path || !isImage) return;

    let cancelled = false;
    void api.getMedia(attachment.path, profile)
      .then(({ data_url }) => {
        if (!cancelled) setImageUrl(data_url);
      })
      .catch(() => {
        if (!cancelled) setImageUrl(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.path, attachment.url, isImage, profile]);

  useEffect(() => {
    if (!previewOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [previewOpen]);

  return (
    <>
      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/80 p-1.5 font-mono text-xs">
        {imageUrl && isImage ? (
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            className="group/image relative cursor-zoom-in overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={`预览 ${attachment.name}`}
          >
            <img src={imageUrl} alt={attachment.name} className="h-12 w-12 object-cover transition-transform group-hover/image:scale-105" />
          </button>
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded bg-muted">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <span className="max-w-[120px] truncate text-xs">{attachment.name}</span>
      </div>

      {previewOpen && imageUrl && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`预览 ${attachment.name}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewOpen(false);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <img
            src={imageUrl}
            alt={attachment.name}
            className="max-h-[90dvh] max-w-[92vw] object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="关闭图片预览"
          >
            <X className="h-5 w-5" />
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}

export function MessageBubble({ message, onApprovalRespond, profile, className }: MessageBubbleProps) {
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
              <AttachmentPreview key={`${att.path ?? att.name}-${idx}`} attachment={att} profile={profile} />
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
