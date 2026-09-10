import { useState, useRef, useEffect, useCallback, type ChangeEvent, type ClipboardEvent, type DragEvent } from "react";
import { ArrowUp, Square, Paperclip, X, Cpu } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { SlashPopover, type SlashPopoverHandle } from "@/components/SlashPopover";
import type { GatewayClient } from "@/lib/gatewayClient";
import { cn } from "@/lib/utils";

export interface ComposerAttachment {
  name: string;
  url?: string;
  type?: string;
  file?: File;
}

interface ComposerProps {
  onSend: (text: string, attachments?: ComposerAttachment[]) => void;
  onStop?: () => void;
  isGenerating?: boolean;
  gw: GatewayClient | null;
  modelName?: string;
  onOpenModelPicker?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  onSend,
  onStop,
  isGenerating,
  gw,
  modelName,
  onOpenModelPicker,
  placeholder = "Message Hermes Agent... (type / for commands)",
  disabled,
  className,
  inputRef: externalInputRef,
}: ComposerProps) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const internalInputRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slashRef = useRef<SlashPopoverHandle>(null);

  // Auto-resize textarea height
  const adjustHeight = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 220);
    el.style.height = `${Math.max(44, newHeight)}px`;
  }, [inputRef]);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleSend = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isGenerating || disabled) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setInput("");
    setAttachments([]);
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (slashRef.current?.handleKey(e)) {
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const addFile = (file: File) => {
    const isImage = file.type.startsWith("image/");
    if (isImage) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [
          ...prev,
          { name: file.name, url: reader.result as string, type: file.type, file },
        ]);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachments((prev) => [
        ...prev,
        { name: file.name, type: file.type, file },
      ]);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          addFile(file);
        }
      }
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      addFile(files[i]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className={cn("relative w-full max-w-3xl mx-auto px-4 pb-4 pt-1", className)}>
      {/* Slash command autocomplete */}
      <SlashPopover
        ref={slashRef}
        input={input}
        gw={gw}
        onApply={(cmd) => {
          setInput(cmd + " ");
          inputRef.current?.focus();
        }}
      />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="relative flex flex-col rounded-2xl border border-border/80 bg-background/90 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all overflow-hidden"
      >
        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3 pb-1 border-b border-border/40">
            {attachments.map((att, idx) => (
              <div
                key={idx}
                className="relative group flex items-center gap-1.5 p-1 rounded-md border border-border bg-muted/60 text-xs"
              >
                {att.url ? (
                  <img src={att.url} alt={att.name} className="w-9 h-9 object-cover rounded" />
                ) : (
                  <div className="w-9 h-9 rounded bg-muted flex items-center justify-center">
                    <Paperclip className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <span className="max-w-[100px] truncate text-[11px] font-mono pr-1">{att.name}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(idx)}
                  className="w-4 h-4 rounded-full bg-foreground/20 hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center text-[10px]"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none min-h-[44px] max-h-[220px] leading-relaxed"
        />

        {/* Bottom controls bar */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/20 text-xs">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (e.target.files) {
                  for (let i = 0; i < e.target.files.length; i++) {
                    addFile(e.target.files[i]);
                  }
                }
              }}
            />
            <Button
              type="button"
              ghost
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
              title="Attach files or images"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="w-4 h-4" />
            </Button>

            {modelName && (
              <button
                type="button"
                onClick={onOpenModelPicker}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors border border-border/40"
              >
                <Cpu className="w-3 h-3 text-primary" />
                <span className="truncate max-w-[130px]">{modelName}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {isGenerating ? (
              <Button
                type="button"
                size="sm"
                destructive
                onClick={onStop}
                className="h-7 px-2.5 rounded-lg text-xs gap-1.5 font-medium animate-pulse"
                title="Stop generation"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={(!input.trim() && attachments.length === 0) || disabled}
                onClick={handleSend}
                className="h-7 w-7 p-0 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-40"
                title="Send prompt (Enter)"
              >
                <ArrowUp className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
