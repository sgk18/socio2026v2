"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingRow {
  id: string;
  venue_id: string;
  requested_by: string;
  requested_by_name?: string | null;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  headcount: number | null;
  setup_notes: string | null;
  entity_type: "event" | "fest" | "standalone";
  entity_id: string | null;
  status: "pending" | "approved" | "rejected" | "returned_for_revision";
  decision_notes: string | null;
  created_at: string;
  has_overlap?: boolean;
  venue?: {
    name: string;
    campus: string;
    location: string | null;
    capacity: number | null;
    is_approval_needed: boolean;
  };
}

type ActionType = "approved" | "rejected" | "returned_for_revision";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

function pad2(n: number) { return String(n).padStart(2, "0"); }

function formatTime12(t: string) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${pad2(m)} ${ampm}`;
}

function formatDate(d: string) {
  if (!d) return "";
  const [y, mo, day] = d.split("-").map(Number);
  return new Date(y, mo - 1, day).toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });
}

const STATUS_STYLE: Record<BookingRow["status"], string> = {
  pending:               "bg-amber-50 text-amber-700 border-amber-200",
  approved:              "bg-green-50 text-green-700 border-green-200",
  rejected:              "bg-red-50 text-red-700 border-red-200",
  returned_for_revision: "bg-purple-50 text-purple-700 border-purple-200",
};

const STATUS_LABEL: Record<BookingRow["status"], string> = {
  pending:               "Pending",
  approved:              "Approved",
  rejected:              "Rejected",
  returned_for_revision: "Returned",
};

const ENTITY_STYLE: Record<BookingRow["entity_type"], string> = {
  event:      "bg-blue-50 text-blue-700 border-blue-200",
  fest:       "bg-purple-50 text-purple-700 border-purple-200",
  standalone: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// ─── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({
  row,
  showActions,
  acting,
  onApprove,
  onReject,
  onReturn,
}: {
  row: BookingRow;
  showActions: boolean;
  acting: boolean;
  onApprove: () => void;
  onReject: () => void;
  onReturn: () => void;
}) {
  return (
    <div className={`bg-white rounded-2xl border overflow-hidden transition-shadow hover:shadow-md ${
      row.has_overlap ? "border-amber-300" : "border-gray-200"
    }`}>
      {/* Overlap warning */}
      {row.has_overlap && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Overlapping booking — only one can be approved
        </div>
      )}

      <div className="p-4">
        {/* Title + badges */}
        <div className="flex flex-wrap items-start gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex-1 min-w-0">{row.title}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium capitalize ${ENTITY_STYLE[row.entity_type]}`}>
              {row.entity_type}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLE[row.status]}`}>
              {STATUS_LABEL[row.status]}
            </span>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-gray-500 mb-3">
          {row.venue?.name && (
            <div className="flex items-center gap-1.5 col-span-full">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span className="font-medium text-gray-700">
                {row.venue.name}{row.venue.location ? ` · ${row.venue.location}` : ""}
              </span>
              {row.venue.campus && (
                <span className="text-gray-400">· {row.venue.campus}</span>
              )}
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {formatDate(row.date)}
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatTime12(row.start_time)} – {formatTime12(row.end_time)}
          </div>
          {row.headcount != null && (
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {row.headcount} attendees
            </div>
          )}
          <div className="flex items-center gap-1.5 col-span-full">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Requested by <span className="font-medium text-gray-700">{row.requested_by_name || row.requested_by}</span></span>
          </div>
        </div>

        {/* Setup notes */}
        {row.setup_notes && (
          <p className="text-xs text-gray-400 italic mb-3">"{row.setup_notes}"</p>
        )}

        {/* Decision notes */}
        {row.decision_notes && (
          <div className="mb-3 border-l-2 border-gray-200 pl-3 text-xs text-gray-500 italic">
            {row.decision_notes}
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
            <button
              disabled={acting}
              onClick={onApprove}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors disabled:opacity-50"
            >
              {acting ? "…" : "Approve"}
            </button>
            <button
              disabled={acting}
              onClick={onReturn}
              className="flex-1 py-2 text-xs font-semibold rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50"
            >
              Return
            </button>
            <button
              disabled={acting}
              onClick={onReject}
              className="flex-1 py-2 text-xs font-semibold rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 animate-pulse">
      <div className="flex gap-2">
        <div className="h-4 bg-gray-100 rounded w-1/2" />
        <div className="h-4 bg-gray-100 rounded w-16 ml-auto" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-3/4" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
        <div className="h-7 bg-gray-100 rounded-xl" />
        <div className="h-7 bg-gray-100 rounded-xl" />
        <div className="h-7 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VenueDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();

  const [pending,  setPending]  = useState<BookingRow[]>([]);
  const [reviewed, setReviewed] = useState<BookingRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [venueFilter, setVenueFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [pendingPage,  setPendingPage]  = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);
  const PAGE_SIZE = 10;

  const [notesModal, setNotesModal] = useState<{ id: string; action: "rejected" | "returned_for_revision" } | null>(null);
  const [notesText,  setNotesText]  = useState("");

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const u = userData as any;
    if (u && !u.is_venue_manager && !u.is_masteradmin) { router.replace("/error"); return; }
    fetchQueue();
  }, [isLoading, session, userData]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchQueue() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings/queue`, {
        headers: { Authorization: `Bearer ${(session as any)!.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load queue"); return; }
      const data = await res.json();
      setPending(data.pending  || []);
      setReviewed(data.reviewed || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, action: ActionType, notes?: string) {
    setActingId(id);
    try {
      const res = await fetch(`${API_URL}/api/venue-bookings/${id}/action`, {
        method: "POST",
        headers: { Authorization: `Bearer ${(session as any)!.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(body.error || "Action failed"); return; }
      toast.success(
        action === "approved"             ? "Booking approved" :
        action === "rejected"             ? "Booking rejected" :
        "Returned to organiser"
      );
      fetchQueue();
    } catch {
      toast.error("Network error");
    } finally {
      setActingId(null);
    }
  }

  async function confirmNotes() {
    if (!notesModal) return;
    if (notesText.trim().length < 10) { toast.error("Please provide at least 10 characters"); return; }
    await handleAction(notesModal.id, notesModal.action, notesText.trim());
    setNotesModal(null);
    setNotesText("");
  }

  const allVenueNames = Array.from(
    new Set([...pending, ...reviewed].map(r => r.venue?.name).filter(Boolean) as string[])
  ).sort();

  const matchFilter = (r: BookingRow) => venueFilter === "all" || r.venue?.name === venueFilter;
  const filteredPending  = pending.filter(matchFilter);
  const filteredReviewed = reviewed.filter(matchFilter);

  const pendingTotalPages  = Math.max(1, Math.ceil(filteredPending.length  / PAGE_SIZE));
  const reviewedTotalPages = Math.max(1, Math.ceil(filteredReviewed.length / PAGE_SIZE));
  const pagedPending  = filteredPending.slice( (pendingPage  - 1) * PAGE_SIZE, pendingPage  * PAGE_SIZE);
  const pagedReviewed = filteredReviewed.slice((reviewedPage - 1) * PAGE_SIZE, reviewedPage * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50 pt-[72px]">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Venue Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and action venue booking requests for your campus.
          </p>
        </div>

        {/* Tab bar + venue filter */}
        <div className="flex items-center gap-3">
        <div className="flex flex-1 bg-white border border-gray-200 rounded-xl p-1 gap-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "pending"
                ? "bg-[#154CB3] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Pending
            {!loading && filteredPending.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "pending" ? "bg-white/20" : "bg-amber-100 text-amber-700"
              }`}>
                {filteredPending.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("reviewed")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "reviewed"
                ? "bg-[#154CB3] text-white shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Reviewed
            {!loading && filteredReviewed.length > 0 && (
              <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-bold ${
                activeTab === "reviewed" ? "bg-white/20" : "bg-gray-100 text-gray-500"
              }`}>
                {filteredReviewed.length}
              </span>
            )}
          </button>
        </div>

          {/* Venue dropdown — right side, only if multiple venues */}
          {allVenueNames.length > 1 && (
            <select
              value={venueFilter}
              onChange={e => { setVenueFilter(e.target.value); setPendingPage(1); setReviewedPage(1); }}
              className="h-10 px-3 pr-8 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#154CB3] shrink-0 appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
            >
              <option value="all">All venues</option>
              {allVenueNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : activeTab === "pending" ? (
          <section className="space-y-3">
            {filteredPending.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 py-14 text-center">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-500">All clear — no pending requests</p>
              </div>
            ) : (
              <>
                {pagedPending.map(row => (
                  <BookingCard
                    key={row.id}
                    row={row}
                    showActions
                    acting={actingId === row.id}
                    onApprove={() => handleAction(row.id, "approved")}
                    onReject={() => { setNotesModal({ id: row.id, action: "rejected" }); setNotesText(""); }}
                    onReturn={() => { setNotesModal({ id: row.id, action: "returned_for_revision" }); setNotesText(""); }}
                  />
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button
                    disabled={pendingPage <= 1}
                    onClick={() => setPendingPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >← Prev</button>
                  <span className="text-xs text-gray-400">
                    {Math.min((pendingPage - 1) * PAGE_SIZE + 1, filteredPending.length)}–{Math.min(pendingPage * PAGE_SIZE, filteredPending.length)} of {filteredPending.length}
                  </span>
                  <button
                    disabled={pendingPage >= pendingTotalPages}
                    onClick={() => setPendingPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >Next →</button>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className="space-y-3">
            {filteredReviewed.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 py-14 text-center">
                <p className="text-sm text-gray-400">No reviewed requests yet.</p>
              </div>
            ) : (
              <>
                {pagedReviewed.map(row => (
                  <BookingCard
                    key={row.id}
                    row={row}
                    showActions={false}
                    acting={false}
                    onApprove={() => {}}
                    onReject={() => {}}
                    onReturn={() => {}}
                  />
                ))}
                <div className="flex items-center justify-between pt-1">
                  <button
                    disabled={reviewedPage <= 1}
                    onClick={() => setReviewedPage(p => p - 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >← Prev</button>
                  <span className="text-xs text-gray-400">
                    {Math.min((reviewedPage - 1) * PAGE_SIZE + 1, filteredReviewed.length)}–{Math.min(reviewedPage * PAGE_SIZE, filteredReviewed.length)} of {filteredReviewed.length}
                  </span>
                  <button
                    disabled={reviewedPage >= reviewedTotalPages}
                    onClick={() => setReviewedPage(p => p + 1)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                  >Next →</button>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* Notes modal */}
      {notesModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0"
          onClick={() => setNotesModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                {notesModal.action === "rejected" ? "Reject booking" : "Return to organiser"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {notesModal.action === "rejected"
                  ? "Provide a reason so the organiser knows why."
                  : "Explain what needs to be corrected before re-submission."}
              </p>
            </div>
            <div className="px-5 py-4">
              <textarea
                rows={4}
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder="Enter reason…"
                autoFocus
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#154CB3] placeholder:text-gray-300"
              />
              <p className={`text-xs mt-1 ${notesText.trim().length >= 10 ? "text-green-600" : "text-gray-400"}`}>
                {notesText.trim().length} / 10 min characters
              </p>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setNotesModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmNotes}
                className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors ${
                  notesModal.action === "rejected"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {notesModal.action === "rejected" ? "Reject" : "Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
