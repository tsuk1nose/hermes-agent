import { useCallback, useRef, useLayoutEffect, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import type { ApprovalChoice, ApprovalRequest } from "./ApprovalCard";
import { cn } from "@/lib/utils";

interface MessageStreamProps {
  messages: ChatMessage[];
  onApprovalRespond?: (request: ApprovalRequest, choice: ApprovalChoice) => Promise<void>;
  profile?: string;
  className?: string;
}

export function MessageStream({
  messages,
  onApprovalRespond,
  profile,
  className,
}: MessageStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledUpRef = useRef(false);
  const touchStartYRef = useRef<number | null>(null);

  // Check scroll position to decide whether to stick to bottom or show scroll button
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isUp = distanceToBottom > 24;
    userScrolledUpRef.current = isUp;
    setShowScrollBottom(isUp);
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    userScrolledUpRef.current = false;
    setShowScrollBottom(false);
  }, []);

  // Keep following a live turn only while the reader has not intentionally
  // moved away from the bottom. scrollTop is scoped to this pane;
  // scrollIntoView would also move dashboard ancestors and the session list.
  useLayoutEffect(() => {
    if (!userScrolledUpRef.current) {
      scrollToBottom("auto");
    }
  }, [messages, scrollToBottom]);

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onWheel={(event) => {
          if (event.deltaY < 0) userScrolledUpRef.current = true;
        }}
        onTouchStart={(event) => {
          touchStartYRef.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchMove={(event) => {
          const currentY = event.touches[0]?.clientY;
          if (
            currentY !== undefined &&
            touchStartYRef.current !== null &&
            currentY > touchStartYRef.current
          ) {
            userScrolledUpRef.current = true;
          }
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprovalRespond={onApprovalRespond}
              profile={profile}
            />
          ))}
          <div className="h-4" />
        </div>
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
