"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface ITInfo {
  description: string;
  status: "pending" | "approved" | "declined" | "returned_for_revision" | string;
  note?: string | null;
  actioned_by?: string | null;
  actioned_at?: string | null;
}

interface ITRequest {
  event_id: string;
  title: string;
  event_date: string | null;
  venue: string | null;
  campus_hosted_at: string | null;
  it_info: ITInfo;
  organizing_dept: string | null;
  organizing_school: string | null;
  created_by: string | null;
  created_at: string;
  is_draft: boolean | null;
}

const safeText = (value: unknown, fallback = ""): string => {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const r = value as Record<string, unknown>;
    for (const key of ["event_creator", "fest_creator", "email", "name"] as const) {
      const c = r[key];
      if (c != null && typeof c !== "object") {
        const n = safeText(c, "");
        if (n) return n;
      }
    }
  }
  return fallback;
};

type ExpandedState = { eventId: string; type: "decline" | "return" } | null;

function formatDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  pending:               { label: "Pending Review",       dot: "bg-[#154CB3]",   badge: "bg-blue-50 text-blue-700" },
  approved:              { label: "Approved",             dot: "bg-green-500",   badge: "bg-green-50 text-green-700" },
  declined:              { label: "Declined",             dot: "bg-red-500",     badge: "bg-red-50 text-red-700" },
  returned_for_revision: { label: "Returned for Revision",dot: "bg-amber-500",   badge: "bg-amber-50 text-amber-700" },
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

export default function ItDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [requests, setRequests]   = useState<ITRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded]   = useState<ExpandedState>(null);
  const [noteText, setNoteText]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const isIt    = (userData as any)?.is_it_support;
    const isAdmin = (userData as any)?.is_masteradmin;
    if (userData && !isIt && !isAdmin) { router.replace("/error"); return; }
    if (userData) fetchRequests();
  }, [isLoading, session, userData]); // eslint-disable-line

  async function fetchRequests() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/events/it-requests`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load IT requests");
      }
      const data = await res.json();
      // Sort most recent first
      const sorted = (data.requests || []).sort(
        (a: ITRequest, b: ITRequest) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests(sorted);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  function openExpanded(eventId: string, type: "decline" | "return") {
    setExpanded({ eventId, type });
    setNoteText("");
    setActionError(null);
  }

  function closeExpanded() {
    setExpanded(null);
    setNoteText("");
    setActionError(null);
  }

  async function submitAction(
    eventId: string,
    action: "approve" | "reject" | "return_for_revision",
    note?: string
  ) {
    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/api/events/${eventId}/it-action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, note: note || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update request");
      }
      const data = await res.json();
      setRequests(prev =>
        prev.map(r => r.event_id === eventId ? { ...r, it_info: data.it_info } : r)
      );
      closeExpanded();
    } catch (err: any) {
      setActionError(err.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  const IT_PAGE_SIZE = 8;
  const campus  = (userData as any)?.campus;
  const pending  = requests.filter(r => (r.it_info?.status ?? "pending") === "pending");
  const reviewed = requests.filter(r => (r.it_info?.status ?? "pending") !== "pending");
  const visible  = activeTab === "pending" ? pending : reviewed;

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? visible.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.organizing_dept || "").toLowerCase().includes(q) ||
        (r.campus_hosted_at || "").toLowerCase().includes(q) ||
        (r.venue || "").toLowerCase().includes(q) ||
        safeText(r.created_by).toLowerCase().includes(q)
      )
    : visible;
  const totalPages = Math.max(1, Math.ceil(filtered.length / IT_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = filtered.slice((safePage - 1) * IT_PAGE_SIZE, safePage * IT_PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#faf8ff]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#154CB3] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0f2a6b] leading-none">IT Support Dashboard</h1>
              {campus && (
                <p className="text-[11px] text-slate-400 font-medium mt-0.5 uppercase tracking-wider">{campus}</p>
              )}
            </div>
          </div>

          <button
            onClick={fetchRequests}
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
        {!loading && !error && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: "Total",    count: requests.length,  color: "text-slate-700",  bg: "bg-white" },
              { label: "Pending",  count: pending.length,   color: "text-[#154CB3]",  bg: "bg-blue-50" },
              { label: "Approved", count: reviewed.filter(r => r.it_info?.status === "approved").length,   color: "text-green-700", bg: "bg-green-50" },
              { label: "Declined / Returned", count: reviewed.filter(r => r.it_info?.status !== "approved").length, color: "text-red-700", bg: "bg-red-50" },
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
            <p className="text-sm text-slate-400">Loading IT requests…</p>
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* ── Content ── */}
        {!loading && !error && (
          <>
            {/* Tabs + Search */}
            <div className="flex items-end justify-between gap-4 border-b border-slate-200 mb-7">
              <div className="flex items-center gap-8">
                {(["pending", "reviewed"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => { setActiveTab(tab); setPage(1); setSearchQuery(""); }}
                    className={`pb-3 flex items-center gap-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === tab
                        ? "border-[#154CB3] text-[#154CB3]"
                        : "border-transparent text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    <span className="capitalize">{tab === "reviewed" ? "Reviewed" : "Pending"}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      activeTab === tab
                        ? "bg-[#154CB3] text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}>
                      {tab === "pending" ? pending.length : reviewed.length}
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
                  placeholder="Search by event, dept, venue…"
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#154CB3]/25 focus:border-[#154CB3] w-56 transition-all"
                />
              </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold text-sm">
                  {activeTab === "pending" ? "No pending requests" : "No reviewed requests yet"}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {q
                    ? `No results for "${searchQuery}". Try a different keyword.`
                    : activeTab === "pending"
                    ? "All caught up! Check the Reviewed tab for past decisions."
                    : "Requests you approve, decline, or return will appear here."}
                </p>
              </div>
            )}

            {/* Request cards */}
            {filtered.length > 0 && (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {filtered.length} request{filtered.length !== 1 ? "s" : ""}{q ? ` matching "${searchQuery}"` : " · most recent first"}
                </p>

                {pageItems.map((req) => {
                  const status     = req.it_info?.status ?? "pending";
                  const isPending  = status === "pending";
                  const isExpanded = expanded?.eventId === req.event_id;
                  const expandType = isExpanded ? expanded!.type : null;

                  const cardBorder = isExpanded && expandType === "decline"
                    ? "border-red-200"
                    : isExpanded && expandType === "return"
                      ? "border-amber-200"
                      : "border-slate-200 hover:border-[#154CB3]/30";

                  return (
                    <div
                      key={req.event_id}
                      className={`bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border ${cardBorder} p-6 transition-all`}
                    >
                      {/* ── Card header ── */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <Link
                              href={`/event/${req.event_id}`}
                              className="text-lg font-semibold text-[#154CB3] hover:underline leading-tight"
                            >
                              {req.title}
                            </Link>
                            {req.is_draft && (
                              <span className="px-2 py-0.5 text-[10px] bg-yellow-100 text-yellow-700 rounded-full font-semibold uppercase tracking-wide">
                                Draft
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            {req.event_date && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {formatDate(req.event_date)}
                              </span>
                            )}
                            {req.venue && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                {req.venue}
                              </span>
                            )}
                            {req.campus_hosted_at && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                {req.campus_hosted_at}
                              </span>
                            )}
                            {(req.organizing_dept || req.organizing_school) && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                                {req.organizing_dept || req.organizing_school}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Top-right: status badge + timestamp */}
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <StatusBadge status={status} />
                          <p className="text-[11px] text-slate-400">{timeAgo(req.created_at)}</p>
                          {safeText(req.created_by) && (
                            <p className="text-[11px] text-slate-400">by {safeText(req.created_by)}</p>
                          )}
                        </div>
                      </div>

                      {/* ── IT Requirements box ── */}
                      <div className="bg-blue-50/60 border border-blue-100 rounded-lg px-4 py-3 mb-5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <svg className="w-3.5 h-3.5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          <p className="text-[10px] font-bold text-[#154CB3] uppercase tracking-widest">IT Requirements</p>
                        </div>
                        <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                          {req.it_info?.description}
                        </p>
                        {req.it_info?.note && (
                          <div className="mt-2 pt-2 border-t border-blue-100">
                            <p className="text-xs text-slate-500 italic">{req.it_info.note}</p>
                            {req.it_info.actioned_by && (
                              <p className="text-[11px] text-slate-400 mt-0.5">— {req.it_info.actioned_by}</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Expanded: Decline panel ── */}
                      {isExpanded && expandType === "decline" && (
                        <div className="border border-red-200 bg-red-50 rounded-xl px-4 py-4 space-y-3 mb-4">
                          <p className="text-sm font-semibold text-red-700">Decline this IT request?</p>
                          <textarea
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Optional — add a reason for declining"
                            className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
                          />
                          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={closeExpanded}
                              disabled={submitting}
                              className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitAction(req.event_id, "reject", noteText)}
                              disabled={submitting}
                              className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {submitting ? "Declining…" : "Confirm Decline"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Expanded: Return for revision panel ── */}
                      {isExpanded && expandType === "return" && (
                        <div className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-4 space-y-3 mb-4">
                          <p className="text-sm font-semibold text-amber-700">Return for Revision</p>
                          <textarea
                            rows={3}
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Describe what the organiser needs to change or clarify (required)"
                            className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                          />
                          {actionError && <p className="text-xs text-red-600">{actionError}</p>}
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={closeExpanded}
                              disabled={submitting}
                              className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => submitAction(req.event_id, "return_for_revision", noteText)}
                              disabled={submitting || !noteText.trim()}
                              className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {submitting ? "Sending…" : "Send for Revision"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Action buttons (pending only, not expanded) ── */}
                      {isPending && !isExpanded && (
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          <button
                            onClick={() => openExpanded(req.event_id, "return")}
                            disabled={submitting}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Return for Revision
                          </button>
                          <button
                            onClick={() => openExpanded(req.event_id, "decline")}
                            disabled={submitting}
                            className="px-4 py-1.5 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => submitAction(req.event_id, "approve")}
                            disabled={submitting}
                            className="px-5 py-1.5 text-sm font-semibold rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3a8f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                          >
                            {submitting ? "Approving…" : "Approve"}
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
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/></svg>
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
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
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
