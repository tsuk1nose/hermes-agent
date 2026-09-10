import { useRef, useEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import type { ApprovalChoice, ApprovalRequest } from "./ApprovalCard";
import { cn } from "@/lib/utils";

interface MessageStreamProps {
  messages: ChatMessage[];
  onApprovalRespond?: (request: ApprovalRequest, choice: ApprovalChoice) => Promise<void>;
  isGenerating?: boolean;
  className?: string;
}

export function MessageStream({
  messages,
  onApprovalRespond,
  isGenerating,
  className,
}: MessageStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledUpRef = useRef(false);

  // Check scroll position to decide whether to stick to bottom or show scroll button
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceToBottom > 80;
    userScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    userScrolledUpRef.current = false;
    setShowScrollBottom(false);
  };

  // Auto-scroll on new message or streaming delta
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom("auto");
    }
  }, [messages, isGenerating]);

  return (
    <div className={cn("relative flex-1 overflow-hidden flex flex-col", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 max-w-4xl w-full mx-auto"
      >
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            onApprovalRespond={onApprovalRespond}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>

      {showScrollBottom && (
        <Button
          type="button"
          size="sm"
          outlined
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-4 right-8 rounded-full w-8 h-8 p-0 bg-background/90 shadow-md border-border/80 text-foreground hover:bg-background z-10"
          title="Scroll to bottom"
        >
          <ArrowDown className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
