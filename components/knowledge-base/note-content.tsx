"use client"

import { Sparkles, Share2, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { generateMindMap, saveMindMap } from "@/app/actions/mindmap"
import { useEffect, useState } from "react"
import { MindMap } from "./MindMap"

interface NoteContentProps {
  noteId: string  // ✅ 新增
  title: string
  breadcrumb: string[]
  markdown: string
  initialMindmapCode?: string  // ✅ 新增：从数据库读取的缓存
}

export function NoteContent({ noteId, title, breadcrumb, markdown, initialMindmapCode }: NoteContentProps) {

  const [mindmapCode, setMindmapCode] = useState<string | null>(null)
  useEffect(() => {
    setMindmapCode(initialMindmapCode ?? null)  // ✅ 无论有没有都强制更新
  }, [noteId, initialMindmapCode])

  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setMindmapCode(null)
    try {
      const code = await generateMindMap(markdown)
      setMindmapCode(code)
      await saveMindMap(noteId, code)
    } catch (e) {
      console.error("生成思维导图失败:", e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-border px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {breadcrumb.map((item, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              <span
                className={
                  index === breadcrumb.length - 1
                    ? "text-foreground font-medium"
                    : ""
                }
              >
                {item}
              </span>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-primary border-primary/30 hover:bg-primary/5"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "生成中..." : "AI 思维导图"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
          >
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Content ── */}
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="max-w-3xl mx-auto px-8 py-8 min-h-full">

          {/* 标题 */}
          <h1 className="text-3xl font-bold text-foreground mb-6 text-balance">
            {title}
          </h1>

          {/* Markdown 正文 */}
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <style jsx global>{`
              .prose p { margin-top: 0.5rem; margin-bottom: 0.5rem; line-height: 1.75; color: inherit; }
              .prose h1 { font-size: 2.25rem; line-height: 2.5rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.5rem; color: inherit; }
              .prose h2 { font-size: 1.5rem; line-height: 2rem; font-weight: 600; margin-top: 1.25rem; margin-bottom: 0.5rem; color: inherit; }
              .prose h3 { font-size: 1.25rem; line-height: 1.75rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.25rem; color: inherit; }
              .prose ul { list-style-type: disc; padding-left: 1.5rem; }
              .prose ol { list-style-type: decimal; padding-left: 1.5rem; }
              .prose blockquote {
                border-left: 4px solid #e2e8f0;
                padding: 0.75rem 1rem;
                font-style: italic;
                color: #64748b;
                margin: 1rem 0;
                background-color: rgba(148, 163, 184, 0.1);
                border-radius: 0 0.5rem 0.5rem 0;
              }
              .dark .prose blockquote { border-left-color: #475569; color: #94a3b8; }
              .prose code {
                background-color: #f1f5f9;
                padding: 0.2rem 0.4rem;
                border-radius: 0.25rem;
                font-size: 0.875em;
                color: #ef4444;
                font-family: monospace;
              }
              .dark .prose code { background-color: #334155; color: #fca5a5; }
              .prose pre {
                background-color: #1e293b;
                color: #f8fafc;
                padding: 1rem;
                border-radius: 0.5rem;
                overflow-x: auto;
                margin: 1rem 0;
              }
              .prose pre code { background-color: transparent; padding: 0; color: inherit; font-size: 0.875rem; }
              .prose hr { border-color: #e2e8f0; margin: 2rem 0; }
              .dark .prose hr { border-color: #334155; }
            `}</style>

            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {markdown}
            </ReactMarkdown>
          </div>

          {/* ── 思维导图区域 ── */}
          {(loading || mindmapCode) && (
            <div className="mt-8 border border-border rounded-lg bg-card p-4">
              {/* 导图 Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-primary text-sm font-medium">
                  <Sparkles className="h-4 w-4" />
                  AI 思维导图
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground gap-1.5 text-xs"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  重新生成
                </Button>
              </div>

              {/* 导图内容 */}
              {loading ? (
                <div className="min-h-[200px] flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">AI 正在分析笔记内容...</span>
                </div>
              ) : mindmapCode ? (
                <MindMap chart={mindmapCode} />
              ) : null}
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  )
}