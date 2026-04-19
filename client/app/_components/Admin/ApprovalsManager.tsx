"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import toast from "react-hot-toast";

interface ApprovalRow {
  id: string;
  event_or_fest_id: string;
  type: "event" | "fest";
  stage1_hod: string;
  stage2_dean: string;
  stage3_cfo: string;
  stage4_accounts: string;
  current_stage: number;
  went_live_at: string | null;
  created_at: string;
  submitted_by: string | null;
  organizing_department_snapshot: string | null;
  organizing_school_snapshot: string | null;
  stage1_hod_routing_state: string;
  stage2_dean_routing_state: string;
}

type FilterMode = "all" | "unassigned" | "stage1" | "stage2";

const STATUS_BADGE: Record<string, string> = {
  pending:  "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  skipped:  "bg-gray-100 text-gray-500",
};

function StatusDot({ status }: { status: string }) {
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function pendingDuration(createdAt: string) {
  const ms = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(ms / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "1d";
  return `${days}d`;
}

export default function ApprovalsManager() {
  const { session } = useAuth();
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [overrideModal, setOverrideModal] = useState<{
    itemId: string;
    type: string;
    step: string;
  } | null>(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    fetchApprovals();
  }, [filter, page, session]);

  async function fetchApprovals() {
    if (!session) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (filter === "unassigned") params.set("unassigned", "true");
      if (filter === "stage1") params.set("stage", "1");
      if (filter === "stage2") params.set("stage", "2");

      const res = await fetch(`${API_URL}/api/approvals?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { toast.error("Failed to load approvals"); return; }
      const data = await res.json();
      setApprovals(data.approvals || []);
      setTotal(data.total || 0);
    } catch {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleOverride(action: "approve" | "reject") {
    if (!overrideModal || !session) return;
    setIsOverriding(true);
    try {
      const res = await fetch(`${API_URL}/api/approvals/${overrideModal.itemId}/action`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          step: overrideModal.step,
          action,
          note: overrideNote || null,
          type: overrideModal.type,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Override failed");
        return;
      }
      toast.success(`Override applied: ${action}`);
      setOverrideModal(null);
      fetchApprovals();
    } catch {
      toast.error("Network error");
    } finally {
      setIsOverriding(false);
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-gray-900 flex-1">Approval Records</h2>
        <div className="flex gap-2 flex-wrap">
          {(["all", "unassigned", "stage1", "stage2"] as FilterMode[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`px-3 py-1 text-xs rounded-full border font-medium transition-colors ${
                filter === f
                  ? "bg-[#154CB3] text-white border-[#154CB3]"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {f === "all" ? "All" : f === "unassigned" ? "Unassigned" : f === "stage1" ? "Stage 1" : "Stage 2"}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500">{total} total</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : approvals.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No approval records found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((row) => {
            const needsHodAssignment = row.stage1_hod_routing_state === "waiting_for_assignment";
            const needsDeanAssignment = row.stage2_dean_routing_state === "waiting_for_assignment";
            const hasUnassigned = needsHodAssignment || needsDeanAssignment;
            const nextPendingStep =
              row.stage1_hod === "pending" ? "hod" : row.stage2_dean === "pending" ? "dean" : null;

            return (
              <div
                key={row.id}
                className={`bg-white rounded-xl border p-4 ${hasUnassigned ? "border-orange-200 bg-orange-50/30" : "border-gray-200"}`}
              >
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/approvals/${row.event_or_fest_id}?type=${row.type}`}
                        className="font-medium text-sm text-blue-700 hover:underline truncate"
                      >
                        {row.event_or_fest_id}
                      </Link>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full uppercase">
                        {row.type}
                      </span>
                      {hasUnassigned && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                          Unassigned
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.organizing_school_snapshot || "—"}
                      {row.organizing_department_snapshot ? ` · ${row.organizing_department_snapshot}` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      By {row.submitted_by || "—"} · {pendingDuration(row.created_at)} ago · Stage {row.current_stage}
                    </p>
                  </div>

                  {/* Step statuses */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">HOD:</span>
                    <StatusDot status={row.stage1_hod} />
                    <span className="text-xs text-gray-400 ml-1">Dean:</span>
                    <StatusDot status={row.stage2_dean} />
                  </div>

                  {/* Override button */}
                  {nextPendingStep && (
                    <button
                      onClick={() =>
                        setOverrideModal({
                          itemId: row.event_or_fest_id,
                          type: row.type,
                          step: nextPendingStep,
                        })
                      }
                      className="px-3 py-1 text-xs rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 shrink-0"
                    >
                      Override
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
          >
            Next →
          </button>
        </div>
      )}

      {/* Override modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Master Admin Override — {overrideModal.step.toUpperCase()}
            </h2>
            <p className="text-sm text-gray-600">
              This action will be audit-marked as a Master Admin override.
            </p>
            <textarea
              rows={3}
              value={overrideNote}
              onChange={(e) => setOverrideNote(e.target.value)}
              placeholder="Override reason (recommended)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setOverrideModal(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={isOverriding}
                onClick={() => handleOverride("reject")}
                className="px-4 py-2 text-sm border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50"
              >
                Override Reject
              </button>
              <button
                disabled={isOverriding}
                onClick={() => handleOverride("approve")}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isOverriding ? "…" : "Override Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
