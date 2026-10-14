import { useState } from "react";
import { Brain, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isThinking?: boolean;
  className?: string;
}

export function ThinkingBlock({ content, isThinking, className }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);

  if (!content && !isThinking) return null;

  return (
    <div className={cn("my-2 rounded-lg border border-border/40 bg-muted/20 text-xs overflow-hidden", className)}>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors select-none text-left"
      >
        <div className="flex items-center gap-1.5 font-medium">
          {isThinking ? (
            <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          ) : (
            <Brain className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span>{isThinking ? "Thinking..." : "Thought process"}</span>
        </div>

        <div className="ml-auto text-muted-foreground/60">
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 py-2 border-t border-border/30 bg-muted/10 text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs italic">
          {content || (isThinking && <span className="animate-pulse">Deliberating on the approach...</span>)}
        </div>
      )}
    </div>
  );
}
