"use client"

import { useState, useEffect } from "react"
import { createNote, getNotes, deleteNote, updateNote } from "@/app/actions/notes"
import { Sidebar } from "@/components/knowledge-base/sidebar"
import { NoteContent } from "@/components/knowledge-base/note-content"
import { AgentPanel } from "@/components/knowledge-base/agent-panel"
import { Button } from "@/components/ui/button"
import { Edit2, Loader2 } from "lucide-react"
import { NoteEditor } from "@/components/knowledge-base/note-editor"
import type { Message } from "@/components/knowledge-base/agent-panel";

export default function Workspace() {
  // 1. 状态管理：只保留当前选中的 ID 和 UI 状态
  const [notes, setNotes] = useState<any[]>([])
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // 2. 初始化：从数据库加载笔记
  const loadNotes = async () => {
    setIsLoading(true)
    const data = await getNotes()
    setNotes(data)
    if (data.length > 0 && !activeNoteId) {
      setActiveNoteId(data[0].id)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadNotes()
  }, [])

  // 当前选中的笔记对象
  const currentNote = notes.find(n => n.id === activeNoteId)

  // ✅ 新建笔记逻辑 (调接口)
  const handleCreateNote = async () => {
    const res = await createNote("未命名笔记", "# 开始撰写...");
    await loadNotes() // 重新加载列表
    setActiveNoteId(res.id)
    setIsEditing(true)
  }

  // ✅ 删除笔记逻辑 (调接口)
  const handleDelete = async (noteId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("确定要永久删除这篇笔记吗？")) return

    await deleteNote(noteId)
    await loadNotes() // 重新加载列表

    if (activeNoteId === noteId) {
      setActiveNoteId(null)
      setIsEditing(false)
    }
  }

  // ✅ 保存笔记逻辑 (关键修改：处理标题和内容)
  const handleSaveNote = async ({ title, content }: { title: string, content: string }) => {
    if (!activeNoteId) return;

    try {
      // 调用 Server Action 更新数据库
      // 假设 updateNote 签名为: updateNote(id, title, content)
      await updateNote(activeNoteId, title, content)

      // 优化体验：先更新本地状态，再刷新列表（或者只刷新列表）
      // 这里选择重新加载列表以确保与数据库一致
      await loadNotes()
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to save note:", error)
      alert("保存失败，请重试")
    }
  }

  const [messages, setMessages] = useState<Message[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleSendMessage = async (input: string) => {
    // 1. 使用时间戳或随机数生成唯一 ID
    const userMsgId = `user-${Date.now()}`;
    const agentMsgId = `agent-${Date.now()}`;
    // 1. 添加用户消息
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: input }]);

    // 2. 添加一个空的 Agent 消息用于占位更新
    setMessages(prev => [...prev, { id: agentMsgId, role: 'agent', content: "" }]);
    setIsAnalyzing(true);

    try {
      // 调用返回 ReadableStream 的接口
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        body: JSON.stringify({ input })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let accumulated = "";

      while (!done) {
        const { value, done: doneReading } = await reader!.read();
        done = doneReading;
        const chunk = decoder.decode(value);
        accumulated += chunk;

        // 实时更新最后一条消息的内容
        setMessages(prev =>
          prev.map(m => m.id === agentMsgId ? { ...m, content: accumulated } : m)
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 加载中状态
  if (isLoading) {
    return <div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin" /></div>
  }

  // 空状态处理
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
          onNoteSelect={(id) => {
            setActiveNoteId(id)
            setIsEditing(false)
          }}
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

      <div className="shrink-0 w-[320px] border-l border-border h-full">
        <AgentPanel messages={messages} onSendMessage={handleSendMessage} isAnalyzing={isAnalyzing} />
      </div>
    </div>
  )
}