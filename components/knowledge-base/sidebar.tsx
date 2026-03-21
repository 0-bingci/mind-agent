"use client"

import { useState } from "react"
import {
  Search, FileText, Settings, Plus,
  ChevronDown, ChevronRight, Trash2, X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SettingsDialog } from "../SettingsDialog"

interface Note {
  id: string
  title: string
}

interface SidebarProps {
  notes: Note[]
  activeNoteId?: string
  onNoteSelect: (noteId: string) => void
  onCreateNote: () => void
  onDeleteNote: (noteId: string, e: React.MouseEvent) => void
}

export function Sidebar({ notes, activeNoteId, onNoteSelect, onCreateNote, onDeleteNote }: SidebarProps) {
  const [notesExpanded, setNotesExpanded] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchFocused, setSearchFocused] = useState(false)

  // ✅ 本地过滤：标题包含搜索词（不区分大小写）
  const filteredNotes = searchQuery.trim()
    ? notes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : notes

  return (
    <div className="flex h-full w-full flex-col bg-card border-r border-border">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
          M
        </div>
        <span className="font-semibold text-foreground">个人知识库</span>
      </div>

      <ScrollArea className="flex-1 py-2">
        <div className="px-2">
          {/* ✅ 搜索框 */}
          <div className={cn(
            "flex items-center gap-2 mb-3 px-3 py-1.5 rounded-md border text-sm transition-colors",
            searchFocused
              ? "border-primary/50 bg-background"
              : "border-transparent bg-accent/50 text-muted-foreground"
          )}>
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              type="text"
              placeholder="搜索笔记..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
            />
            {/* 清空按钮 */}
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
              </button>
            )}
          </div>

          {/* Notes Section */}
          <div className="mt-2">
            <button
              className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:bg-accent/50 rounded-md transition-colors"
              onClick={() => setNotesExpanded(!notesExpanded)}
            >
              {/* ✅ 搜索时显示结果数量 */}
              <span>
                {searchQuery
                  ? `搜索结果 (${filteredNotes.length})`
                  : "所有笔记"
                }
              </span>
              <div className="flex items-center gap-1">
                {!searchQuery && (
                  <Plus
                    className="h-3.5 w-3.5 hover:text-foreground cursor-pointer hover:bg-accent rounded-sm p-0.5 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCreateNote()
                    }}
                  />
                )}
                {notesExpanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />
                }
              </div>
            </button>

            {notesExpanded && (
              <div className="mt-1 space-y-0.5">
                {filteredNotes.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                    没有找到相关笔记
                  </p>
                ) : (
                  filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "group relative flex items-center rounded-md transition-colors",
                        activeNoteId === note.id ? "bg-accent" : "hover:bg-accent/50"
                      )}
                    >
                      <Button
                        variant="ghost"
                        className={cn(
                          "w-full justify-start gap-3 text-sm font-normal pr-8",
                          activeNoteId === note.id
                            ? "bg-transparent text-accent-foreground hover:bg-transparent"
                            : "text-muted-foreground hover:text-foreground hover:bg-transparent"
                        )}
                        onClick={() => onNoteSelect(note.id)}
                      >
                        <FileText className="h-4 w-4 flex-shrink-0" />
                        {/* ✅ 搜索时高亮匹配文字 */}
                        {searchQuery ? (
                          <HighlightText text={note.title} query={searchQuery} />
                        ) : (
                          <span className="truncate">{note.title}</span>
                        )}
                      </Button>

                      <button
                        onClick={(e) => onDeleteNote(note.id, e)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive-foreground transition-all"
                        title="删除笔记"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}

              </div>
            )}
          </div>
        </div>
      </ScrollArea>


      <div className="border-t border-border p-2">
        <SettingsDialog />
      </div>
    </div>
  )
}

// ✅ 高亮匹配文字的小组件
function HighlightText({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span className="truncate">{text}</span>

  return (
    <span className="truncate">
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </span>
  )
}