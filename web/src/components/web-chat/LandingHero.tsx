import { Sparkles, Globe, Terminal, FileCode, Bug } from "lucide-react";

interface LandingHeroProps {
  onSelectPrompt: (prompt: string) => void;
}

interface PromptStarter {
  title: string;
  prompt: string;
  icon: typeof Sparkles;
  badge?: string;
}

const STARTERS: PromptStarter[] = [
  {
    title: "联网检索资讯",
    prompt: "请搜索关于开源 Agent 架构与工具调用的最新最佳实践，并做一份简报。",
    icon: Globe,
    badge: "Web Search",
  },
  {
    title: "运行单元测试",
    prompt: "请检查当前代码库并运行测试，告诉我是否有任何测试失败。",
    icon: Terminal,
    badge: "Terminal",
  },
  {
    title: "梳理代码架构",
    prompt: "请总结当前仓库的设计意图、核心目录结构和重要数据流转机制。",
    icon: FileCode,
    badge: "Codebase",
  },
  {
    title: "诊断与排错",
    prompt: "请帮我查看最近的系统日志或运行错误，并给出修复建议。",
    icon: Bug,
    badge: "Diagnostics",
  },
];

export function LandingHero({ onSelectPrompt }: LandingHeroProps) {
  return (
    <div className="flex flex-col items-center justify-center max-w-2xl mx-auto px-4 py-16 text-center my-auto">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 shadow-sm">
        <Sparkles className="w-7 h-7 text-primary" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
        有什么我可以帮你的？
      </h1>
      <p className="text-sm text-muted-foreground mb-8 max-w-md">
        Hermes 是一个具备终端执行、网络检索、文件读写能力的自主 AI Agent。
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
        {STARTERS.map((item, idx) => {
          const Icon = item.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelectPrompt(item.prompt)}
              className="group p-3.5 rounded-xl border border-border/70 bg-card/60 hover:bg-card hover:border-primary/40 hover:shadow-xs transition-all text-left flex flex-col justify-between cursor-pointer select-none"
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="font-medium text-xs text-foreground group-hover:text-primary transition-colors">
                    {item.title}
                  </span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono text-muted-foreground/60 px-1.5 py-0.5 rounded bg-muted/60">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {item.prompt}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
