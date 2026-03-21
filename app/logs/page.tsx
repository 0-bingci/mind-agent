"use client";

import { useEffect, useState } from "react";
import { getLogs, getLogsStats, getLogDetail } from "@/app/actions/logs";
import { generatePromptSuggestion, savePrompt, getActivePrompt } from "@/app/actions/prompt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Clock,
  Zap,
  AlertCircle,
  MessageSquare,
  Wrench,
  Brain,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronRight as ChevronRightIcon,
  Loader2,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  GitBranch,
  Sparkles,
  Save,
  X,
} from "lucide-react";
import Link from "next/link";

type LogEntry = Awaited<ReturnType<typeof getLogs>>["logs"][number];
type LogDetail = Awaited<ReturnType<typeof getLogDetail>>;
type Stats = Awaited<ReturnType<typeof getLogsStats>>;
type SpanData = NonNullable<LogDetail>["spans"][number];

// --- Span 树构建 ---
interface SpanTreeNode extends SpanData {
  children: SpanTreeNode[];
}

function buildSpanTree(spans: SpanData[]): SpanTreeNode[] {
  const map = new Map<string, SpanTreeNode>();
  spans.forEach((s) => map.set(s.runId, { ...s, children: [] }));

  const roots: SpanTreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentRunId && map.has(node.parentRunId)) {
      map.get(node.parentRunId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// --- 工具函数 ---
function formatDuration(ms: number | null) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(date: Date | null) {
  if (!date) return "-";
  return new Date(date).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function spanIcon(type: string) {
  switch (type) {
    case "llm": return <Brain className="h-3.5 w-3.5 text-blue-500" />;
    case "tool": return <Wrench className="h-3.5 w-3.5 text-amber-500" />;
    default: return <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function spanColor(type: string) {
  switch (type) {
    case "llm": return "bg-blue-500";
    case "tool": return "bg-amber-500";
    default: return "bg-muted-foreground";
  }
}

// --- 统计卡片 ---
function StatsCards({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            总调用
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{stats.totalCalls}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Zap className="h-4 w-4" />
            Token 消耗
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{Number(stats.totalTokens).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            In: {Number(stats.totalPromptTokens).toLocaleString()} / Out: {Number(stats.totalCompletionTokens).toLocaleString()}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            平均耗时
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatDuration(Math.round(Number(stats.avgDurationMs)))}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" />
            错误
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-destructive">{stats.errorCount}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <ThumbsUp className="h-4 w-4" />
            反馈
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-500 font-bold">
              <ThumbsUp className="h-3.5 w-3.5" /> {(stats as any).thumbsUp ?? 0}
            </span>
            <span className="flex items-center gap-1 text-red-500 font-bold">
              <ThumbsDown className="h-3.5 w-3.5" /> {(stats as any).thumbsDown ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// --- Span 树节点 ---
function SpanNode({
  node,
  depth,
  traceStart,
  traceDuration,
}: {
  node: SpanTreeNode;
  depth: number;
  traceStart: number;
  traceDuration: number;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const hasContent = node.input || node.output;

  // 瀑布图位置计算
  const spanStart = new Date(node.startedAt).getTime();
  const spanDuration = node.durationMs ?? 0;
  const offsetPercent = traceDuration > 0 ? ((spanStart - traceStart) / traceDuration) * 100 : 0;
  const widthPercent = traceDuration > 0 ? Math.max((spanDuration / traceDuration) * 100, 1) : 100;

  return (
    <div className="min-w-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
            style={{ paddingLeft: `${depth * 20 + 8}px` }}
          >
            {/* 展开/折叠图标 */}
            <span className="w-4 h-4 flex items-center justify-center shrink-0">
              {hasContent || hasChildren ? (
                open ? <ChevronDown className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />
              ) : null}
            </span>

            {/* 类型图标 + 名称 */}
            {spanIcon(node.type)}
            <Badge variant="secondary" className="text-xs font-mono shrink-0">
              {node.name}
            </Badge>

            {/* Token 信息 (LLM only) */}
            {node.type === "llm" && (node.promptTokens || node.completionTokens) && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {node.promptTokens ?? 0} → {node.completionTokens ?? 0} tok
              </span>
            )}

            {/* 瀑布条 */}
            <div className="flex-1 min-w-0 h-5 relative mx-2">
              <div className="absolute inset-0 bg-muted/30 rounded-full" />
              <div
                className={`absolute top-0 h-full rounded-full ${spanColor(node.type)} opacity-60`}
                style={{
                  left: `${Math.min(offsetPercent, 99)}%`,
                  width: `${Math.min(widthPercent, 100 - offsetPercent)}%`,
                }}
              />
            </div>

            {/* 耗时 */}
            <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-16 text-right">
              {formatDuration(node.durationMs)}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div
            className="space-y-2 pb-2"
            style={{ paddingLeft: `${depth * 20 + 36}px` }}
          >
            {/* LLM Input: 显示输入 messages */}
            {node.type === "llm" && node.input && (
              <div className="rounded-md border bg-blue-500/5 p-3 text-xs space-y-1.5">
                <p className="font-semibold text-blue-600 text-[10px] uppercase tracking-wider">LLM Input Messages</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {(Array.isArray(node.input) ? node.input : []).map((msg: any, i: number) => (
                    <div key={i} className="flex gap-2">
                      <Badge variant="outline" className="text-[10px] shrink-0 h-5">
                        {msg.role || "?"}
                      </Badge>
                      <p className="text-muted-foreground break-words line-clamp-4">
                        {typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LLM Output */}
            {node.type === "llm" && node.output && (
              <div className="rounded-md border bg-blue-500/5 p-3 text-xs">
                <p className="font-semibold text-blue-600 text-[10px] uppercase tracking-wider mb-1">LLM Output</p>
                <p className="text-muted-foreground break-words line-clamp-6 whitespace-pre-wrap">
                  {typeof node.output === "string" ? node.output : JSON.stringify(node.output)}
                </p>
              </div>
            )}

            {/* Tool Input/Output */}
            {node.type === "tool" && (
              <>
                {node.input && (
                  <div className="rounded-md border bg-amber-500/5 p-3 text-xs">
                    <p className="font-semibold text-amber-600 text-[10px] uppercase tracking-wider mb-1">Tool Input</p>
                    <pre className="text-muted-foreground break-words whitespace-pre-wrap">
                      {typeof node.input === "string" ? node.input : JSON.stringify(node.input, null, 2)}
                    </pre>
                  </div>
                )}
                {node.output && (
                  <div className="rounded-md border bg-amber-500/5 p-3 text-xs">
                    <p className="font-semibold text-amber-600 text-[10px] uppercase tracking-wider mb-1">Tool Output</p>
                    <p className="text-muted-foreground break-words line-clamp-6 whitespace-pre-wrap">
                      {typeof node.output === "string" ? node.output : JSON.stringify(node.output)}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* 子节点 */}
            {hasChildren && node.children.map((child) => (
              <SpanNode
                key={child.runId}
                node={child}
                depth={depth + 1}
                traceStart={traceStart}
                traceDuration={traceDuration}
              />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// --- 详情弹窗 ---
function LogDetailDialog({
  logId,
  open,
  onClose,
}: {
  logId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<LogDetail>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!logId || !open) return;
    setLoading(true);
    getLogDetail(logId).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [logId, open]);

  // 计算 trace 时间范围
  const spans = detail?.spans ?? [];
  const traceStart = spans.length > 0
    ? Math.min(...spans.map((s) => new Date(s.startedAt).getTime()))
    : 0;
  const traceEnd = spans.length > 0
    ? Math.max(...spans.map((s) => new Date(s.endedAt ?? s.startedAt).getTime()))
    : 0;
  const traceDuration = traceEnd - traceStart;
  const spanTree = buildSpanTree(spans);

  // 兼容旧数据：无 spans 时 fallback 到 toolCalls
  const legacyToolCalls = detail?.toolCalls as any[] | null;
  const hasSpans = spans.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            调用详情
            {detail?.feedback && (
              <span className="flex items-center gap-1 text-sm font-normal">
                {detail.feedback.rating === "up" ? (
                  <ThumbsUp className="h-4 w-4 text-emerald-500" />
                ) : (
                  <ThumbsDown className="h-4 w-4 text-red-500" />
                )}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-6 w-6" />
          </div>
        ) : detail ? (
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-4">
              {/* 基本信息 */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={detail.status === "success" ? "default" : "destructive"}>
                  {detail.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatTime(detail.createdAt)}
                </span>
                {detail.sessionTitle && (
                  <Badge variant="outline">{detail.sessionTitle}</Badge>
                )}
              </div>

              {/* Token 和耗时 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Prompt Tokens</p>
                  <p className="text-lg font-semibold">{detail.promptTokens ?? 0}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">Completion Tokens</p>
                  <p className="text-lg font-semibold">{detail.completionTokens ?? 0}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-xs text-muted-foreground">耗时</p>
                  <p className="text-lg font-semibold">{formatDuration(detail.durationMs)}</p>
                </div>
              </div>

              <Separator />

              {/* 用户输入 */}
              <div>
                <h4 className="text-sm font-medium mb-1">用户输入</h4>
                <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap">
                  {detail.userInput}
                </div>
              </div>

              <Separator />

              {/* Trace 链路 */}
              {hasSpans ? (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <GitBranch className="h-4 w-4" />
                    Trace 链路 ({spans.length} spans)
                  </h4>
                  {/* 图例 */}
                  <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> LLM
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Tool
                    </span>
                    <span className="text-[10px]">
                      总时长: {formatDuration(traceDuration)}
                    </span>
                  </div>
                  {/* Span 树 */}
                  <div className="rounded-lg border divide-y">
                    {spanTree.map((node) => (
                      <SpanNode
                        key={node.runId}
                        node={node}
                        depth={0}
                        traceStart={traceStart}
                        traceDuration={traceDuration}
                      />
                    ))}
                  </div>
                </div>
              ) : legacyToolCalls && legacyToolCalls.length > 0 ? (
                /* Fallback: 旧数据的扁平工具调用列表 */
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                    <Wrench className="h-4 w-4" />
                    工具调用 ({legacyToolCalls.length})
                  </h4>
                  <div className="space-y-2">
                    {legacyToolCalls.map((tc: any, i: number) => (
                      <div key={i} className="rounded-md border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="secondary">{tc.name}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(tc.durationMs)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          输入: {JSON.stringify(tc.input)}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          输出: {tc.output}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <Separator />

              {/* Agent 输出 */}
              <div>
                <h4 className="text-sm font-medium mb-1">Agent 输出</h4>
                <div className="rounded-md bg-muted p-3 text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                  {detail.agentOutput || "(空)"}
                </div>
              </div>

              {/* 错误信息 */}
              {detail.errorMessage && (
                <div>
                  <h4 className="text-sm font-medium mb-1 text-destructive">错误信息</h4>
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">
                    {detail.errorMessage}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground py-8 text-center">未找到日志</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Prompt 优化对比弹窗 ---
function PromptOptimizeDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<"idle" | "generating" | "comparing" | "saving">("idle");
  const [currentPrompt, setCurrentPrompt] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [editedPrompt, setEditedPrompt] = useState("");
  const [feedbackSummary, setFeedbackSummary] = useState("");
  const [feedbackCount, setFeedbackCount] = useState({ up: 0, down: 0 });
  const [description, setDescription] = useState("");

  const handleGenerate = async () => {
    setStep("generating");
    try {
      const result = await generatePromptSuggestion();
      setCurrentPrompt(result.currentPrompt);
      setSuggestion(result.suggestion);
      setEditedPrompt(result.suggestion);
      setFeedbackSummary(result.feedbackSummary);
      setFeedbackCount(result.feedbackCount);
      setDescription(`基于 ${result.feedbackCount.down} 条负反馈 + ${result.feedbackCount.up} 条正反馈优化`);
      setStep("comparing");
    } catch (err) {
      console.error("生成建议失败:", err);
      setStep("idle");
    }
  };

  const handleSave = async () => {
    setStep("saving");
    try {
      await savePrompt(editedPrompt, description, "ai_suggestion");
      onClose();
      setStep("idle");
    } catch (err) {
      console.error("保存失败:", err);
      setStep("comparing");
    }
  };

  const handleReset = () => {
    setStep("idle");
    setCurrentPrompt("");
    setSuggestion("");
    setEditedPrompt("");
  };

  // 打开时重置状态
  useEffect(() => {
    if (open) handleReset();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Prompt 优化工作台
          </DialogTitle>
        </DialogHeader>

        {step === "idle" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              根据用户反馈（👍👎）分析 Agent 的表现，由 AI 生成优化建议。
              你可以在对比后编辑并决定是否采纳。
            </p>
            <Button onClick={handleGenerate} size="lg">
              <Sparkles className="h-4 w-4 mr-2" />
              开始分析反馈并生成建议
            </Button>
          </div>
        )}

        {step === "generating" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">正在分析反馈数据并生成优化建议...</p>
          </div>
        )}

        {(step === "comparing" || step === "saving") && (
          <div className="space-y-4">
            {/* 反馈概况 */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">参考反馈:</span>
              <span className="flex items-center gap-1 text-red-500">
                <ThumbsDown className="h-3.5 w-3.5" /> {feedbackCount.down} 条负反馈
              </span>
              <span className="flex items-center gap-1 text-emerald-500">
                <ThumbsUp className="h-3.5 w-3.5" /> {feedbackCount.up} 条正反馈
              </span>
            </div>

            {/* 左右对比 */}
            <div className="grid grid-cols-2 gap-4 min-h-0">
              {/* 左: 当前版本 (只读) */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Badge variant="outline">当前版本</Badge>
                  </h4>
                </div>
                <ScrollArea className="flex-1 max-h-[50vh]">
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 font-mono">
                    {currentPrompt}
                  </pre>
                </ScrollArea>
              </div>

              {/* 右: 建议版本 (可编辑) */}
              <div className="flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium flex items-center gap-1.5">
                    <Badge className="bg-primary">建议版本</Badge>
                    <span className="text-xs text-muted-foreground">可编辑</span>
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => setEditedPrompt(suggestion)}
                  >
                    重置为 AI 建议
                  </Button>
                </div>
                <textarea
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="flex-1 max-h-[50vh] text-xs leading-relaxed whitespace-pre-wrap rounded-lg border bg-background p-4 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* 版本说明 */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">版本说明</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="描述这次修改的内容..."
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-1.5" />
                取消
              </Button>
              <Button variant="outline" onClick={handleGenerate}>
                <RotateCw className="h-4 w-4 mr-1.5" />
                重新生成
              </Button>
              <Button
                onClick={handleSave}
                disabled={step === "saving" || !editedPrompt.trim()}
              >
                {step === "saving" ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                保存并激活
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- 主页面 ---
export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [showPromptOptimize, setShowPromptOptimize] = useState(false);

  const loadData = async (p = page) => {
    setLoading(true);
    const [logsData, statsData] = await Promise.all([getLogs(p), getLogsStats()]);
    setLogs(logsData.logs);
    setTotalPages(logsData.totalPages);
    setStats(statsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [page]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* 顶部导航 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/workspace">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">Agent 调用日志</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => setShowPromptOptimize(true)}>
              <Sparkles className="h-4 w-4 mr-1.5" />
              Prompt 优化
            </Button>
            <Button variant="outline" size="sm" onClick={() => loadData(page)}>
              <RotateCw className="h-4 w-4 mr-1.5" />
              刷新
            </Button>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && <StatsCards stats={stats} />}

        {/* 日志表格 */}
        <Card className="mt-6">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin h-6 w-6" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                暂无调用日志
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">时间</TableHead>
                    <TableHead>会话</TableHead>
                    <TableHead>用户输入</TableHead>
                    <TableHead className="w-[80px] text-right">Tokens</TableHead>
                    <TableHead className="w-[80px] text-right">耗时</TableHead>
                    <TableHead className="w-[70px]">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedLogId(log.id)}
                    >
                      <TableCell className="text-sm text-muted-foreground">
                        {formatTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate text-sm">
                        {log.sessionTitle ?? "-"}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate text-sm">
                        {log.userInput}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {log.totalTokens ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatDuration(log.durationMs)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={log.status === "success" ? "default" : "destructive"}
                          className="text-xs"
                        >
                          {log.status === "success" ? "OK" : "ERR"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      <LogDetailDialog
        logId={selectedLogId}
        open={!!selectedLogId}
        onClose={() => setSelectedLogId(null)}
      />

      {/* Prompt 优化弹窗 */}
      <PromptOptimizeDialog
        open={showPromptOptimize}
        onClose={() => setShowPromptOptimize(false)}
      />
    </div>
  );
}
