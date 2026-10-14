import { Sparkles } from "lucide-react";

export function LandingHero() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 text-center">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5 shadow-sm">
        <Sparkles className="w-7 h-7 text-primary" />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
        有什么我可以帮你的？
      </h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Hermes 是一个具备终端执行、网络检索、文件读写能力的自主 AI Agent。
      </p>

    </div>
  );
}
