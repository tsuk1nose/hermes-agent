import { useState, useEffect, useMemo, useCallback } from "react";
import {
  MessageSquarePlus,
  Search,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Button } from "@nous-research/ui/ui/components/button";
import { Spinner } from "@nous-research/ui/ui/components/spinner";
import { api, type SessionInfo } from "@/lib/api";
import { cn } from "@/lib/utils";

interface WebChatSidebarProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  profile?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  className?: string;
}

interface GroupedSessions {
  today: SessionInfo[];
  yesterday: SessionInfo[];
  lastWeek: SessionInfo[];
  older: SessionInfo[];
}

function normalizeTimestamp(val: unknown): number {
  if (typeof val === "number") {
    return val > 1e11 ? val : val * 1000;
  }
  if (typeof val === "string") {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
    const num = Number(val);
    if (!isNaN(num)) return num > 1e11 ? num : num * 1000;
  }
  return Date.now();
}

function getSessionDisplayTitle(s: SessionInfo): string {
  const t = s.title?.trim();
  if (t && t !== "Untitled") return t;
  const p = s.preview?.trim();
  if (p) return p;
  return "新对话";
}

export function WebChatSidebar({
  activeSessionId,
  onSelectSession,
  onNewChat,
  profile,
  collapsed = false,
  onToggleCollapse,
  className,
}: WebChatSidebarProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const query = searchQuery.trim();
      if (query) {
        const res = await api.searchSessions(query, { profile });
        setSessions(res.results || []);
      } else {
        const res = await api.getSessions(60, 0, { profile, order: "recent" });
        setSessions(res.sessions || []);
      }
    } catch (e) {
      console.error("Failed to load sessions", e);
    } finally {
      setLoading(false);
    }
  }, [profile, searchQuery]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleStartRename = (e: React.MouseEvent, s: SessionInfo) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditingTitle(getSessionDisplayTitle(s));
  };

  const handleSaveRename = async (e: React.MouseEvent, s: SessionInfo) => {
    e.stopPropagation();
    const newTitle = editingTitle.trim();
    if (!newTitle || newTitle === s.title) {
      setEditingId(null);
      return;
    }
    try {
      await api.renameSession(s.id, newTitle, profile);
      setSessions((prev) =>
        prev.map((item) => (item.id === s.id ? { ...item, title: newTitle } : item))
      );
    } catch (err) {
      console.error("Failed to rename session", err);
    } finally {
      setEditingId(null);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("确定要删除此对话会话吗？")) return;
    try {
      await api.deleteSession(id, profile);
      setSessions((prev) => prev.filter((item) => item.id !== id));
      if (activeSessionId === id) {
        onNewChat();
      }
    } catch (err) {
      console.error("Failed to delete session", err);
    }
  };

  // Group sessions by relative date
  const grouped = useMemo(() => {
    const now = Date.now();
    const oneDay = 24 * 3600 * 1000;
    const twoDays = 48 * 3600 * 1000;
    const sevenDays = 7 * oneDay;

    const groups: GroupedSessions = {
      today: [],
      yesterday: [],
      lastWeek: [],
      older: [],
    };

    for (const s of sessions) {
      const ts = normalizeTimestamp(s.last_active || s.started_at);
      const diff = now - ts;
      if (diff < oneDay) {
        groups.today.push(s);
      } else if (diff < twoDays) {
        groups.yesterday.push(s);
      } else if (diff < sevenDays) {
        groups.lastWeek.push(s);
      } else {
        groups.older.push(s);
      }
    }

    return groups;
  }, [sessions]);

  if (collapsed) {
    return (
      <div className={cn("w-14 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col items-center py-3 gap-3", className)}>
        <Button
          ghost
          size="sm"
          onClick={onToggleCollapse}
          className="w-9 h-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
          title="展开侧边栏"
        >
          <PanelLeftOpen className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          onClick={onNewChat}
          className="w-9 h-9 p-0 rounded-lg shadow-xs"
          title="新建对话"
        >
          <MessageSquarePlus className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  const renderGroup = (title: string, list: SessionInfo[]) => {
    if (list.length === 0) return null;
    return (
      <div className="mb-4">
        <div className="text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-2 mb-1.5">
          {title}
        </div>
        <div className="space-y-0.5">
          {list.map((s) => {
            const isActive = s.id === activeSessionId;
            const isEditing = s.id === editingId;
            const displayTitle = getSessionDisplayTitle(s);

            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSession(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectSession(s.id);
                  }
                }}
                className={cn(
                  "group relative flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-foreground/80 hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editingTitle}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(e as any, s);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="bg-background border border-primary/50 rounded px-1.5 py-0.5 text-xs w-full focus:outline-none"
                    />
                  ) : (
                    <span className="truncate" title={displayTitle}>
                      {displayTitle}
                    </span>
                  )}
                </div>

                {/* Row actions */}
                <div
                  className={cn(
                    "items-center gap-0.5 shrink-0",
                    isEditing ? "flex" : "hidden group-hover:flex"
                  )}
                >
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleSaveRename(e, s)}
                        className="p-1 text-emerald-500 hover:text-emerald-600 rounded"
                        title="保存"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(null);
                        }}
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                        title="取消"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={(e) => handleStartRename(e, s)}
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                        title="重命名"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, s.id)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded"
                        title="删除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("w-64 shrink-0 border-r border-border/60 bg-card/40 flex flex-col h-full", className)}>
      {/* Header with New Chat & Collapse toggle */}
      <div className="p-3 border-b border-border/40 flex items-center gap-2">
        <Button
          size="sm"
          onClick={onNewChat}
          className="flex-1 justify-start gap-2 h-9 text-xs rounded-lg shadow-xs"
        >
          <MessageSquarePlus className="w-4 h-4" />
          <span>新建对话</span>
        </Button>

        {onToggleCollapse && (
          <Button
            ghost
            size="sm"
            onClick={onToggleCollapse}
            className="w-9 h-9 p-0 rounded-lg text-muted-foreground hover:text-foreground"
            title="收起侧边栏"
          >
            <PanelLeftClose className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted-foreground/60 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索会话记录..."
            className="w-full bg-muted/40 border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-xs">
            <Spinner className="w-3.5 h-3.5" />
            <span>加载会话中...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted-foreground">
            {searchQuery ? "未找到匹配会话" : "暂无历史会话"}
          </div>
        ) : (
          <>
            {renderGroup("今天", grouped.today)}
            {renderGroup("昨天", grouped.yesterday)}
            {renderGroup("过去 7 天", grouped.lastWeek)}
            {renderGroup("更早", grouped.older)}
          </>
        )}
      </div>
    </div>
  );
}
