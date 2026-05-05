"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { christCampuses } from "@/app/lib/eventFormSchema";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface EventOption {
  event_id: string;
  title: string;
  event_date: string;
}

interface FestOption {
  fest_id: string;
  fest_title: string;
  opening_date: string;
}

type Tab = "mine" | "book";
type LinkedType = "none" | "event" | "fest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const STATUS_CONFIG: Record<string, { dot: string; badge: string; label: string }> = {
  pending:  { dot: "bg-[#154CB3]", badge: "bg-blue-50 text-blue-700",  label: "Pending" },
  accepted: { dot: "bg-green-500", badge: "bg-green-50 text-green-700", label: "Accepted" },
  declined: { dot: "bg-red-500",   badge: "bg-red-50 text-red-700",     label: "Declined" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { dot: "bg-gray-400", badge: "bg-gray-100 text-gray-600", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Counter({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const num = Number(value) || 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, num - 1)))}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors text-lg leading-none"
        >−</button>
        <span className="w-8 text-center text-base font-semibold text-slate-800 tabular-nums">{num}</span>
        <button
          type="button"
          onClick={() => onChange(String(num + 1))}
          className="w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors text-lg leading-none"
        >+</button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function BookStallContent() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<Tab>("book");

  function switchTab(next: Tab) {
    setTab(next);
    const p = new URLSearchParams(searchParams?.toString() || "");
    if (next === "mine") p.set("tab", "mine");
    else p.delete("tab");
    const qs = p.toString();
    router.replace(qs ? `?${qs}` : pathname, { scroll: false });
  }

  const [bookings, setBookings] = useState<StallBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [description, setDescription] = useState("");
  const [hardboardStalls, setHardboardStalls] = useState<string>("0");
  const [canopyStalls, setCanopyStalls] = useState<string>("0");
  const [campus, setCampus] = useState("");
  const [linkedType, setLinkedType] = useState<LinkedType>("none");
  const [eventFestId, setEventFestId] = useState("");
  const [events, setEvents] = useState<EventOption[]>([]);
  const [fests, setFests] = useState<FestOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [prefilledEventFestId, setPrefilledEventFestId] = useState<string | null>(null);
  const [lockedEventFest, setLockedEventFest] = useState<{ type: LinkedType; id: string; name: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "mine") setTab("mine");
    else if (tabParam === "book") setTab("book");
  }, [searchParams]);

  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData) {
      if (!userData.is_organiser && !(userData as any).is_masteradmin) router.replace("/error");
    }
  }, [authLoading, session, userData, router]);

  const fetchMyBookings = useCallback(async () => {
    if (!session) return;
    setBookingsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/stall-bookings/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bookings");
      setBookings(json.bookings || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setBookingsLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session && tab === "mine") void fetchMyBookings();
  }, [session, tab, fetchMyBookings]);

  useEffect(() => {
    if (!session || tab !== "book") return;
    setOptionsLoading(true);
    setOptionsError(null);
    fetch(`${API_URL}/api/stall-bookings/my-options`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async r => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Failed to load options");
        setEvents(json.events || []);
        setFests(json.fests || []);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load events/fests";
        setOptionsError(msg);
        toast.error(msg);
      })
      .finally(() => setOptionsLoading(false));
  }, [session, tab]);

  useEffect(() => {
    if (!authLoading && userData && userData.is_organiser && !campus && (userData as any).campus) {
      setCampus((userData as any).campus as string);
    }
  }, [authLoading, userData, campus]);

  useEffect(() => {
    const urlEventFestId = searchParams?.get("event_fest_id");
    if (!urlEventFestId || eventFestId) return;
    setPrefilledEventFestId(urlEventFestId);
    setEventFestId(urlEventFestId);
    const foundEvent = events.find(e => e.event_id === urlEventFestId);
    if (foundEvent) { setLinkedType("event"); setLockedEventFest({ type: "event", id: urlEventFestId, name: foundEvent.title }); return; }
    const foundFest = fests.find(f => f.fest_id === urlEventFestId);
    if (foundFest) { setLinkedType("fest"); setLockedEventFest({ type: "fest", id: urlEventFestId, name: foundFest.fest_title }); return; }
    const urlType = searchParams?.get("event_fest_type");
    const fallbackType: LinkedType = urlType === "fest" ? "fest" : urlType === "event" ? "event" : urlEventFestId.toUpperCase().startsWith("EV-") ? "event" : "fest";
    setLinkedType(fallbackType);
    setLockedEventFest({ type: fallbackType, id: urlEventFestId, name: urlEventFestId });
  }, [searchParams, events, fests, eventFestId]);

  useEffect(() => {
    const urlEventFestId = searchParams?.get("event_fest_id");
    if (!prefilledEventFestId && (!urlEventFestId || linkedType === "none")) setEventFestId("");
  }, [linkedType, searchParams, prefilledEventFestId]);

  const stallsInvalid = Number(hardboardStalls) === 0 && Number(canopyStalls) === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !description.trim() || !campus) return;
    if (stallsInvalid) { toast.error("Please request at least one Hard Board or Canopy stall."); return; }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        description: description.trim(),
        hardboard_stalls: Number(hardboardStalls) || 0,
        canopy_stalls: Number(canopyStalls) || 0,
        campus,
      };
      if (eventFestId) body.event_fest_id = eventFestId;
      const res = await fetch(`${API_URL}/api/stall-bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit booking");
      const urlEventFestId = searchParams?.get("event_fest_id");
      const linkedTypeForRedirect: LinkedType = linkedType !== "none" ? linkedType : (urlEventFestId || eventFestId || "").toUpperCase().startsWith("EV-") ? "event" : "fest";
      toast.success("Request sent.");
      if (urlEventFestId) { router.push(`/approvals/${urlEventFestId}?type=${linkedTypeForRedirect}`); return; }
      setDescription(""); setHardboardStalls("0"); setCanopyStalls("0");
      setCampus(userData && (userData as any).is_organiser ? ((userData as any).campus || "") : "");
      setLinkedType("none"); setEventFestId(""); setPrefilledEventFestId(null); setLockedEventFest(null);
      switchTab("mine");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf8ff]">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#154CB3] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div>
              <h1 className="text-base font-bold text-[#0f2a6b] leading-none">Book a Stall</h1>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Request stalls for an event or fest.</p>
            </div>
          </div>

          {tab === "mine" && (
            <button
              onClick={() => void fetchMyBookings()}
              disabled={bookingsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 disabled:opacity-50 transition-colors"
            >
              <svg className={`w-3.5 h-3.5 ${bookingsLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-8">

        {/* ── Tab bar ── */}
        <div className="flex items-center gap-8 border-b border-slate-200 mb-8">
          {([["book", "Book a Stall"], ["mine", "My Requests"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => switchTab(key)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === key
                  ? "border-[#154CB3] text-[#154CB3]"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Book a Stall Tab ── */}
        {tab === "book" && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Stall Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Stall Details</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="What is the stall for? Any special requirements?"
                    rows={3}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] resize-none bg-slate-50/50 transition-colors placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Campus <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={campus}
                    onChange={e => setCampus(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] bg-slate-50/50 transition-colors text-slate-700"
                  >
                    <option value="">— Select campus —</option>
                    {christCampuses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Stall Count */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Stall Count</h2>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-colors ${stallsInvalid ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Hard Board</span>
                  <Counter label="" value={hardboardStalls} onChange={setHardboardStalls} />
                </div>
                <div className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-colors ${stallsInvalid ? "bg-red-50 border border-red-200" : "bg-slate-50"}`}>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Canopy</span>
                  <Counter label="" value={canopyStalls} onChange={setCanopyStalls} />
                </div>
              </div>
              {stallsInvalid && (
                <p className="flex items-center gap-1.5 text-xs text-red-600 mt-3">
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  At least one stall type must be greater than 0.
                </p>
              )}
            </div>

            {/* Link to Event or Fest */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.05)] p-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-slate-800">Link to Event or Fest</h2>
                <span className="text-xs text-slate-400 font-normal ml-1">optional</span>
              </div>
              <p className="text-xs text-slate-400 mb-4 ml-9">Link this request to your event or fest.</p>

              <div className="flex gap-2 mb-4">
                {(["none", "event", "fest"] as LinkedType[]).map(t => (
                  <button
                    type="button"
                    key={t}
                    disabled={!!lockedEventFest && t !== linkedType}
                    onClick={() => { if (!lockedEventFest || t === linkedType) setLinkedType(t); }}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      linkedType === t
                        ? "border-[#154CB3] bg-[#154CB3] text-white shadow-sm"
                        : lockedEventFest && t !== linkedType
                        ? "border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed"
                        : "border-slate-200 text-slate-500 hover:border-[#154CB3]/50 hover:text-[#154CB3] bg-slate-50"
                    }`}
                  >
                    {t === "none" ? "None" : t === "event" ? "Event" : "Fest"}
                  </button>
                ))}
              </div>

              {linkedType !== "none" && (
                optionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-[#154CB3] rounded-full animate-spin" />
                    Loading your {linkedType === "event" ? "events" : "fests"}…
                  </div>
                ) : optionsError ? (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{optionsError}</p>
                ) : (
                  <>
                    {lockedEventFest ? (
                      <div className="w-full px-3.5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-sm text-slate-700">
                        <p className="font-medium text-slate-800">{lockedEventFest.name}</p>
                      </div>
                    ) : (
                      <select
                        value={eventFestId}
                        onChange={e => setEventFestId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] bg-slate-50/50 text-slate-700"
                      >
                        <option value="">Select {linkedType === "event" ? "event" : "fest"}</option>
                        {linkedType === "event"
                          ? events.map(ev => <option key={ev.event_id} value={ev.event_id}>{ev.title} ({formatDate(ev.event_date)})</option>)
                          : fests.map(ft => <option key={ft.fest_id} value={ft.fest_id}>{ft.fest_title} ({formatDate(ft.opening_date)})</option>)}
                      </select>
                    )}
                    {linkedType === "event" && events.length === 0 && <p className="text-xs text-slate-400 mt-2">No events found.</p>}
                    {linkedType === "fest" && fests.length === 0 && <p className="text-xs text-slate-400 mt-2">No fests found.</p>}
                  </>
                )
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || !description.trim() || !campus || stallsInvalid}
              className="w-full py-3.5 bg-[#154CB3] text-white font-semibold rounded-2xl hover:bg-[#0d3a8a] active:scale-[0.99] transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Submitting…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Submit Request</>
              )}
            </button>
          </form>
        )}

        {/* ── My Bookings Tab ── */}
        {tab === "mine" && (
          <div>
            {bookingsLoading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading your bookings…</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-14 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-slate-700 font-semibold text-sm">No stall bookings yet</p>
                <p className="text-xs text-slate-400 mt-1">Switch to Book a Stall to submit.</p>
                <button
                  onClick={() => switchTab("book")}
                  className="mt-4 px-5 py-2 rounded-full bg-[#154CB3] text-white text-sm font-semibold hover:bg-[#0d3a8a] transition-colors"
                >
                  Book a Stall
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                  {bookings.length} request{bookings.length !== 1 ? "s" : ""} · newest first
                </p>
                {bookings.map(b => {
                  const desc = b.description || {};
                  const linkedTitle = b.event_title || b.fest_title;
                  const linkedDate = b.event_date || b.fest_date;
                  return (
                    <div
                      key={b.stall_id}
                      className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] border border-slate-200 hover:border-[#154CB3]/30 transition-all p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={b.status} />
                          {b.campus && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 font-medium">
                              {b.campus}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">{timeAgo(b.created_at)}</p>
                      </div>

                      {desc.notes && (
                        <p className="text-sm text-slate-800 mb-3 leading-relaxed">{desc.notes}</p>
                      )}

                      {((desc.hardboard_stalls ?? 0) > 0 || (desc.canopy_stalls ?? 0) > 0) && (
                        <div className="flex gap-2 mb-3">
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

                      {linkedTitle && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="font-medium text-[#154CB3]">{linkedTitle}</span>
                          {linkedDate && <span className="text-slate-400">· {formatDate(linkedDate)}</span>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function BookStallPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf8ff]">
        <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BookStallContent />
    </Suspense>
  );
}
