"use client"

import { useState, useRef, useEffect } from "react"
import { RefreshCw, PanelRightClose, ArrowUp, Loader2, Brain, Lightbulb, ShieldCheck, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "agent" | "user"
  content: string
  hasCheckmarks?: boolean
}

interface AgentPanelProps {
  messages: Message[]
  onSendMessage: (message: string) => void
  isAnalyzing?: boolean
}

export function AgentPanel({ messages, onSendMessage, isAnalyzing }: AgentPanelProps) {
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部逻辑
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isAnalyzing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isAnalyzing) {
      onSendMessage(input)
      setInput("")
    }
  }

  const renderMessageContent = (content: string) => {
    const plan = content.match(/\[PLAN\]([\s\S]*?)(?=\[|$)/)?.[1]?.trim();
    const reasoning = content.match(/\[REASONING\]([\s\S]*?)(?=\[|$)/)?.[1]?.trim();
    const cleanAnswer = content.replace(/\[PLAN\][\s\S]*?(\[|$)/g, "").replace(/\[REASONING\][\s\S]*?(\[|$)/g, "").trim();

    if (!plan && !reasoning) {
      return <p className="whitespace-pre-wrap break-words">{content}</p>
    }

    return (
      <div className="flex flex-col gap-3">
        {plan && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-1.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-primary">
              <Brain className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">执行规划 (L4)</span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/80 italic">{plan}</p>
          </div>
        )}
        {reasoning && (
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">逻辑推理</span>
            </div>
            <p className="text-[12px] leading-relaxed text-foreground/80">{reasoning}</p>
          </div>
        )}
        {cleanAnswer && <div className="pt-1 whitespace-pre-wrap break-words">{cleanAnswer}</div>}
      </div>
    )
  }

  return (
    /* 1. 最外层容器：h-screen 确保占满全屏，overflow-hidden 阻止整体滚动 */
    <div className="flex h-screen w-85 shrink-0 flex-col border-l border-border bg-card shadow-2xl overflow-hidden">
      
      {/* 2. Header: flex-none 确保高度固定 */}
      <header className="flex-none flex items-center justify-between border-b border-border px-4 py-4 bg-background/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 shadow-lg">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-foreground text-xs tracking-tight">MIND AGENT</span>
            <span className="text-[9px] text-emerald-500 font-medium flex items-center gap-1">
              <div className="h-1 w-1 bg-emerald-500 rounded-full" /> AUTONOMY L4
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-secondary">
            <RefreshCw className="h-4 w-4" />
          </Button>
          {/* <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-secondary">
            <PanelRightClose className="h-4 w-4" />
          </Button> */}
        </div>
      </header>

      {/* 3. 中间消息区: flex-1 撑开空间，min-h-0 是 Flex 内部滚动的黑科技关键点 */}
      <main className="flex-1 min-h-0 relative">
        <ScrollArea className="h-full w-full">
          <div className="px-4 py-6 space-y-8">
            {messages.map((message) => (
              <div key={message.id} className={cn(
                "flex flex-col gap-2 group animate-in fade-in slide-in-from-bottom-3 duration-500",
                message.role === "user" ? "items-end" : "items-start"
              )}>
                <div className="px-1 text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                  {message.role === "agent" ? "SYSTEM CORE" : "OPERATOR"}
                </div>
                <div className={cn(
                  "max-w-[92%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm transition-all",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-none ring-4 ring-primary/5"
                    : "bg-muted/40 text-foreground rounded-tl-none border border-border/40"
                )}>
                  {message.role === "agent" ? renderMessageContent(message.content) : <p>{message.content}</p>}
                </div>
                {message.hasCheckmarks && (
                  <div className="px-1 mt-0.5">
                    <div className="flex items-center gap-1 text-[9px] font-medium text-emerald-600 bg-emerald-500/5 rounded-full px-2 py-0.5 border border-emerald-500/10 w-fit">
                      <ShieldCheck className="h-3 w-3" />
                      <span>VERIFIED DATA</span>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {isAnalyzing && (
              <div className="flex flex-col items-start gap-3 animate-in fade-in duration-300">
                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">AGENT THINKING</span>
                <div className="w-[85%] p-3 rounded-2xl bg-secondary/50 border border-dashed border-border/60 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-foreground/80">自治代理运行中</span>
                    <span className="text-[10px] text-muted-foreground">多步检索与交叉验证中...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={scrollRef} className="h-4" />
          </div>
        </ScrollArea>
      </main>

      {/* 4. Bottom Area: flex-none 确保它永远固定在底部 */}
      <footer className="flex-none border-t border-border p-5 bg-background/80 backdrop-blur-xl z-10">
        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAnalyzing}
            placeholder={isAnalyzing ? "正在解析指令..." : "输入任务目标..."}
            className={cn(
              "w-full rounded-2xl border border-border/60 bg-secondary/30 px-5 py-4 pr-14 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
              isAnalyzing && "opacity-40 cursor-wait"
            )}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isAnalyzing}
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl transition-all shadow-lg",
              input.trim() ? "bg-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5 stroke-[2.5px]" />}
          </Button>
        </form>
        <div className="mt-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest text-nowrap">System Ready</span>
          </div>
          <span className="text-[9px] text-muted-foreground/40 font-mono italic">MIND-OS v4.0.2</span>
        </div>
      </footer>
    </div>
  )
}