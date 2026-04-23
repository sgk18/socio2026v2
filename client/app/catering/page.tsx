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
  created_at: string;
}

function timeAgo(dateStr: string) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "accepted")
    return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Accepted</span>;
  if (status === "declined")
    return <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Declined</span>;
  return <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pending</span>;
}

export default function CateringDashboard() {
  const { session, userData, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [cateringId, setCateringId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionBookingId, setActionBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!session) { router.replace("/auth"); return; }
    const caters = (userData as any)?.caters;
    const isCaterer = caters?.is_catering === true;
    if (userData && !isCaterer && !(userData as any)?.is_masteradmin) {
      router.replace("/error");
      return;
    }
    fetchBookings();
  }, [authLoading, session, userData]);

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
      setCateringId(data.catering_id);
      setBookings(data.bookings || []);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(booking: Booking, action: "accept" | "decline") {
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
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Action failed");
        return;
      }
      toast.success(action === "accept" ? "Order accepted" : "Order declined");
      fetchBookings();
    } catch {
      toast.error("Network error");
    } finally {
      setActionBookingId(null);
    }
  }

  const pendingBookings = bookings.filter(b => b.status === "pending");
  const reviewedBookings = bookings.filter(b => b.status !== "pending");

  function BookingCard({ booking, showActions }: { booking: Booking; showActions: boolean }) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 truncate">
              {booking.event_title || booking.description || `Order ${booking.booking_id}`}
            </p>
            <StatusBadge status={booking.status} />
          </div>
          {booking.description && booking.event_title && (
            <p className="text-sm text-gray-600 mt-0.5">{booking.description}</p>
          )}
          <p className="text-sm text-gray-500 mt-0.5">
            Requested by <span className="font-medium text-gray-700">{booking.booked_by}</span>
            {booking.event_date ? ` · Event on ${booking.event_date}` : ""}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">Submitted {timeAgo(booking.created_at)}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {showActions && (
            <>
              <button
                disabled={actionBookingId === booking.booking_id}
                onClick={() => handleAction(booking, "decline")}
                className="px-3 py-1.5 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
              <button
                disabled={actionBookingId === booking.booking_id}
                onClick={() => handleAction(booking, "accept")}
                className="px-3 py-1.5 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {actionBookingId === booking.booking_id ? "…" : "Accept"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catering Orders</h1>
          <p className="text-gray-500 text-sm mt-1">
            Incoming orders for your catering service{cateringId ? ` (${cateringId})` : ""}.
          </p>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Loading orders…</p>
        ) : (
          <>
            {/* Pending */}
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">
                Pending <span className="text-gray-400 font-normal">({pendingBookings.length})</span>
              </h2>
              {pendingBookings.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
                  <p className="text-gray-400 text-sm">No pending orders.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingBookings.map(b => (
                    <BookingCard key={b.booking_id} booking={b} showActions />
                  ))}
                </div>
              )}
            </section>

            {/* Reviewed */}
            {reviewedBookings.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">
                  Reviewed <span className="text-gray-400 font-normal">({reviewedBookings.length})</span>
                </h2>
                <div className="space-y-3">
                  {reviewedBookings.map(b => (
                    <BookingCard key={b.booking_id} booking={b} showActions={false} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
