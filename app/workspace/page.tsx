"use client"

import { useState, useEffect, useRef } from "react"
import { createNote, getNotes, deleteNote, updateNote } from "@/app/actions/notes"
import { getSessions, createSession, getSessionMessages, saveMessages, deleteSession } from "@/app/actions/chat-history"
import { submitFeedback } from "@/app/actions/feedback"
import { Sidebar } from "@/components/knowledge-base/sidebar"
import { NoteContent } from "@/components/knowledge-base/note-content"
import { AgentPanel } from "@/components/knowledge-base/agent-panel"
import { Button } from "@/components/ui/button"
import { Edit2, Loader2 } from "lucide-react"
import { NoteEditor } from "@/components/knowledge-base/note-editor"
import type { Message, Session } from "@/components/knowledge-base/agent-panel"

export default function Workspace() {
  const [notes, setNotes] = useState<any[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)

  // 停止生成
  const handleStopGenerating = () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
  }

  // 加载笔记和会话列表
  useEffect(() => {
    async function init() {
      const [notesData, sessionsData] = await Promise.all([getNotes(), getSessions()])
      setNotes(notesData)
      if (notesData.length > 0) setActiveNoteId(notesData[0].id)
      setSessions(sessionsData)
      // 默认打开最新会话
      if (sessionsData.length > 0) {
        const latest = sessionsData[0]
        setActiveSessionId(latest.id)
        const msgs = await getSessionMessages(latest.id)
        setMessages(msgs.map(m => ({ id: m.id, role: m.role as "user" | "agent", content: m.content })))
      }
      setIsLoading(false)
    }
    init()
  }, [])

  const loadNotes = async () => {
    const data = await getNotes()
    setNotes(data)
  }

  const handleCreateNote = async () => {
    const res = await createNote("未命名笔记", "# 开始撰写...")
    await loadNotes()
    setActiveNoteId(res.id)
    setIsEditing(true)
  }

  const handleDelete = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("确定要永久删除这篇笔记吗？")) return
    await deleteNote(noteId)
    await loadNotes()
    if (activeNoteId === noteId) {
      setActiveNoteId(null)
      setIsEditing(false)
    }
  }

  const handleSaveNote = async ({ title, content }: { title: string; content: string }) => {
    if (!activeNoteId) return
    try {
      await updateNote(activeNoteId, title, content)
      await loadNotes()
      setIsEditing(false)
    } catch (error) {
      alert("保存失败，请重试")
    }
  }

  // 切换到某个历史会话
  const handleSelectSession = async (sessionId: string) => {
    if (sessionId === activeSessionId) return
    setActiveSessionId(sessionId)
    const msgs = await getSessionMessages(sessionId)
    setMessages(msgs.map(m => ({ id: m.id, role: m.role as "user" | "agent", content: m.content })))
  }

  // 新建对话（不立即写库，发第一条消息时才创建）
  const handleNewSession = () => {
    setActiveSessionId(null)
    setMessages([])
  }

  // 删除会话
  const handleDeleteSession = async (sessionId: string) => {
    await deleteSession(sessionId)
    setSessions(prev => prev.filter(s => s.id !== sessionId))
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
    }
  }

  const handleSendMessage = async (input: string) => {
    const userMsgId = `user-${Date.now()}`
    const agentMsgId = `agent-${Date.now() + 1}`

    // 若还没有活跃会话，发第一条消息时创建
    let sessionId = activeSessionId
    if (!sessionId) {
      const newSession = await createSession(input)
      sessionId = newSession.id
      setActiveSessionId(sessionId)
      setSessions(prev => [newSession, ...prev])
    }

    setMessages(prev => [...prev, { id: userMsgId, role: "user", content: input }])
    setMessages(prev => [...prev, { id: agentMsgId, role: "agent", content: "" }])
    setIsAnalyzing(true)

    // 把当前会话已有消息作为历史（不含刚加的两条）
    const historySnapshot = messages.map(m => ({ role: m.role, content: m.content }))

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, history: historySnapshot, sessionId }),
        signal: controller.signal,
      })

      if (!response.ok) {
        setMessages(prev =>
          prev.map(m => m.id === agentMsgId
            ? { ...m, content: `[错误] 服务端返回 ${response.status}，请稍后重试。` }
            : m)
        )
        return
      }

      const reader = response.body?.getReader()
      if (!reader) return

      const decoder = new TextDecoder()
      let done = false
      let accumulated = ""

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        accumulated += decoder.decode(value, { stream: !doneReading })
        // 流式更新时先过滤掉 __LOG_ID__ 标记
        const displayContent = accumulated.replace(/\n__LOG_ID__:[a-f0-9-]+$/i, "")
        setMessages(prev =>
          prev.map(m => m.id === agentMsgId ? { ...m, content: displayContent } : m)
        )
      }

      // 解析 logId 标记
      const logIdMatch = accumulated.match(/\n__LOG_ID__:([a-f0-9-]+)$/i)
      const chatLogId = logIdMatch?.[1]
      const cleanContent = accumulated.replace(/\n__LOG_ID__:[a-f0-9-]+$/i, "")

      // 更新消息内容并附加 chatLogId
      setMessages(prev =>
        prev.map(m => m.id === agentMsgId ? { ...m, content: cleanContent, chatLogId } : m)
      )

      await saveMessages(sessionId, input, cleanContent)
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // 用户主动停止生成，保留已经流到的内容
        setMessages(prev => {
          const agentMsg = prev.find(m => m.id === agentMsgId)
          if (agentMsg?.content) {
            // 已有部分内容，标记为已中断
            return prev.map(m => m.id === agentMsgId
              ? { ...m, content: m.content + "\n\n[已停止生成]" }
              : m)
          }
          return prev.map(m => m.id === agentMsgId
            ? { ...m, content: "[已停止生成]" }
            : m)
        })
      } else {
        setMessages(prev =>
          prev.map(m => m.id === agentMsgId
            ? { ...m, content: `[错误] 网络异常：${e instanceof Error ? e.message : "请检查连接后重试"}` }
            : m)
        )
      }
    } finally {
      abortControllerRef.current = null
      setIsAnalyzing(false)
    }
  }

  const handleFeedback = async (messageId: string, chatLogId: string, rating: "up" | "down") => {
    // 如果点击已有的相同反馈，则取消（切换效果）
    const currentMsg = messages.find(m => m.id === messageId)
    if (currentMsg?.feedback === rating) {
      setMessages(prev =>
        prev.map(m => m.id === messageId ? { ...m, feedback: null } : m)
      )
      return
    }
    // 更新本地状态
    setMessages(prev =>
      prev.map(m => m.id === messageId ? { ...m, feedback: rating } : m)
    )
    // 提交到服务端
    try {
      await submitFeedback(chatLogId, activeSessionId, rating)
    } catch (err) {
      console.error("反馈提交失败:", err)
    }
  }

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  const currentNote = notes.find(n => n.id === activeNoteId)

  if (notes.length === 0 || !activeNoteId || !currentNote) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-muted-foreground">
        <div className="text-center">
          <p className="mb-4 text-lg">还没有笔记</p>
          <Button onClick={handleCreateNote}>创建第一篇笔记</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="shrink-0 border-r border-border h-full">
        <Sidebar
          notes={notes}
          activeNoteId={activeNoteId}
          onNoteSelect={(id) => { setActiveNoteId(id); setIsEditing(false) }}
          onCreateNote={handleCreateNote}
          onDeleteNote={handleDelete}
        />
      </div>

      <div className="flex-1 min-w-0 h-full relative flex flex-col bg-white dark:bg-zinc-950">
        {isEditing ? (
          <NoteEditor
            initialMarkdown={currentNote.content || ""}
            initialTitle={currentNote.title}
            onSave={handleSaveNote}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <NoteContent
                noteId={activeNoteId}
                title={currentNote.title}
                breadcrumb={["主目录", currentNote.title]}
                markdown={currentNote.content || ""}
                initialMindmapCode={currentNote.mindmapCode}
              />
            </div>
            <div className="absolute bottom-8 right-8 z-20">
              <Button size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={() => setIsEditing(true)}>
                <Edit2 className="h-5 w-5" />
              </Button>
            </div>
          </>
        )}
      </div>

      <AgentPanel
        sessions={sessions}
        activeSessionId={activeSessionId}
        messages={messages}
        onSendMessage={handleSendMessage}
        onNewSession={handleNewSession}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onStopGenerating={handleStopGenerating}
        onFeedback={handleFeedback}
        isAnalyzing={isAnalyzing}
      />
    </div>
  )
}
