import { useState } from "react";
import { ShieldAlert, Check, X, Terminal } from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Badge } from "@nous-research/ui/ui/components/badge";
import { cn } from "@/lib/utils";

export interface ApprovalRequest {
  requestId: string;
  sessionId: string;
  choices?: string[];
  command?: string;
  description?: string;
  tool?: string;
}

export type ApprovalChoice = "once" | "session" | "always" | "deny";

interface ApprovalCardProps {
  request: ApprovalRequest;
  onRespond: (choice: ApprovalChoice) => Promise<void>;
  className?: string;
}

export function ApprovalCard({ request, onRespond, className }: ApprovalCardProps) {
  const [decided, setDecided] = useState<ApprovalChoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (choice: ApprovalChoice) => {
    setSubmitting(true);
    setError(null);
    try {
      await onRespond(choice);
      setDecided(choice);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const allowed = new Set(request.choices ?? ["once", "deny"]);

  return (
    <div
      className={cn(
        "my-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm shadow-xs",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-semibold text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400">
          Action Approval Required
        </span>
        {decided !== null && (
          <Badge
            tone={decided === "deny" ? "destructive" : "success"}
            className="ml-auto text-[10px] py-0 px-1.5"
          >
            {decided === "deny" ? "Denied" : "Approved"}
          </Badge>
        )}
      </div>

      <p className="text-xs text-foreground/80 mb-2">
        {request.description || "The agent needs your explicit permission to run the following action:"}
      </p>

      {request.command && (
        <div className="mb-3 rounded bg-background/90 border border-border/50 p-2 font-mono text-xs overflow-x-auto text-foreground">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] mb-1">
            <Terminal className="w-3 h-3" />
            <span>Command</span>
          </div>
          <code className="break-all">{request.command}</code>
        </div>
      )}

      {decided === null ? (
        <div className="flex items-center gap-2 justify-end pt-1">
          <Button
            outlined
            size="sm"
            disabled={submitting}
            onClick={() => void handleAction("deny")}
            className="h-7 text-xs border-border/60 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Deny
          </Button>
          {allowed.has("session") && (
            <Button outlined size="sm" disabled={submitting} onClick={() => void handleAction("session")}>
              This session
            </Button>
          )}
          {allowed.has("always") && (
            <Button outlined size="sm" disabled={submitting} onClick={() => void handleAction("always")}>
              Always
            </Button>
          )}
          <Button
            size="sm"
            disabled={submitting}
            onClick={() => void handleAction("once")}
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Check className="w-3.5 h-3.5 mr-1" />
            Approve once
          </Button>
        </div>
      ) : (
        <div className="text-right text-xs text-muted-foreground italic">
          {decided === "deny" ? "You denied this action." : "You approved this action."}
        </div>
      )}
      {error && <div className="pt-2 text-xs text-destructive">{error}</div>}
    </div>
  );
}
