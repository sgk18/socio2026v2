"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import toast from "react-hot-toast";

interface Booking {
  booking_id: string;
  booked_by: string;
  description: string | null;
  status: "pending" | "accepted" | "declined";
  event_id: string | null;
  catering_id: string | null;
  contact_details: any;
  event_title: string | null;
  event_date: string | null;
  catering_name: string | null;
  created_at: string;
}

interface VendorOption {
  catering_id: string;
  catering_name: string;
}

const safeLower = (value: unknown): string => String(value ?? "").toLowerCase();

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function formatSubmitted(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatMobileList(m: unknown): string {
  if (!m) return "";
  if (Array.isArray(m)) return m.filter(Boolean).join(", ");
  return String(m);
}

function parseContact(raw: any): { name?: string; email?: string; mobile?: string } | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return parseContact(JSON.parse(raw)); } catch { return { name: raw }; }
  }
  if (Array.isArray(raw)) return raw[0] ? parseContact(raw[0]) : null;
  if (typeof raw === "object") {
    return {
      name:   raw.name || raw.full_name || raw.contact_name || undefined,
      email:  raw.email || raw.mail || undefined,
      mobile: formatMobileList(raw.mobile || raw.phone || raw.contact_number) || undefined,
    };
  }
  return null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Accepted</span>;
  if (status === "declined")
    return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Declined</span>;
  return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>;
}

export default function CateringDashboard() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "reviewed">("pending");
  const [pendingPage, setPendingPage] = useState(1);
  const [reviewedPage, setReviewedPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    if (isLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const c = (userData as any)?.caters;
    const list = Array.isArray(c) ? c : c ? [c] : [];
    const isCaterer = list.some((entry: any) => entry?.is_catering);
    if (userData && !isCaterer && !(userData as any)?.is_masteradmin) {
      router.replace("/error");
      return;
    }
    fetchBookings();
  }, [isLoading, session, userData]);

  async function fetchBookings() {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/catering/bookings`, {
        headers: { Authorization: `Bearer ${session!.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to load orders");
        return;
      }
      const data = await res.json();
      setVendors(data.vendors || []);
      setBookings(data.bookings || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(booking: Booking, action: "accept" | "decline") {
    const previousBookings = bookings;
    const newStatus = action === "accept" ? "accepted" : "declined";
    
    // Optimistic update
    setBookings(bookings.map(b =>
      b.booking_id === booking.booking_id ? { ...b, status: newStatus as any } : b
    ));
    setActionBookingId(booking.booking_id);

    try {
      const res = await fetch(`${API_URL}/api/catering/bookings/${booking.booking_id}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session!.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        // Revert on error
        setBookings(previousBookings);
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(action === "accept" ? "Order accepted" : "Order declined");
    } catch {
      // Revert on network error
      setBookings(previousBookings);
      toast.error("Network error");
    } finally {
      setActionBookingId(null);
    }
  }

  const visibleBookings = vendorFilter === "all"
    ? bookings
    : bookings.filter(b => b.catering_id === vendorFilter);
  const pendingBookings  = visibleBookings.filter(b => b.status === "pending");
  const reviewedBookings = visibleBookings.filter(b => b.status !== "pending");

  const activeItems  = activeTab === "pending" ? pendingBookings  : reviewedBookings;
  const activePage   = activeTab === "pending" ? pendingPage       : reviewedPage;
  const totalPages   = Math.max(1, Math.ceil(activeItems.length / PAGE_SIZE));
  const pagedBookings = activeItems.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE);

  useEffect(() => {
    setPendingPage(1);
    setReviewedPage(1);
  }, [vendorFilter]);

  useEffect(() => {
    if (activeTab === "pending") setPendingPage(1);
    else setReviewedPage(1);
  }, [activeTab]);

  function BookingCard({ booking, showActions }: { booking: Booking; showActions: boolean }) {
    const contact = parseContact(booking.contact_details);
    const title = booking.event_title || `Order ${booking.booking_id}`;
    const submittedExact = formatSubmitted(booking.created_at);
    const eventDateLabel = formatEventDate(booking.event_date);

    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col lg:flex-row lg:items-start gap-5">
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 truncate">{title}</p>
              <StatusBadge status={booking.status} />
              {vendors.length > 1 && booking.catering_name && (
                <span className="text-[11px] bg-blue-50 text-[#154CB3] border border-[#154CB3]/20 px-2 py-0.5 rounded-full font-medium">
                  {booking.catering_name}
                </span>
              )}
            </div>

            {/* Event + submitted meta */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {eventDateLabel && (
                <span className="flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                  Event: <span className="font-medium text-gray-700">{eventDateLabel}</span>
                </span>
              )}
              <span className="text-gray-400" title={submittedExact}>
                Submitted {timeAgo(booking.created_at)} · {submittedExact}
              </span>
              <span className="text-gray-400 font-mono text-[11px]">#{booking.booking_id}</span>
            </div>

            {/* Order description */}
            {booking.description && (
              <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Order details</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{booking.description}</p>
              </div>
            )}

            {/* Requester contact block */}
            <div className="rounded-lg border border-[#154CB3]/15 bg-[#154CB3]/5 px-3 py-2.5">
              <p className="text-[10px] font-semibold text-[#154CB3] uppercase tracking-wider mb-1.5">Requester contact</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Name</p>
                  <p className="text-gray-800 font-medium truncate">
                    {contact?.name || "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                  {contact?.email ? (
                    <a href={`mailto:${contact.email}`} className="text-[#154CB3] hover:underline truncate block">
                      {contact.email}
                    </a>
                  ) : (
                    <a href={`mailto:${booking.booked_by}`} className="text-[#154CB3] hover:underline truncate block">
                      {booking.booked_by}
                    </a>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Mobile</p>
                  {contact?.mobile ? (
                    <a href={`tel:${contact.mobile.replace(/\s+/g, "")}`} className="text-[#154CB3] hover:underline truncate block">
                      {contact.mobile}
                    </a>
                  ) : (
                    <p className="text-gray-400">—</p>
                  )}
                </div>
              </div>
              {contact?.email && booking.booked_by && safeLower(contact.email) !== safeLower(booking.booked_by) && (
                <p className="mt-1.5 text-[11px] text-gray-500">
                  Submitted by <span className="font-medium text-gray-700">{booking.booked_by}</span>
                </p>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:w-36 shrink-0">
              <button
                disabled={actionBookingId !== null && actionBookingId !== booking.booking_id}
                onClick={() => handleAction(booking, "decline")}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
              >
                {actionBookingId === booking.booking_id ? "…" : "Decline"}
              </button>
              <button
                disabled={actionBookingId !== null && actionBookingId !== booking.booking_id}
                onClick={() => handleAction(booking, "accept")}
                className="flex-1 px-3 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all"
              >
                {actionBookingId === booking.booking_id ? "…" : "Accept"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const acceptedCount = reviewedBookings.filter(b => b.status === "accepted").length;
  const declinedCount = reviewedBookings.filter(b => b.status === "declined").length;

  return (
    <div className="min-h-screen bg-[#faf8ff]">

      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#154CB3]/10 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#154CB3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#063168]">Catering Orders</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vendors.length > 1 && (
              <select
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="text-sm rounded-lg border border-gray-200 px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
              >
                <option value="all">All shops</option>
                {vendors.map(v => (
                  <option key={v.catering_id} value={v.catering_id}>{v.catering_name}</option>
                ))}
              </select>
            )}
            <button
              onClick={fetchBookings}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-[#154CB3] text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all disabled:opacity-50"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: visibleBookings.length, color: "text-[#063168]" },
            { label: "Pending", value: pendingBookings.length, color: "text-amber-600" },
            { label: "Accepted", value: acceptedCount, color: "text-green-600" },
            { label: "Declined", value: declinedCount, color: "text-red-500" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-500 font-medium mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{loading ? "—" : s.value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "pending" ? "bg-white text-[#154CB3] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Pending ({pendingBookings.length})
          </button>
          <button
            onClick={() => setActiveTab("reviewed")}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "reviewed" ? "bg-white text-[#154CB3] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            Reviewed ({reviewedBookings.length})
          </button>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading orders…</p>
        ) : activeItems.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">
              {activeTab === "pending" ? "No pending orders." : "No reviewed orders yet."}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {pagedBookings.map(b => (
                <BookingCard key={b.booking_id} booking={b} showActions={activeTab === "pending"} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                <span className="text-xs text-gray-500">Page {activePage} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={activePage <= 1}
                    onClick={() => activeTab === "pending" ? setPendingPage(p => p - 1) : setReviewedPage(p => p - 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >← Prev</button>
                  <button
                    disabled={activePage >= totalPages}
                    onClick={() => activeTab === "pending" ? setPendingPage(p => p + 1) : setReviewedPage(p => p + 1)}
                    className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40"
                  >Next →</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
