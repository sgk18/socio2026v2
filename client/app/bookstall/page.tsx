"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  pending:  { badge: "bg-amber-50 text-amber-700 border border-amber-200",  dot: "bg-amber-400" },
  accepted: { badge: "bg-green-50 text-green-700 border border-green-200",  dot: "bg-green-500" },
  declined: { badge: "bg-red-50 text-red-700 border border-red-200",        dot: "bg-red-500" },
};

function formatStatusLabel(value: unknown, fallback = "Unknown"): string {
  const text = String(value ?? "").trim();
  if (!text) return fallback;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const num = Number(value) || 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(String(Math.max(0, num - 1)))}
          className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors text-lg leading-none"
        >
          −
        </button>
        <span className="w-8 text-center text-base font-semibold text-gray-800 tabular-nums">
          {num}
        </span>
        <button
          type="button"
          onClick={() => onChange(String(num + 1))}
          className="w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:border-[#154CB3] hover:text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors text-lg leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookStallPage() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("book");

  // My Bookings state
  const [bookings, setBookings] = useState<StallBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);

  // Booking form state
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

  // ─── Auth Guard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !session) router.replace("/auth");
    if (!authLoading && session && userData) {
      if (!userData.is_organiser && !(userData as any).is_masteradmin) {
        router.replace("/error");
      }
    }
  }, [authLoading, session, userData, router]);

  // ─── Fetch My Bookings ───────────────────────────────────────────────────────
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
    if (session && tab === "mine") fetchMyBookings();
  }, [session, tab, fetchMyBookings]);

  // ─── Fetch Organiser's Events & Fests ────────────────────────────────────────
  useEffect(() => {
    if (!session || tab !== "book") return;
    setOptionsLoading(true);
    setOptionsError(null);
    fetch(`${API_URL}/api/stall-bookings/my-options`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
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
    setEventFestId("");
  }, [linkedType]);

  // ─── Submit Booking ──────────────────────────────────────────────────────────
  const stallsInvalid = Number(hardboardStalls) === 0 && Number(canopyStalls) === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !description.trim() || !campus) return;
    if (stallsInvalid) {
      toast.error("Please request at least one Hard Board or Canopy stall.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        description: description.trim(),
        hardboard_stalls: Number(hardboardStalls) || 0,
        canopy_stalls: Number(canopyStalls) || 0,
        campus,
      };
      if (linkedType !== "none" && eventFestId) {
        body.event_fest_id = eventFestId;
      }

      const res = await fetch(`${API_URL}/api/stall-bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to submit booking");

      toast.success("Stall booking submitted!");
      setDescription("");
      setHardboardStalls("0");
      setCanopyStalls("0");
      setCampus("");
      setLinkedType("none");
      setEventFestId("");
      setTab("mine");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit booking");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading State ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#154CB3]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#063168]">Book a Stall</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Request a stall for your event or fest</p>
        </div>

        {/* Tabs */}
        <div className="inline-flex mb-7 bg-gray-100 rounded-xl p-1 gap-1">
          {([["book", "Book a Stall"], ["mine", "My Bookings"]] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                tab === key
                  ? "bg-white text-[#154CB3] shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Book a Stall Tab ─────────────────────────────────────────────────── */}
        {tab === "book" && (
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Description card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/8 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Stall Details</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is the stall for? Any special requirements?"
                    rows={3}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] resize-none bg-gray-50/50 transition-colors placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Campus <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] bg-gray-50/50 transition-colors text-gray-700"
                  >
                    <option value="">— Select campus —</option>
                    {christCampuses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Stall count card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/8 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Stall Count</h2>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-colors ${stallsInvalid ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hard Board</span>
                  <Counter label="" value={hardboardStalls} onChange={setHardboardStalls} />
                </div>
                <div className={`rounded-xl p-4 flex flex-col items-center gap-2 transition-colors ${stallsInvalid ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Canopy</span>
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

            {/* Link card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-7 h-7 rounded-lg bg-[#154CB3]/8 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Link to Event or Fest</h2>
                <span className="text-xs text-gray-400 font-normal ml-1">optional</span>
              </div>
              <p className="text-xs text-gray-400 mb-4 ml-9">Associate this stall request with one of your events or fests.</p>

              <div className="flex gap-2 mb-4">
                {(["none", "event", "fest"] as LinkedType[]).map((t) => (
                  <button
                    type="button"
                    key={t}
                    onClick={() => setLinkedType(t)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      linkedType === t
                        ? "border-[#154CB3] bg-[#154CB3] text-white shadow-sm"
                        : "border-gray-200 text-gray-500 hover:border-[#154CB3]/50 hover:text-[#154CB3] bg-gray-50"
                    }`}
                  >
                    {t === "none" ? "None" : t === "event" ? "Event" : "Fest"}
                  </button>
                ))}
              </div>

              {linkedType !== "none" && (
                optionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-[#154CB3] rounded-full animate-spin" />
                    Loading your {linkedType === "event" ? "events" : "fests"}…
                  </div>
                ) : optionsError ? (
                  <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{optionsError}</p>
                ) : (
                  <>
                    <select
                      value={eventFestId}
                      onChange={(e) => setEventFestId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] bg-gray-50/50 text-gray-700"
                    >
                      <option value="">— Select {linkedType === "event" ? "event" : "fest"} —</option>
                      {linkedType === "event"
                        ? events.map((ev) => (
                            <option key={ev.event_id} value={ev.event_id}>
                              {ev.title} ({formatDate(ev.event_date)})
                            </option>
                          ))
                        : fests.map((ft) => (
                            <option key={ft.fest_id} value={ft.fest_id}>
                              {ft.fest_title} ({formatDate(ft.opening_date)})
                            </option>
                          ))}
                    </select>
                    {linkedType === "event" && events.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2">No events found. Create an event first from the Manage page.</p>
                    )}
                    {linkedType === "fest" && fests.length === 0 && (
                      <p className="text-xs text-gray-400 mt-2">No fests found. Create a fest first from the Manage page.</p>
                    )}
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
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Submitting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Submit Stall Booking
                </>
              )}
            </button>
          </form>
        )}

        {/* ── My Bookings Tab ─────────────────────────────────────────────────── */}
        {tab === "mine" && (
          <div>
            {bookingsLoading ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-700">No stall bookings yet</p>
                <p className="text-sm text-gray-400 mt-1">Switch to &ldquo;Book a Stall&rdquo; to submit a request</p>
                <button
                  onClick={() => setTab("book")}
                  className="mt-4 px-5 py-2 rounded-full bg-[#154CB3] text-white text-sm font-medium hover:bg-[#0d3a8a] transition-colors"
                >
                  Book a Stall
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => {
                  const desc = b.description || {};
                  const linkedTitle = b.event_title || b.fest_title;
                  const linkedDate = b.event_date || b.fest_date;
                  const style = STATUS_STYLES[b.status] || { badge: "bg-gray-100 text-gray-600 border border-gray-200", dot: "bg-gray-400" };
                  return (
                    <div
                      key={b.stall_id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${style.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                            {formatStatusLabel(b.status)}
                          </span>
                          {b.campus && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium border border-blue-100">
                              {b.campus}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                          {formatSubmitted(b.created_at)}
                        </span>
                      </div>

                      {desc.notes && (
                        <p className="text-sm text-gray-800 mb-3 leading-relaxed">{desc.notes}</p>
                      )}

                      {((desc.hardboard_stalls ?? 0) > 0 || (desc.canopy_stalls ?? 0) > 0) && (
                        <div className="flex gap-3 mb-3">
                          {(desc.hardboard_stalls ?? 0) > 0 && (
                            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                              </svg>
                              <span className="text-xs text-gray-500">Hard board</span>
                              <span className="text-xs font-bold text-gray-800">{desc.hardboard_stalls}</span>
                            </div>
                          )}
                          {(desc.canopy_stalls ?? 0) > 0 && (
                            <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                              <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                              <span className="text-xs text-gray-500">Canopy</span>
                              <span className="text-xs font-bold text-gray-800">{desc.canopy_stalls}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {linkedTitle && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <svg className="w-3.5 h-3.5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          <span className="font-medium text-[#154CB3]">{linkedTitle}</span>
                          {linkedDate && <span className="text-gray-400">· {formatDate(linkedDate)}</span>}
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
