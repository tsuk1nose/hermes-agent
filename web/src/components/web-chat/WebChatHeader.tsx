import { Button } from "@nous-research/ui/ui/components/button";
import { MessageSquarePlus, PanelLeftClose, PanelLeftOpen, Sparkles, WifiOff } from "lucide-react";

interface WebChatHeaderProps {
  modelName: string;
  connected: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onNewChat: () => void;
  onOpenModelPicker: () => void;
}

export function WebChatHeader({ modelName, connected, sidebarOpen, onToggleSidebar, onNewChat, onOpenModelPicker }: WebChatHeaderProps) {
  return (
    <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-background/60 px-2 backdrop-blur-xs sm:px-4">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button ghost size="icon" aria-label="会话列表" aria-expanded={sidebarOpen} onClick={onToggleSidebar} className="h-7 w-7 shrink-0 p-0 [&>svg]:size-4">
          {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
        </Button>
        <Sparkles className="hidden h-4 w-4 shrink-0 text-primary sm:block" />
        <span className="hidden text-xs font-semibold tracking-tight text-foreground sm:inline">Web Chat</span>
        <button type="button" onClick={onOpenModelPicker} aria-label="模型与思考强度" className="min-w-0 truncate rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground">
          {modelName || "选择模型"}
        </button>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button ghost size="icon" onClick={onNewChat} aria-label="新建对话" className="h-7 w-7 p-0 [&>svg]:size-4">
          <MessageSquarePlus />
        </Button>
        {connected ? (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Connected</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Connecting...</span>
          </div>
        )}
      </div>
    </div>
  );
}
