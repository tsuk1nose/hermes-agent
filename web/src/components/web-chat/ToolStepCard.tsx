import { useState } from "react";
import { ChevronDown, ChevronRight, Check, AlertCircle, Terminal, FileCode, Globe, Wrench, Copy, CheckCheck } from "lucide-react";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { Button } from "@nous-research/ui/ui/components/button";
import { cn } from "@/lib/utils";

export interface ToolExecution {
  id: string;
  name: string;
  params?: Record<string, any> | string;
  output?: string;
  status: "running" | "complete" | "error";
  error?: string;
  durationMs?: number;
}

interface ToolStepCardProps {
  execution: ToolExecution;
  className?: string;
}

function getToolIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("terminal") || lower.includes("bash") || lower.includes("exec")) {
    return Terminal;
  }
  if (lower.includes("file") || lower.includes("read") || lower.includes("write") || lower.includes("patch")) {
    return FileCode;
  }
  if (lower.includes("search") || lower.includes("browse") || lower.includes("fetch") || lower.includes("url")) {
    return Globe;
  }
  return Wrench;
}

function formatToolSummary(name: string, params?: Record<string, any> | string): string {
  if (!params) return name;
  if (typeof params === "string") {
    return params.slice(0, 80);
  }
  if (params.command) return String(params.command).slice(0, 80);
  if (params.path || params.file_path || params.TargetFile) {
    return String(params.path || params.file_path || params.TargetFile).slice(0, 80);
  }
  if (params.query) return `"${String(params.query).slice(0, 60)}"`;
  if (params.url) return String(params.url).slice(0, 80);
  return JSON.stringify(params).slice(0, 80);
}

export function ToolStepCard({ execution, className }: ToolStepCardProps) {
  const [expanded, setExpanded] = useState(execution.status === "running");
  const [copied, setCopied] = useState(false);
  const Icon = getToolIcon(execution.name);

  const summary = formatToolSummary(execution.name, execution.params);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = execution.output || (typeof execution.params === "string" ? execution.params : JSON.stringify(execution.params, null, 2));
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "my-2 rounded-lg border text-sm transition-all overflow-hidden",
        execution.status === "error"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border/60 bg-card/60 hover:border-border",
        className
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
        className="flex items-center gap-2.5 px-3 py-2 cursor-pointer select-none text-foreground/90"
      >
        <div className="shrink-0 flex items-center justify-center w-5 h-5">
          {execution.status === "running" && <Spinner className="w-3.5 h-3.5 text-primary" />}
          {execution.status === "complete" && <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />}
          {execution.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
        </div>

        <Badge tone="outline" className="gap-1 font-mono text-[11px] font-normal py-0.5 px-1.5 bg-background/50">
          <Icon className="w-3 h-3 text-muted-foreground" />
          {execution.name}
        </Badge>

        <span className="font-mono text-xs text-muted-foreground truncate flex-1" title={summary}>
          {summary}
        </span>

        {execution.durationMs !== undefined && (
          <span className="text-[11px] text-muted-foreground/70 shrink-0 font-mono">
            {(execution.durationMs / 1000).toFixed(1)}s
          </span>
        )}

        <div className="text-muted-foreground/60 shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/40 bg-muted/30 px-3 py-2.5 space-y-2 text-xs font-mono">
          {execution.params && (
            <div>
              <div className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Parameters</div>
              <pre className="p-2 rounded bg-background/80 border border-border/30 overflow-x-auto text-foreground/90 whitespace-pre-wrap break-all">
                {typeof execution.params === "string" ? execution.params : JSON.stringify(execution.params, null, 2)}
              </pre>
            </div>
          )}

          {(execution.output || execution.error) && (
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase font-semibold text-muted-foreground mb-1">
                <span>{execution.error ? "Error" : "Output"}</span>
                <Button
                  ghost
                  size="sm"
                  className="h-5 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={handleCopy}
                >
                  {copied ? <CheckCheck className="w-3 h-3 text-emerald-500 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <pre
                className={cn(
                  "p-2 rounded max-h-60 overflow-y-auto overflow-x-auto whitespace-pre-wrap break-all border",
                  execution.error
                    ? "bg-destructive/10 text-destructive border-destructive/20"
                    : "bg-background/80 text-foreground/90 border-border/30"
                )}
              >
                {execution.error || execution.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
