"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEvents, FetchedEvent as ContextEvent } from "../../context/EventContext";
import toast from "react-hot-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CateringContact {
  name?: string;
  email?: string;
  mobile?: string | string[];
}

interface CateringVendor {
  catering_id: string;
  catering_name: string;
  location: string | null;
  campuses: string[];
  contact_details: CateringContact[];
}

interface MyCateringBooking {
  booking_id: string;
  booked_by: string;
  description: string | null;
  status: "pending" | "accepted" | "declined";
  event_fest_id: string | null;
  event_fest_type: "event" | "fest" | null;
  catering_id: string | null;
  contact_details: any;
  catering_name: string | null;
  catering_location: string | null;
  event_title: string | null;
  event_date: string | null;
  fest_title: string | null;
  fest_opening_date: string | null;
  created_at: string;
}

interface MyFest {
  fest_id: string;
  fest_title: string;
  opening_date: string | null;
}

type TabKey = "book" | "mine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
const safeLower = (value: unknown): string => String(value ?? "").toLowerCase();

function isPastDate(dateStr?: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

function formatMobiles(m: string | string[] | undefined): string {
  if (!m) return "";
  if (Array.isArray(m)) return m.filter(Boolean).join(", ");
  return String(m);
}

function statusStyle(status: string) {
  switch (status) {
    case "accepted": return "bg-green-50 text-green-700 border-green-200";
    case "declined": return "bg-red-50 text-red-600 border-red-200";
    default:         return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function statusLabel(status: string | null | undefined): string {
  const text = String(status ?? "").trim();
  if (!text) return "Unknown";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── SVG icons ────────────────────────────────────────────────────────────────

const IconChefHat = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" />
    <line x1="6" y1="17" x2="18" y2="17" />
  </svg>
);

const IconMapPin = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const IconPhone = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BookCateringPage() {
  const router = useRouter();
  const { session, userData, isLoading } = useAuth() as any;
  const { allEvents } = useEvents() as any;

  useEffect(() => {
    if (!isLoading && !session) router.replace("/auth");
    if (!isLoading && session && userData) {
      const hasAnyRole =
        userData.is_organiser || userData.is_masteradmin || userData.is_support ||
        userData.is_hod || userData.is_dean || userData.is_cfo ||
        userData.is_campus_director || userData.is_accounts_office ||
        userData.is_it_support || userData.is_venue_manager || userData.is_stalls;
      if (!hasAnyRole) router.replace("/error");
    }
  }, [isLoading, session, userData, router]);

  const [tab, setTab] = useState<TabKey>("book");

  const [vendors, setVendors] = useState<CateringVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [campusFilter, setCampusFilter] = useState("");

  // Vendor search (client-side)
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorQueryDebounced, setVendorQueryDebounced] = useState("");

  // In-memory cache + abort control for caterer fetching (faster campus switching)
  const vendorCacheRef = useRef<Map<string, CateringVendor[]>>(new Map());
  const vendorsAbortRef = useRef<AbortController | null>(null);

  const [selectedEventFestId, setSelectedEventFestId] = useState("");
  const [selectedEventFestType, setSelectedEventFestType] = useState<"event" | "fest" | null>(null);
  const [myFests, setMyFests] = useState<MyFest[]>([]);
  const [description, setDescription] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMobile, setContactMobile] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myBookings, setMyBookings] = useState<MyCateringBooking[]>([]);
  const [loadingMine, setLoadingMine] = useState(false);
  const [mineStatusFilter, setMineStatusFilter] = useState<"all" | "pending" | "accepted" | "declined">("all");
  const [minePage, setMinePage] = useState(1);
  const MINE_PAGE_SIZE = 8;

  // Pre-fill contact from user profile
  useEffect(() => {
    if (!userData) return;
    setContactName(userData.name || "");
    setContactEmail(userData.email || "");
    setContactMobile(userData.phone || userData.mobile || "");
  }, [userData]);

  // Fetch vendors (cached + abort in-flight requests on campusFilter change)
  useEffect(() => {
    if (!session?.access_token) return;

    const cacheKey = campusFilter ? `campus:${campusFilter}` : "all";
    const cached = vendorCacheRef.current.get(cacheKey);
    if (cached) {
      setVendors(cached);
      setLoadingVendors(false);
      return;
    }

    // Abort previous request
    if (vendorsAbortRef.current) vendorsAbortRef.current.abort();
    const controller = new AbortController();
    vendorsAbortRef.current = controller;

    setLoadingVendors(true);
    const url = campusFilter
      ? `${API_URL}/api/caterers?campus=${encodeURIComponent(campusFilter)}`
      : `${API_URL}/api/caterers`;

    fetch(url, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    })
      .then(r => (r.ok ? r.json() : []))
      .then(d => {
        const next = Array.isArray(d) ? d : [];
        vendorCacheRef.current.set(cacheKey, next);
        setVendors(next);
      })
      .catch(err => {
        if (err instanceof Error && err.name === "AbortError") return;
        setVendors([]);
      })
      .finally(() => {
        // If this request was aborted, we don't want to force the loading spinner off for the next one.
        if (controller.signal.aborted) return;
        setLoadingVendors(false);
      });
  }, [session?.access_token, campusFilter]);

  // Fetch user's own fests
  useEffect(() => {
    if (!session?.access_token || !userData?.email) return;
    const userEmail = safeLower(userData.email || "");
    fetch(`${API_URL}/api/fests?sortBy=created_at&sortOrder=desc`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.ok ? r.json() : {})
      .then((d: any) => {
        const all: MyFest[] = Array.isArray(d.fests) ? d.fests : (Array.isArray(d) ? d : []);
        setMyFests(all.filter((f: any) =>
          safeLower(f.created_by || "") === userEmail ||
          safeLower(f.contact_email || "") === userEmail
        ));
      })
      .catch(() => setMyFests([]));
  }, [session?.access_token, userData?.email]);

  // User's own upcoming events for the dropdown
  const myEvents = useMemo(() => {
    const userEmail = safeLower(userData?.email || "");
    if (!userEmail) return [];
    const events: ContextEvent[] = Array.isArray(allEvents) ? allEvents : [];
    return events.filter((e: any) => {
      const creator = safeLower(e.created_by || e.organizer_email || e.organiser_email || "");
      const isOwner = creator && creator === userEmail;
      const isHead =
        Array.isArray(e.event_heads) &&
        e.event_heads.some((h: any) => {
          const em = typeof h === "string" ? h : h?.email;
          return safeLower(em || "") === userEmail;
        });
      return (isOwner || isHead) && !isPastDate(e.event_date);
    });
  }, [allEvents, userData?.email]);

  const selectedVendor = vendors.find(v => v.catering_id === selectedVendorId) || null;

  const availableCampuses = useMemo(() => {
    const all = new Set<string>();
    vendors.forEach(v => (v.campuses || []).forEach(c => all.add(c)));
    return Array.from(all).sort();
  }, [vendors]);

  // Debounce search input for smoother typing (client-side filtering)
  useEffect(() => {
    const t = window.setTimeout(() => {
      setVendorQueryDebounced(vendorQuery.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [vendorQuery]);

  const filteredVendors = useMemo(() => {
    const q = vendorQueryDebounced;
    if (!q) return vendors;

    const qLower = q.toLowerCase();
    return vendors.filter(v => {
      const name = (v.catering_name || "").toLowerCase();
      const location = (v.location || "").toLowerCase();
      const campuses = Array.isArray(v.campuses) ? v.campuses.join(", ").toLowerCase() : "";
      return name.includes(qLower) || location.includes(qLower) || campuses.includes(qLower);
    });
  }, [vendors, vendorQueryDebounced]);

  const displayVendors = useMemo(() => {
    if (!selectedVendorId) return filteredVendors;
    const selectedFromFiltered = filteredVendors.find(v => v.catering_id === selectedVendorId) || null;
    const selectedFromAll = vendors.find(v => v.catering_id === selectedVendorId) || null;
    const selected = selectedFromFiltered || selectedFromAll;
    if (!selected) return filteredVendors;

    return [selected, ...filteredVendors.filter(v => v.catering_id !== selectedVendorId)];
  }, [filteredVendors, selectedVendorId, vendors]);

  // Combined events + fests for dropdown
  const combinedEventFest = useMemo(() => {
    const events = myEvents.map((e: any) => ({
      id: e.event_id,
      type: "event" as const,
      label: e.title + (e.event_date ? ` · ${new Date(e.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""),
    }));
    const fests = myFests.map(f => ({
      id: f.fest_id,
      type: "fest" as const,
      label: f.fest_title,
    }));
    return [...events, ...fests];
  }, [myEvents, myFests]);

  const canSubmit =
    !!selectedVendorId &&
    description.trim().length >= 3 &&
    contactName.trim() &&
    contactEmail.trim() &&
    !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const contact_details = {
        name: contactName.trim(),
        email: contactEmail.trim(),
        mobile: contactMobile.trim() || null,
      };
      const res = await fetch(`${API_URL}/api/catering-bookings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          catering_id: selectedVendorId,
          event_fest_id: selectedEventFestId || null,
          event_fest_type: selectedEventFestType || null,
          description: description.trim(),
          contact_details,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Failed to submit booking.");
        return;
      }
      toast.success("Catering request sent — awaiting caterer's response.");
      setSelectedVendorId("");
      setSelectedEventFestId("");
      setSelectedEventFestType(null);
      setDescription("");
      loadMyBookings();
      setTab("mine");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadMyBookings() {
    if (!session?.access_token) return;
    setLoadingMine(true);
    try {
      const res = await fetch(`${API_URL}/api/catering-bookings/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        setMyBookings([]);
        return;
      }
      const data = await res.json();
      setMyBookings(Array.isArray(data.bookings) ? data.bookings : []);
    } catch {
      setMyBookings([]);
    } finally {
      setLoadingMine(false);
    }
  }

  useEffect(() => {
    if (session?.access_token) loadMyBookings();
  }, [session?.access_token]);

  const filteredMyBookings = useMemo(() => {
    if (mineStatusFilter === "all") return myBookings;
    return myBookings.filter(b => b.status === mineStatusFilter);
  }, [myBookings, mineStatusFilter]);

  useEffect(() => { setMinePage(1); }, [mineStatusFilter]);

  const mineTotalPages = Math.max(1, Math.ceil(filteredMyBookings.length / MINE_PAGE_SIZE));
  const pagedMine = filteredMyBookings.slice((minePage - 1) * MINE_PAGE_SIZE, minePage * MINE_PAGE_SIZE);

  const statusCounts = useMemo(() => {
    return {
      all:      myBookings.length,
      pending:  myBookings.filter(b => b.status === "pending").length,
      accepted: myBookings.filter(b => b.status === "accepted").length,
      declined: myBookings.filter(b => b.status === "declined").length,
    };
  }, [myBookings]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 pt-[72px] flex items-center justify-center">
        <div className="text-sm text-gray-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-[72px]">
      <div className="max-w-screen-lg mx-auto px-6 pt-3 pb-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <Link href="/manage" className="hover:text-[#154CB3] transition-colors">Manage</Link>
          <span>›</span>
          <span className="text-gray-600 font-medium">Book Catering</span>
        </div>

        {/* Page heading */}
        <div className="flex items-center justify-between gap-3 mb-5 max-md:flex-col max-md:items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#154CB3]/10 text-[#154CB3] flex items-center justify-center">
              <IconChefHat />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#0f2557] leading-tight">Book Catering</h1>
              <p className="text-xs text-gray-500 mt-0.5">Send a catering request and track its status.</p>
            </div>
          </div>

          {/* Tab strip */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg p-0.5 gap-0.5">
            <button
              onClick={() => setTab("book")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === "book" ? "bg-[#154CB3] text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              Book Caterer
            </button>
            <button
              onClick={() => setTab("mine")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                tab === "mine" ? "bg-[#154CB3] text-white shadow-sm" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              My Bookings
              {statusCounts.all > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  tab === "mine" ? "bg-white text-[#154CB3]" : "bg-gray-200 text-gray-600"
                }`}>
                  {statusCounts.all}
                </span>
              )}
            </button>
          </div>
        </div>

        {tab === "mine" && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 overflow-x-auto">
              {(["all", "pending", "accepted", "declined"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setMineStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                    mineStatusFilter === s ? "bg-[#154CB3] text-white" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  {s === "all" ? "All" : statusLabel(s)}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                    mineStatusFilter === s ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
                  }`}>
                    {statusCounts[s]}
                  </span>
                </button>
              ))}
              <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                {filteredMyBookings.length} request{filteredMyBookings.length !== 1 ? "s" : ""}
              </span>
            </div>

            {loadingMine ? (
              <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
            ) : filteredMyBookings.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">
                {myBookings.length === 0
                  ? "You haven't made any catering bookings yet."
                  : `No ${mineStatusFilter} requests.`}
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-100">
                  {pagedMine.map(b => (
                    <li key={b.booking_id} className="px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {b.catering_name || b.catering_id || "Unknown caterer"}
                            </p>
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusStyle(b.status)}`}>
                              {statusLabel(b.status)}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 mb-1">
                            {b.catering_location && (
                              <span className="flex items-center gap-1"><IconMapPin />{b.catering_location}</span>
                            )}
                            {b.event_title && (
                              <span>Event: <span className="font-medium text-gray-700">{b.event_title}</span>
                                {b.event_date ? ` · ${formatDateShort(b.event_date)}` : ""}
                              </span>
                            )}
                            {b.fest_title && (
                              <span>Fest: <span className="font-medium text-gray-700">{b.fest_title}</span>
                                {b.fest_opening_date ? ` · ${formatDateShort(b.fest_opening_date)}` : ""}
                              </span>
                            )}
                            <span className="text-gray-400">Submitted {formatDateTime(b.created_at)}</span>
                          </div>
                          {b.description && (
                            <p className="mt-1 text-xs text-gray-600 border-l-2 border-gray-200 pl-2 whitespace-pre-wrap">
                              {b.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {mineTotalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500">
                      {(minePage - 1) * MINE_PAGE_SIZE + 1}–{Math.min(minePage * MINE_PAGE_SIZE, filteredMyBookings.length)} of {filteredMyBookings.length}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={minePage <= 1}
                        onClick={() => setMinePage(p => p - 1)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >← Prev</button>
                      <span className="text-xs text-gray-500">{minePage} / {mineTotalPages}</span>
                      <button
                        disabled={minePage >= mineTotalPages}
                        onClick={() => setMinePage(p => p + 1)}
                        className="px-2.5 py-1 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >Next →</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === "book" && (
        <div className="grid grid-cols-5 gap-5 max-lg:grid-cols-1">

          {/* LEFT — Vendor list */}
          <div className="col-span-2 max-lg:col-span-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-800">Available Caterers</p>
                <select
                  value={campusFilter}
                  onChange={e => setCampusFilter(e.target.value)}
                  className="h-7 rounded-md border border-gray-200 bg-white px-2 text-[11px] text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#154CB3]"
                >
                  <option value="">All campuses</option>
                  {availableCampuses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="relative">
                <input
                  value={vendorQuery}
                  onChange={e => setVendorQuery(e.target.value)}
                  placeholder="Search caterer, location or campus…"
                  className="w-full h-8 rounded-lg border border-gray-200 bg-white px-9 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                />
                {vendorQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setVendorQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 flex items-center justify-center"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                ) : (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-gray-400 flex items-center justify-between">
                <span>
                  {vendorQueryDebounced
                    ? `${filteredVendors.length} match${filteredVendors.length === 1 ? "" : "es"}`
                    : `${vendors.length} caterer${vendors.length === 1 ? "" : "s"} available`}
                </span>
                {vendorQueryDebounced && (
                  <button
                    type="button"
                    onClick={() => setVendorQuery("")}
                    className="text-[#154CB3] hover:underline whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {loadingVendors ? (
              <div className="py-10 text-center text-sm text-gray-400">Loading caterers…</div>
            ) : displayVendors.length === 0 ? (
              <div className="py-10 text-center text-sm text-gray-400 px-4">
                {vendorQueryDebounced
                  ? "No caterers match your search."
                  : `No caterers available${campusFilter ? ` for ${campusFilter}` : ""}.`}
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
                {displayVendors.map(v => {
                  const selected = v.catering_id === selectedVendorId;
                  return (
                    <li key={v.catering_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedVendorId(v.catering_id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          selected ? "bg-[#154CB3]/5 border-l-[3px] border-[#154CB3]" : "hover:bg-gray-50 border-l-[3px] border-transparent"
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900 truncate">{v.catering_name}</p>
                        {v.location && (
                          <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <IconMapPin /> {v.location}
                          </p>
                        )}
                        {v.campuses?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {v.campuses.slice(0, 3).map(c => (
                              <span key={c} className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] text-gray-600">
                                {c}
                              </span>
                            ))}
                            {v.campuses.length > 3 && (
                              <span className="text-[10px] text-gray-400">+{v.campuses.length - 3}</span>
                            )}
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* RIGHT — Booking form */}
          <div className="col-span-3 max-lg:col-span-1">
            {!selectedVendor ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm py-20 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                  <IconChefHat />
                </div>
                <p className="text-sm font-semibold text-gray-700">Select a caterer</p>
                <p className="text-xs text-gray-400 mt-1">Pick a vendor on the left to begin your booking request.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                {/* Vendor preview */}
                <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-br from-[#154CB3]/5 to-transparent">
                  <p className="text-[10px] font-semibold text-[#154CB3] uppercase tracking-widest mb-0.5">Booking with</p>
                  <p className="text-base font-bold text-gray-900">{selectedVendor.catering_name}</p>
                  {selectedVendor.location && (
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><IconMapPin /> {selectedVendor.location}</p>
                  )}
                  {selectedVendor.contact_details?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-600">
                      {selectedVendor.contact_details.slice(0, 2).map((c, i) => (
                        <div key={i} className="flex items-center gap-3">
                          {c.name && <span className="font-medium text-gray-700">{c.name}</span>}
                          {c.email && <span className="flex items-center gap-1"><IconMail />{c.email}</span>}
                          {c.mobile && <span className="flex items-center gap-1"><IconPhone />{formatMobiles(c.mobile)}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="px-5 py-5 space-y-4">
                  <FormField label="Description / Order details">
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value.slice(0, 1500))}
                      placeholder="e.g. Lunch for 120 guests on 2026-05-10 at 1pm — vegetarian buffet, tea/coffee service, setup near Block A foyer."
                      className={`${inputCls} h-28 resize-none pt-2`}
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5 text-right">{description.length}/1500</p>
                  </FormField>

                  <FormField label={<span><strong>Event or Fest</strong> (optional)</span>}>
                    <select
                      value={selectedEventFestId}
                      onChange={e => {
                        if (!e.target.value) {
                          setSelectedEventFestId("");
                          setSelectedEventFestType(null);
                        } else {
                          const found = combinedEventFest.find(item => item.id === e.target.value);
                          if (found) {
                            setSelectedEventFestId(found.id);
                            setSelectedEventFestType(found.type);
                          }
                        }
                      }}
                      className={selectCls}
                    >
                      <option value="">— Not linked to a specific event or fest —</option>
                      {combinedEventFest.length > 0 && <optgroup label="Events" />}
                      {myEvents.map((e: any) => (
                        <option key={`event-${e.event_id}`} value={e.event_id}>
                          {e.title}{e.event_date ? ` · ${new Date(e.event_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                        </option>
                      ))}
                      {myFests.length > 0 && <optgroup label="Fests" />}
                      {myFests.map(f => (
                        <option key={`fest-${f.fest_id}`} value={f.fest_id}>{f.fest_title}</option>
                      ))}
                    </select>
                    {combinedEventFest.length === 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        You have no upcoming events or fests. You can still submit a standalone request.
                      </p>
                    )}
                  </FormField>

                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Your contact details</p>
                    <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                      <FormField label="Name">
                        <input
                          value={contactName}
                          readOnly
                          className="w-full h-9 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm text-gray-500 cursor-default select-none focus:outline-none"
                        />
                      </FormField>
                      <FormField label="Email">
                        <input
                          type="email"
                          value={contactEmail}
                          readOnly
                          className="w-full h-9 rounded-lg border border-gray-300 bg-gray-100 px-3 text-sm text-gray-500 cursor-default select-none focus:outline-none"
                        />
                      </FormField>
                      <FormField label="Mobile (optional)">
                        <input
                          value={contactMobile}
                          onChange={e => setContactMobile(e.target.value)}
                          className={inputCls}
                          placeholder="+91 …"
                        />
                      </FormField>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex gap-2.5 justify-end">
                  <button
                    type="button"
                    onClick={() => { setSelectedVendorId(""); setDescription(""); setSelectedEventFestId(""); setSelectedEventFestType(null); }}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={!canSubmit}
                    className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#154CB3] text-white hover:bg-[#0f3a7a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Sending…" : "Send booking request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function FormField({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const selectCls =
  "w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed";

const inputCls =
  "w-full h-9 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent";
