"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface StallDescription {
  notes?: string;
  hardboard_stalls?: number;
  canopy_stalls?: number;
}

interface StallBooking {
  stall_id: string;
  description: StallDescription | null;
  requested_by: string;
  campus: string | null;
  event_fest_id: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  event_title?: string | null;
  event_date?: string | null;
  fest_title?: string | null;
  fest_date?: string | null;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

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

function formatStatusLabel(value: unknown, fallback = "Unknown"): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const STATUS_CONFIG: Record<string, { dot: string; badge: string }> = {
  pending:  { dot: "bg-[#154CB3]", badge: "bg-blue-50 text-blue-700" },
  accepted: { dot: "bg-green-500", badge: "bg-green-50 text-green-700" },
  declined: { dot: "bg-red-500",   badge: "bg-red-50 text-red-700" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {formatStatusLabel(status)}
    </span>
  );
}

type StallsTab = "pending" | "reviewed";

export default function StallsDashboardPage() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<StallsTab>("pending");
  const [pendingList, setPendingList] = useState<StallBooking[]>([]);
  const [reviewedList, setReviewedList] = useState<StallBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<{ id: string } | null>(null);
  const [declineNote, setDeclineNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 8;

  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData) {
      const isStalls = Boolean((userData as any)?.is_stalls);
      const isMasterAdmin = Boolean((userData as any)?.is_masteradmin);
      if (!isStalls && !isMasterAdmin) router.replace("/error");
    }
  }, [authLoading, session, userData, router]);

  const fetchQueue = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/queue`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load queue");
      setPendingList(json.pending || []);
      setReviewedList(json.reviewed || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) void fetchQueue();
  }, [session, fetchQueue]);

  const handleAction = async (id: string, action: "accept" | "decline", note?: string) => {
    if (!session) return;
    setActionLoading(id);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/${id}/action`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      const updated = json.booking as StallBooking;
      setPendingList(prev => prev.filter(b => b.stall_id !== id));
      setReviewedList(prev => [updated, ...prev]);
      setExpanded(null);
      setDeclineNote("");
      toast.success(action === "accept" ? "Booking accepted" : "Booking declined");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const campus = (userData as any)?.campus;
  const visible = activeTab === "pending" ? pendingList : reviewedList;

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? visible.filter(b =>
        (b.description?.notes || "").toLowerCase().includes(q) ||
        (b.requested_by || "").toLowerCase().includes(q) ||
        (b.campus || "").toLowerCase().includes(q) ||
        (b.event_title || b.fest_title || "").toLowerCase().includes(q)
      )
    : visible;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#faf8ff]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#154CB3] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0f2a6b] leading-none">Stall Requests</h1>
              {campus && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">{campus}</p>
              )}
            </div>
          </div>
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
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Stats row ── */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total",    count: pendingList.length + reviewedList.length,                    color: "text-slate-700",  bg: "bg-white" },
              { label: "Pending",  count: pendingList.length,                                          color: "text-[#154CB3]",  bg: "bg-blue-50" },
              { label: "Accepted", count: reviewedList.filter(b => b.status === "accepted").length,    color: "text-green-700",  bg: "bg-green-50" },
              { label: "Declined", count: reviewedList.filter(b => b.status === "declined").length,    color: "text-red-700",    bg: "bg-red-50" },
            ].map(s => (
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
            <p className="text-sm text-slate-400">Loading stall requests…</p>
          </div>
        )}

        {/* ── Content ── */}
        {!loading && (
          <>
            {/* Tabs + Search */}
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 mb-7">
              <div className="flex items-center gap-8">
                {(["pending", "reviewed"] as StallsTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setPage(1); setSearchQuery(""); setExpanded(null); }}
                    className={`pb-3 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-[#154CB3] text-[#154CB3]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span>{tab === "pending" ? "Pending" : "Reviewed"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === tab ? "bg-[#154CB3] text-white" : "bg-slate-200 text-slate-500"
                    }`}>
                      {tab === "pending" ? pendingList.length : reviewedList.length}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mb-3">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                  placeholder="Search requester, campus, event"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#154CB3]/25 focus:border-[#154CB3] w-56 transition-all"
                />
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold text-sm">
                  {activeTab === "pending" ? "No pending requests" : "No reviewed requests yet"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {q
                    ? `No results for "${searchQuery}". Try a different keyword.`
                    : activeTab === "pending"
                    ? "All caught up."
                    : "Accepted and declined requests appear here."}
                </p>
              </div>
            )}

            {/* Cards */}
            {filtered.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {filtered.length} request{filtered.length !== 1 ? "s" : ""}{q ? ` matching "${searchQuery}"` : " · most recent first"}
                </p>

                {pageItems.map(b => {
                  const desc = b.description || {};
                  const linkedTitle = b.event_title || b.fest_title;
                  const linkedDate = b.event_date || b.fest_date;
                  const isPending = b.status === "pending";
                  const isExpanded = expanded?.id === b.stall_id;

                  return (
                    <div
                      key={b.stall_id}
                      className={`bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border transition-all p-6 ${
                        isExpanded ? "border-red-200" : "border-slate-200 hover:border-[#154CB3]/30"
                      }`}
                    >
                      {/* Card header */}
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="min-w-0 flex-1">
                          {desc.notes && (
                            <p className="text-base font-semibold text-slate-900 leading-snug mb-1.5">
                              {desc.notes}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            {b.campus && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
                                </svg>
                                {b.campus}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                              {b.requested_by}
                            </span>
                            {linkedTitle && (
                              <span className="flex items-center gap-1 text-[#154CB3] font-medium">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                                {linkedTitle}{linkedDate && ` · ${formatDate(linkedDate)}`}
                              </span>
                            )}
                          </div>

                          {/* Stall count pills */}
                          {((desc.hardboard_stalls ?? 0) > 0 || (desc.canopy_stalls ?? 0) > 0) && (
                            <div className="flex gap-2 mt-2.5">
                              {(desc.hardboard_stalls ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
                                  Hard Board · <strong className="text-slate-800">{desc.hardboard_stalls}</strong>
                                </span>
                              )}
                              {(desc.canopy_stalls ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full">
                                  Canopy · <strong className="text-slate-800">{desc.canopy_stalls}</strong>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <StatusBadge status={b.status} />
                          <p className="text-[11px] text-slate-400">{timeAgo(b.created_at)}</p>
                        </div>
                      </div>

                      {/* Expanded: Decline panel */}
                      {isExpanded && (
                        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-4 space-y-3 mb-4">
                          <p className="text-sm font-semibold text-red-700">Decline this request?</p>
                          <textarea
                            rows={3}
                            value={declineNote}
                            onChange={e => setDeclineNote(e.target.value)}
                            placeholder="Optional — add a reason for declining"
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => { setExpanded(null); setDeclineNote(""); }}
                              disabled={actionLoading === b.stall_id}
                              className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => void handleAction(b.stall_id, "decline", declineNote)}
                              disabled={actionLoading === b.stall_id}
                              className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {actionLoading === b.stall_id ? "Declining…" : "Confirm Decline"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Action buttons — pending only */}
                      {isPending && !isExpanded && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => { setExpanded({ id: b.stall_id }); setDeclineNote(""); }}
                            disabled={actionLoading === b.stall_id}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => void handleAction(b.stall_id, "accept")}
                            disabled={actionLoading === b.stall_id}
                            className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3a8f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                          >
                            {actionLoading === b.stall_id ? "Accepting…" : "Accept"}
                          </button>
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
                      onClick={() => setPage(p => Math.max(1, p - 1))}
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
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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
      </div>
    </div>
  );
}
