"use client"

import { useState, useRef, useEffect } from "react"
import { ArrowUp, Loader2, Brain, Lightbulb, ShieldCheck, Sparkles, Plus, MessageSquare, Trash2, ChevronLeft, Square, ThumbsUp, ThumbsDown } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export interface Message {
  id: string
  role: "agent" | "user"
  content: string
  chatLogId?: string
  feedback?: "up" | "down" | null
}

export interface Session {
  id: string
  title: string
  createdAt: Date | string
}

interface AgentPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  messages: Message[]
  onSendMessage: (message: string) => void
  onNewSession: () => void
  onSelectSession: (sessionId: string) => void
  onDeleteSession: (sessionId: string) => void
  onStopGenerating?: () => void
  onFeedback?: (messageId: string, chatLogId: string, rating: "up" | "down") => void
  isAnalyzing?: boolean
}

export function AgentPanel({
  sessions,
  activeSessionId,
  messages,
  onSendMessage,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onStopGenerating,
  onFeedback,
  isAnalyzing,
}: AgentPanelProps) {
  const [input, setInput] = useState("")
  const [showSessions, setShowSessions] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showSessions && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isAnalyzing, showSessions])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isAnalyzing) {
      onSendMessage(input)
      setInput("")
      setShowSessions(false)
    }
  }

  const handleNewSession = () => {
    onNewSession()
    setShowSessions(false)
  }

  const handleSelectSession = (sessionId: string) => {
    onSelectSession(sessionId)
    setShowSessions(false)
  }

  const MarkdownContent = ({ children }: { children: string }) => (
    <div className="min-w-0 max-w-full overflow-hidden [overflow-wrap:anywhere]">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1.5">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold mt-2.5 mb-1">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-bold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic">
            {children}
          </blockquote>
        ),
        code: ({ className, children }) => {
          const isBlock = className?.includes("language-")
          if (isBlock) {
            return (
              <pre className="bg-background/80 rounded-lg p-3 my-2 overflow-x-auto text-xs">
                <code>{children}</code>
              </pre>
            )
          }
          return <code className="bg-background/80 rounded px-1.5 py-0.5 text-xs font-mono">{children}</code>
        },
        hr: () => <hr className="my-3 border-border/60" />,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-border/60 bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="border border-border/60 px-2 py-1">{children}</td>,
      }}
    >
      {children}
    </ReactMarkdown>
    </div>
  )

  const renderMessageContent = (content: string) => {
    const plan = content.match(/\[PLAN\]([\s\S]*?)(?=\[(?:REASONING|EXECUTE|ADAPT)\]|$)/)?.[1]?.trim()
    const reasoning = content.match(/\[REASONING\]([\s\S]*?)(?=\[(?:PLAN|EXECUTE|ADAPT)\]|$)/)?.[1]?.trim()
    const cleanAnswer = content
      .replace(/\[PLAN\][\s\S]*?(?=\[(?:REASONING|EXECUTE|ADAPT)\]|$)/g, "")
      .replace(/\[REASONING\][\s\S]*?(?=\[(?:PLAN|EXECUTE|ADAPT)\]|$)/g, "")
      .replace(/\[EXECUTE\]\s*/g, "")
      .replace(/\[ADAPT\]\s*/g, "")
      .trim()

    if (!plan && !reasoning) {
      return <div className="break-words"><MarkdownContent>{content}</MarkdownContent></div>
    }

    return (
      <div className="flex flex-col gap-3">
        {plan && (
          <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-primary">
              <Brain className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">执行规划</span>
            </div>
            <div className="text-[12px] leading-relaxed text-foreground/80 italic"><MarkdownContent>{plan}</MarkdownContent></div>
          </div>
        )}
        {reasoning && (
          <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-600">
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">逻辑推理</span>
            </div>
            <div className="text-[12px] leading-relaxed text-foreground/80"><MarkdownContent>{reasoning}</MarkdownContent></div>
          </div>
        )}
        {cleanAnswer && <div className="pt-1 break-words"><MarkdownContent>{cleanAnswer}</MarkdownContent></div>}
      </div>
    )
  }

  const formatDate = (date: Date | string) => {
    const d = new Date(date)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "今天"
    if (diffDays === 1) return "昨天"
    if (diffDays < 7) return `${diffDays}天前`
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
  }

  return (
    <div className="flex h-screen w-[420px] min-w-0 shrink-0 flex-col border-l border-border bg-card shadow-2xl overflow-hidden">

      {/* Header */}
      <header className="flex-none flex items-center justify-between border-b border-border px-4 py-4 bg-background/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-2.5">
          {showSessions ? (
            <button
              onClick={() => setShowSessions(false)}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="text-xs font-semibold">返回对话</span>
            </button>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!showSessions && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:bg-secondary"
              onClick={handleNewSession}
              title="新建对话"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 transition-colors", showSessions ? "text-primary bg-primary/10" : "text-muted-foreground hover:bg-secondary")}
            onClick={() => setShowSessions(!showSessions)}
            title="历史对话"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Sessions list view */}
      {showSessions ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="px-4 pt-4 pb-2">
            <button
              onClick={handleNewSession}
              className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>新建对话</span>
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="px-4 pb-4 space-y-1.5">
              {sessions.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">还没有历史对话</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className={cn(
                      "group relative flex items-start gap-3 rounded-xl px-3 py-3 cursor-pointer transition-all",
                      activeSessionId === session.id
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-accent/50 border border-transparent"
                    )}
                    onClick={() => handleSelectSession(session.id)}
                  >
                    <MessageSquare className={cn("h-4 w-4 mt-0.5 shrink-0", activeSessionId === session.id ? "text-primary" : "text-muted-foreground")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm truncate", activeSessionId === session.id ? "text-foreground font-medium" : "text-foreground/80")}>
                        {session.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{formatDate(session.createdAt)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      ) : (
        /* Chat view */
        <main className="flex-1 min-h-0 min-w-0 relative overflow-hidden">
          <ScrollArea className="h-full w-full">
            <div className="px-4 py-6 space-y-8 min-w-0">

              {messages.length === 0 && !isAnalyzing && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">新对话</p>
                  <p className="text-xs text-muted-foreground mt-1">输入问题开始对话</p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={cn(
                  "flex flex-col gap-2 min-w-0 animate-in fade-in slide-in-from-bottom-3 duration-500",
                  message.role === "user" ? "items-end" : "items-start"
                )}>
                  <div className="px-1 text-[9px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">
                    {message.role === "agent" ? "SYSTEM CORE" : "OPERATOR"}
                  </div>
                  <div className={cn(
                    "rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm min-w-0",
                    message.role === "user"
                      ? "max-w-[85%] bg-primary text-primary-foreground rounded-tr-none ring-4 ring-primary/5"
                      : "max-w-full bg-muted/40 text-foreground rounded-tl-none border border-border/40"
                  )}>
                    <div className="overflow-hidden break-words [overflow-wrap:anywhere]">
                      {message.role === "agent" ? renderMessageContent(message.content) : <p>{message.content}</p>}
                    </div>
                  </div>
                  {message.role === "agent" && message.content && !isAnalyzing && (
                    <div className="flex items-center gap-0.5 px-1">
                      <button
                        onClick={() => message.chatLogId && onFeedback?.(message.id, message.chatLogId, "up")}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          message.feedback === "up"
                            ? "text-emerald-500 bg-emerald-500/10"
                            : "text-muted-foreground/40 hover:text-emerald-500 hover:bg-emerald-500/10"
                        )}
                        title="有帮助"
                      >
                        <ThumbsUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => message.chatLogId && onFeedback?.(message.id, message.chatLogId, "down")}
                        className={cn(
                          "p-1.5 rounded-lg transition-colors",
                          message.feedback === "down"
                            ? "text-red-500 bg-red-500/10"
                            : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10"
                        )}
                        title="没帮助"
                      >
                        <ThumbsDown className="h-3 w-3" />
                      </button>
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
      )}

      {/* Footer input */}
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
          {isAnalyzing ? (
            <Button
              type="button"
              size="icon"
              onClick={onStopGenerating}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl transition-all shadow-lg bg-destructive hover:bg-destructive/90"
              title="停止生成"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl transition-all shadow-lg",
                input.trim() ? "bg-primary" : "bg-muted text-muted-foreground"
              )}
            >
              <ArrowUp className="h-5 w-5 stroke-[2.5px]" />
            </Button>
          )}
        </form>
        <div className="mt-4 flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">System Ready</span>
          </div>
          <span className="text-[9px] text-muted-foreground/40 font-mono italic">MIND-OS v4.0.2</span>
        </div>
      </footer>
    </div>
  )
}
