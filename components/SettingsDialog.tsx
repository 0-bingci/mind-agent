"use client"

import { useState, useEffect } from "react"
import { Settings, Sun, Moon, Monitor, Check } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

// ─── 常量 ───────────────────────────────
const THEMES = [
  { value: "light",  label: "浅色", icon: Sun },
  { value: "dark",   label: "深色", icon: Moon },
  { value: "system", label: "跟随系统", icon: Monitor },
] as const

const LANGUAGES = [
  { value: "zh-CN", label: "简体中文", flag: "🇨🇳" },
  { value: "zh-TW", label: "繁體中文", flag: "🇹🇼" },
  { value: "en-US", label: "English",  flag: "🇺🇸" },
  { value: "ja-JP", label: "日本語",   flag: "🇯🇵" },
] as const

const LANGUAGE_KEY = "preferred-language"

// ─── 组件 ───────────────────────────────
export function SettingsDialog() {
  const { theme, setTheme } = useTheme()
  const [language, setLanguage] = useState("zh-CN")
  const [mounted, setMounted] = useState(false)

  // 避免 SSR 水合不一致
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (saved) setLanguage(saved)
  }, [])

  const handleLanguageChange = (value: string) => {
    setLanguage(value)
    localStorage.setItem(LANGUAGE_KEY, value)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent"
        >
          <Settings className="h-4 w-4" />
          <span>设置</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">设置</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">

          {/* ── 主题 ── */}
          <section>
            <h3 className="text-sm font-medium text-foreground mb-3">外观主题</h3>
            <div className="grid grid-cols-3 gap-2">
              {THEMES.map(({ value, label, icon: Icon }) => {
                const active = mounted && theme === value
                return (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-all",
                      active
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:bg-accent"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs">{label}</span>
                    {active && <Check className="h-3 w-3 text-primary" />}
                  </button>
                )
              })}
            </div>
          </section>

          <div className="border-t border-border" />

          {/* ── 语言 ── */}
          <section>
            <h3 className="text-sm font-medium text-foreground mb-3">界面语言</h3>
            <div className="space-y-1.5">
              {LANGUAGES.map(({ value, label, flag }) => {
                const active = language === value
                return (
                  <button
                    key={value}
                    onClick={() => handleLanguageChange(value)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all",
                      active
                        ? "bg-primary/5 text-primary border border-primary/30"
                        : "text-muted-foreground hover:bg-accent border border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{flag}</span>
                      <span>{label}</span>
                    </div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              * 语言偏好仅影响界面显示，笔记内容不受影响
            </p>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  )
}