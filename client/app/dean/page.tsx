"use client";

import { useEffect, useState, lazy, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

const DeanAnalyticsDashboard = lazy(() => import("@/app/_components/Dean/DeanAnalyticsDashboard"));

type DeanTab = "pending" | "reviewed" | "analytics";

interface ApprovalStage {
  step: number;
  role: string;
  label: string;
  status: string;
  blocking: boolean;
  approved_by: string | null;
}

interface QueueItem {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  item_title: string;
  item_date: string | null;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  created_at: string;
  stages: ApprovalStage[];
  _queue_role: string;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const safeLower = (value: unknown): string => safeText(value, "").toLowerCase();

function timeAgo(dateStr: string) {
  const normalized = /[Zz]$|[+-]\d{2}:\d{2}$/.test(dateStr) ? dateStr : dateStr + "Z";
  const ms = Date.now() - new Date(normalized).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

function deanStatus(item: QueueItem) {
  return safeLower(item.stages?.find((s) => s.role === "dean")?.status) || "pending";
}

function deanActedBy(item: QueueItem): string | null {
  return safeText(item.stages?.find((s) => s.role === "dean")?.approved_by, "") || null;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:  { label: "Pending Review", dot: "bg-[#154CB3]", badge: "bg-blue-50 text-blue-700" },
  approved: { label: "Approved",       dot: "bg-green-500", badge: "bg-green-50 text-green-700" },
  rejected: { label: "Returned",       dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function DeanDashboardPage() {
  return (
    <Suspense>
      <DeanDashboard />
    </Suspense>
  );
}

function DeanDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [activeTab, setActiveTab] = useState<DeanTab>(
    (searchParams.get("tab") as DeanTab) || "pending"
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ itemId: string } | null>(null);
  const [returnNote, setReturnNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const DEAN_PAGE_SIZE = 8;

  function switchTab(tab: DeanTab) {
    setActiveTab(tab);
    setPage(1);
    setSearchQuery("");
    setExpanded(null);
    const p = new URLSearchParams(searchParams?.toString() || "");
    if (tab === "pending") p.delete("tab");
    else p.set("tab", tab);
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : pathname, { scroll: false });
  }

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    if (userData && !(userData as any).is_dean && !(userData as any).is_masteradmin) {
      router.replace("/error"); return;
    }
  }, [isLoading, session, userData]); // eslint-disable-line

  useEffect(() => {
    if (session && !isLoading) void fetchQueue();
  }, [session]); // eslint-disable-line

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/queue`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      const queueItems = Array.isArray(data?.queue) ? data.queue : [];
      const normalized: QueueItem[] = queueItems.map((q: any) => ({
        id: safeText(q?.id),
        event_or_fest_id: safeText(q?.event_or_fest_id),
        type: safeLower(q?.type) === "fest" ? "fest" : "event",
        item_title: safeText(q?.item_title, "Untitled"),
        item_date: safeText(q?.item_date, "") || null,
        organizing_department_snapshot: safeText(q?.organizing_department_snapshot, "") || null,
        organizing_school_snapshot: safeText(q?.organizing_school_snapshot, "") || null,
        created_at: safeText(q?.created_at, new Date().toISOString()),
        stages: Array.isArray(q?.stages)
          ? q.stages.map((s: any) => ({
              step: Number(s?.step ?? 0),
              role: safeText(s?.role),
              label: safeText(s?.label),
              status: safeText(s?.status, "pending"),
              blocking: Boolean(s?.blocking),
              approved_by: safeText(s?.approved_by, "") || null,
            }))
          : [],
        _queue_role: safeLower(q?._queue_role),
      }));
      setQueue(
        normalized
          .filter((q) => q._queue_role === "dean")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(item: QueueItem, action: "approve" | "reject", note?: string) {
    setActionItemId(item.event_or_fest_id);
    try {
      const deanStage = item.stages?.find((s) => s.role === "dean");
      const res = await fetch(`${API_URL}/api/approvals/${item.event_or_fest_id}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step_index: deanStage?.step ?? 1,
          action,
          note: note || null,
          type: item.type,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(action === "approve" ? "Approved successfully" : "Returned to organiser");
      setExpanded(null);
      setReturnNote("");
      void fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActionItemId(null);
    }
  }

  const campus = (userData as any)?.campus;
  const pendingItems = queue.filter((q) => deanStatus(q) === "pending");
  const reviewedItems = queue.filter((q) => deanStatus(q) !== "pending");
  const visible = activeTab === "reviewed" ? reviewedItems : pendingItems;

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? visible.filter((r) =>
        r.item_title.toLowerCase().includes(q) ||
        (r.organizing_department_snapshot || "").toLowerCase().includes(q) ||
        (r.organizing_school_snapshot || "").toLowerCase().includes(q) ||
        r.type.includes(q)
      )
    : visible;
  const totalPages = Math.max(1, Math.ceil(filtered.length / DEAN_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * DEAN_PAGE_SIZE, safePage * DEAN_PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#faf8ff]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#154CB3] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0f2a6b] leading-none">Dean Approvals</h1>
              {campus && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">{campus}</p>
              )}
            </div>
          </div>

          {activeTab !== "analytics" && (
            <button
              onClick={() => void fetchQueue()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Stats row ── */}
        {!loading && activeTab !== "analytics" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total",    count: queue.length,                                                        color: "text-slate-700",  bg: "bg-white" },
              { label: "Pending",  count: pendingItems.length,                                                 color: "text-[#154CB3]",  bg: "bg-blue-50" },
              { label: "Approved", count: reviewedItems.filter((r) => deanStatus(r) === "approved").length,   color: "text-green-700",  bg: "bg-green-50" },
              { label: "Returned", count: reviewedItems.filter((r) => deanStatus(r) === "rejected").length,   color: "text-amber-700",  bg: "bg-amber-50" },
            ].map((s) => (
              <div key={s.label} className={`${s.bg} border border-slate-200 rounded-xl px-4 py-3`}>
                <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-400">Loading approvals…</p>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && (
          <>
            {/* Tabs + Search */}
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 mb-7">
              <div className="flex items-center gap-8">
                {(["pending", "reviewed", "analytics"] as DeanTab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => switchTab(tab)}
                    className={`pb-3 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-[#154CB3] text-[#154CB3]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>{tab === "pending" ? "Pending" : tab === "reviewed" ? "Reviewed" : "Analytics"}</span>
                    {tab !== "analytics" && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        activeTab === tab ? "bg-[#154CB3] text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        {tab === "pending" ? pendingItems.length : reviewedItems.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Search (queue tabs only) */}
              {activeTab !== "analytics" && (
                <div className="relative mb-3">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                    placeholder="Search by title, dept, school…"
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#154CB3]/25 focus:border-[#154CB3] w-56 transition-all"
                  />
                </div>
              )}
            </div>

            {/* ── Analytics view ── */}
            {activeTab === "analytics" && (
              <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-24 gap-3">
                  <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-slate-400">Loading analytics…</p>
                </div>
              }>
                <DeanAnalyticsDashboard />
              </Suspense>
            )}

            {/* ── Queue view ── */}
            {activeTab !== "analytics" && (
              <>
                {/* Empty state */}
                {filtered.length === 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-slate-700 font-semibold text-sm">
                      {activeTab === "pending" ? "No pending approvals" : "No reviewed items yet"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {q
                        ? `No results for "${searchQuery}". Try a different keyword.`
                        : activeTab === "pending"
                        ? "All caught up! Check the Reviewed tab for past decisions."
                        : "Items you approve or return will appear here."}
                    </p>
                  </div>
                )}

                {/* Cards */}
                {filtered.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                      {filtered.length} item{filtered.length !== 1 ? "s" : ""}{q ? ` matching "${searchQuery}"` : " · most recent first"}
                    </p>

                    {pageItems.map((item) => {
                      const status = deanStatus(item);
                      const isPending = status === "pending";
                      const actedBy = status !== "pending" ? deanActedBy(item) : null;
                      const isExpanded = expanded?.itemId === item.event_or_fest_id;

                      const hodStage = item.stages?.find((s) => s.role === "hod");
                      const hodCleared = hodStage && (hodStage.status === "approved" || hodStage.status === "skipped");

                      return (
                        <div
                          key={item.id}
                          className={`bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border transition-all p-6 ${
                            isExpanded ? "border-amber-200" : "border-slate-200 hover:border-[#154CB3]/30"
                          }`}
                        >
                          {/* Card header */}
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <Link
                                  href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                                  className="text-lg font-semibold text-[#154CB3] hover:underline leading-tight"
                                >
                                  {item.item_title}
                                </Link>
                                <span className="px-2 py-0.5 text-[10px] bg-slate-100 text-slate-600 rounded-full font-semibold uppercase tracking-wide">
                                  {item.type}
                                </span>
                                {hodCleared && (
                                  <span className="px-2 py-0.5 text-[10px] bg-green-50 text-green-700 rounded-full font-semibold">
                                    HOD {hodStage!.status}{hodStage!.approved_by ? ` · ${safeText(hodStage!.approved_by)}` : ""}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                {item.organizing_school_snapshot && (
                                  <span className="flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                                    </svg>
                                    {item.organizing_school_snapshot}
                                  </span>
                                )}
                                {item.organizing_department_snapshot && (
                                  <span>{item.organizing_department_snapshot}</span>
                                )}
                              </div>
                              {actedBy && (
                                <p className="text-xs text-slate-400 mt-1">
                                  {status === "approved" ? "Approved" : "Returned"} by{" "}
                                  <span className="font-medium text-slate-600">{actedBy}</span>
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                              <StatusBadge status={status} />
                              <p className="text-[11px] text-slate-400">{timeAgo(item.created_at)}</p>
                            </div>
                          </div>

                          {/* Expanded: Return panel */}
                          {isExpanded && (
                            <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-4 space-y-3 mb-4">
                              <p className="text-sm font-semibold text-amber-700">Return to Organiser</p>
                              <textarea
                                rows={3}
                                value={returnNote}
                                onChange={(e) => setReturnNote(e.target.value)}
                                placeholder="Describe what needs to be changed or clarified (required)"
                                className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => { setExpanded(null); setReturnNote(""); }}
                                  disabled={actionItemId === item.event_or_fest_id}
                                  className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => void handleAction(item, "reject", returnNote)}
                                  disabled={actionItemId === item.event_or_fest_id || !returnNote.trim()}
                                  className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  {actionItemId === item.event_or_fest_id ? "Sending…" : "Send Return"}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Action buttons — pending, not expanded */}
                          {isPending && !isExpanded && (
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <Link
                                href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                                className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                View
                              </Link>
                              <button
                                onClick={() => { setExpanded({ itemId: item.event_or_fest_id }); setReturnNote(""); }}
                                disabled={actionItemId === item.event_or_fest_id}
                                className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-amber-200 text-amber-600 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                Return
                              </button>
                              <button
                                onClick={() => void handleAction(item, "approve")}
                                disabled={actionItemId === item.event_or_fest_id}
                                className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3a8f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                              >
                                {actionItemId === item.event_or_fest_id ? "Approving…" : "Approve"}
                              </button>
                            </div>
                          )}

                          {/* Reviewed: View only */}
                          {!isPending && (
                            <div className="flex items-center justify-end">
                              <Link
                                href={`/approvals/${item.event_or_fest_id}?type=${item.type}`}
                                className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                              >
                                View
                              </Link>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 pb-2">
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={safePage <= 1}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                          Prev
                        </button>
                        <span className="text-xs text-slate-500">Page {safePage} of {totalPages}</span>
                        <button
                          type="button"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safePage >= totalPages}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          Next
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
