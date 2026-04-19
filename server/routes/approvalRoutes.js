import express from "express";
import { queryAll, queryOne, insert, update } from "../config/database.js";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireMasterAdmin,
} from "../middleware/authMiddleware.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchItemMeta(itemId, type) {
  if (type === "event") {
    return queryOne("events", { where: { event_id: itemId } });
  }
  return queryOne("fests", { where: { fest_id: itemId } });
}

async function findHodForSchool(school) {
  if (!school) return null;
  const rows = await queryAll("users", {
    where: { is_hod: true, school },
    limit: 1,
  });
  return rows[0] || null;
}

async function findDeanForSchool(school) {
  if (!school) return null;
  const rows = await queryAll("users", {
    where: { is_dean: true, school },
    limit: 1,
  });
  return rows[0] || null;
}

async function setEventOrFestLive(itemId, type) {
  const table = type === "event" ? "events" : "fests";
  const idField = type === "event" ? "event_id" : "fest_id";
  await update(table, { is_draft: false }, { [idField]: itemId });
}

async function sendApprovalNotification(targetEmail, title, message) {
  try {
    await insert("notifications", {
      title,
      message,
      target_email: targetEmail,
      type: "approval",
    });
  } catch (err) {
    console.warn("[Approvals] Notification insert failed (non-critical):", err?.message);
  }
}

function appendActionLog(existingLog, entry) {
  const log = Array.isArray(existingLog) ? existingLog : [];
  return [...log, { ...entry, at: new Date().toISOString() }];
}

// Check if Phase 1 is complete for this approval record
// Phase 1 scope: hod + dean must both be approved (or skipped)
function isPhase1Complete(record) {
  const done = (v) => v === "approved" || v === "skipped";
  return done(record.stage1_hod) && done(record.stage2_dean);
}

// ---------------------------------------------------------------------------
// POST /api/approvals – Submit item for approval
// ---------------------------------------------------------------------------
router.post(
  "/approvals",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId, type } = req.body;

      if (!itemId || !type || !["event", "fest"].includes(type)) {
        return res.status(400).json({ error: "itemId and type ('event' or 'fest') are required" });
      }

      // Prevent duplicate submission
      const existing = await queryOne("approvals", {
        where: { event_or_fest_id: itemId, type },
      });
      if (existing) {
        return res.status(409).json({
          error: "Approval request already exists for this item",
          approvalId: existing.id,
        });
      }

      const item = await fetchItemMeta(itemId, type);
      if (!item) {
        return res.status(404).json({ error: `${type} not found` });
      }

      // Ownership check (creator or masteradmin)
      const isCreator =
        (item.auth_uuid && item.auth_uuid === req.userId) ||
        (item.created_by && item.created_by === req.userInfo.email);
      if (!isCreator && !req.userInfo.is_masteradmin) {
        return res.status(403).json({ error: "Only the creator can submit this item for approval" });
      }

      const orgDept = item.organizing_dept || null;
      const orgSchool = item.organizing_school || null;
      const parentFestId = item.fest_id || null;

      // Check if this is an under-fest event whose parent already completed Stage 1
      let allStage1Skipped = false;
      if (type === "event" && parentFestId) {
        const parentApproval = await queryOne("approvals", {
          where: { event_or_fest_id: parentFestId, type: "fest" },
        });
        if (parentApproval && parentApproval.current_stage === 2) {
          allStage1Skipped = true;
        }
      }

      // Auto-assign HOD and Dean
      const hodUser = allStage1Skipped ? null : await findHodForSchool(orgSchool);
      const deanUser = allStage1Skipped ? null : await findDeanForSchool(orgSchool);

      const nowIso = new Date().toISOString();

      const newRecord = {
        event_or_fest_id: itemId,
        type,
        parent_fest_id: parentFestId,
        organizing_department_snapshot: orgDept,
        organizing_school_snapshot: orgSchool,
        submitted_by: req.userInfo.email,

        stage1_hod: allStage1Skipped ? "skipped" : "pending",
        stage2_dean: allStage1Skipped ? "skipped" : "pending",
        stage3_cfo: allStage1Skipped ? "skipped" : "pending",
        stage4_accounts: allStage1Skipped ? "skipped" : "pending",

        current_stage: allStage1Skipped ? 2 : 1,
        went_live_at: allStage1Skipped ? nowIso : null,

        stage1_hod_assignee_user_id: hodUser ? hodUser.id : null,
        stage1_hod_routing_state: hodUser ? "assigned" : "waiting_for_assignment",

        stage2_dean_assignee_user_id: deanUser ? deanUser.id : null,
        stage2_dean_routing_state: deanUser ? "assigned" : "waiting_for_assignment",

        action_log: [],
      };

      const [created] = await insert("approvals", newRecord);

      // Auto go-live for under-fest events with inherited Stage 1
      if (allStage1Skipped) {
        await setEventOrFestLive(itemId, type);
      }

      // Notify assigned approvers
      if (hodUser) {
        await sendApprovalNotification(
          hodUser.email,
          "New Approval Request",
          `An ${type} "${item.title || item.fest_title}" requires your approval as HOD.`
        );
      }

      console.log(`[Approvals] Created record for ${type} ${itemId} by ${req.userInfo.email}`);
      return res.status(201).json({ approval: created });
    } catch (error) {
      console.error("[Approvals] POST /approvals error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals – List all (masteradmin only)
// ---------------------------------------------------------------------------
router.get(
  "/approvals",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireMasterAdmin,
  async (req, res) => {
    try {
      const { unassigned, type, stage, page = 1, pageSize = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(pageSize);

      let query = supabase
        .from("approvals")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + parseInt(pageSize) - 1);

      if (type) query = query.eq("type", type);
      if (stage) query = query.eq("current_stage", parseInt(stage));
      if (unassigned === "true") {
        query = query.or(
          "stage1_hod_routing_state.eq.waiting_for_assignment,stage2_dean_routing_state.eq.waiting_for_assignment"
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;

      return res.json({ approvals: data, total: count, page: parseInt(page), pageSize: parseInt(pageSize) });
    } catch (error) {
      console.error("[Approvals] GET /approvals error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals/queue – Approver's own queue
// ---------------------------------------------------------------------------
router.get(
  "/approvals/queue",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const user = req.userInfo;
      const results = [];

      if (user.is_hod) {
        const { data } = await supabase
          .from("approvals")
          .select("*")
          .eq("stage1_hod_assignee_user_id", user.id)
          .eq("stage1_hod", "pending")
          .eq("current_stage", 1)
          .order("created_at", { ascending: true });
        if (data) results.push(...data.map((r) => ({ ...r, _queue_role: "hod" })));
      }

      if (user.is_dean) {
        const { data } = await supabase
          .from("approvals")
          .select("*")
          .eq("stage2_dean_assignee_user_id", user.id)
          .eq("stage2_dean", "pending")
          .eq("stage1_hod", "approved")
          .order("created_at", { ascending: true });
        if (data) results.push(...data.map((r) => ({ ...r, _queue_role: "dean" })));
      }

      // Enrich with item title
      const enriched = await Promise.all(
        results.map(async (r) => {
          try {
            const item = await fetchItemMeta(r.event_or_fest_id, r.type);
            return {
              ...r,
              item_title: item?.title || item?.fest_title || r.event_or_fest_id,
              item_date: item?.event_date || item?.opening_date || null,
            };
          } catch {
            return r;
          }
        })
      );

      return res.json({ queue: enriched });
    } catch (error) {
      console.error("[Approvals] GET /approvals/queue error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// GET /api/approvals/:itemId – Get approval record (creator or masteradmin)
// ---------------------------------------------------------------------------
router.get(
  "/approvals/:itemId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { type } = req.query;

      let record;
      if (type) {
        record = await queryOne("approvals", {
          where: { event_or_fest_id: itemId, type },
        });
      } else {
        // Try event first, then fest
        record =
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "event" } })) ||
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "fest" } }));
      }

      if (!record) {
        return res.status(404).json({ error: "Approval record not found" });
      }

      // Access: creator, assigned approver, or masteradmin
      const isCreator = record.submitted_by === req.userInfo.email;
      const isHodAssignee = record.stage1_hod_assignee_user_id === req.userInfo.id;
      const isDeanAssignee = record.stage2_dean_assignee_user_id === req.userInfo.id;
      const canView =
        isCreator ||
        isHodAssignee ||
        isDeanAssignee ||
        req.userInfo.is_masteradmin ||
        req.userInfo.is_hod ||
        req.userInfo.is_dean;

      if (!canView) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Enrich with item metadata
      const item = await fetchItemMeta(itemId, record.type);

      return res.json({
        approval: record,
        item: item
          ? {
              title: item.title || item.fest_title,
              type: record.type,
              organizing_dept: item.organizing_dept,
              organizing_school: item.organizing_school,
              event_date: item.event_date || item.opening_date,
              created_by: item.created_by,
            }
          : null,
      });
    } catch (error) {
      console.error("[Approvals] GET /approvals/:itemId error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/approvals/:itemId/action – Approve / Reject / Override
// ---------------------------------------------------------------------------
router.patch(
  "/approvals/:itemId/action",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { step, action, note, type } = req.body;

      if (!step || !action) {
        return res.status(400).json({ error: "step and action are required" });
      }
      if (!["approve", "reject"].includes(action)) {
        return res.status(400).json({ error: "action must be 'approve' or 'reject'" });
      }
      if (!["hod", "dean"].includes(step)) {
        return res.status(400).json({ error: "step must be 'hod' or 'dean' for Phase 1" });
      }

      const user = req.userInfo;
      const isMasterAdmin = user.is_masteradmin;

      let record;
      if (type) {
        record = await queryOne("approvals", { where: { event_or_fest_id: itemId, type } });
      } else {
        record =
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "event" } })) ||
          (await queryOne("approvals", { where: { event_or_fest_id: itemId, type: "fest" } }));
      }

      if (!record) {
        return res.status(404).json({ error: "Approval record not found" });
      }

      // Authorization per step
      if (step === "hod") {
        const isAssignedHod =
          user.is_hod && record.stage1_hod_assignee_user_id === user.id;
        if (!isAssignedHod && !isMasterAdmin) {
          return res.status(403).json({ error: "Only the assigned HOD or Master Admin can act on this step" });
        }
        if (record.stage1_hod !== "pending") {
          return res.status(409).json({ error: `HOD step is already ${record.stage1_hod}` });
        }
      }

      if (step === "dean") {
        const isAssignedDean =
          user.is_dean && record.stage2_dean_assignee_user_id === user.id;
        if (!isAssignedDean && !isMasterAdmin) {
          return res.status(403).json({ error: "Only the assigned Dean or Master Admin can act on this step" });
        }
        if (record.stage2_dean !== "pending") {
          return res.status(409).json({ error: `Dean step is already ${record.stage2_dean}` });
        }
        // Enforce sequential order: HOD must be approved first
        if (record.stage1_hod !== "approved" && record.stage1_hod !== "skipped") {
          return res.status(400).json({ error: "HOD must approve before Dean can act" });
        }
      }

      const newStatus = action === "approve" ? "approved" : "rejected";

      const updatedLog = appendActionLog(record.action_log, {
        step,
        action,
        by: user.name || user.email,
        byEmail: user.email,
        note: note || null,
        is_override: isMasterAdmin && step === "hod"
          ? !user.is_hod
          : isMasterAdmin && step === "dean"
          ? !user.is_dean
          : false,
      });

      const fieldMap = { hod: "stage1_hod", dean: "stage2_dean" };
      const updates = {
        [fieldMap[step]]: newStatus,
        action_log: updatedLog,
        last_action_by: user.email,
        last_action_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Check if Phase 1 is now complete after this action
      const simulatedRecord = { ...record, [fieldMap[step]]: newStatus };
      const phase1Complete = isPhase1Complete(simulatedRecord);

      if (action === "approve" && phase1Complete) {
        const nowIso = new Date().toISOString();
        updates.current_stage = 2;
        updates.went_live_at = nowIso;

        // Auto go-live
        await setEventOrFestLive(record.event_or_fest_id, record.type);
        console.log(`[Approvals] Phase 1 complete – ${record.type} ${record.event_or_fest_id} is now live`);

        // Notify creator
        if (record.submitted_by) {
          await sendApprovalNotification(
            record.submitted_by,
            "Your submission is live!",
            `Your ${record.type} has been approved and is now publicly visible.`
          );
        }
      }

      if (action === "reject" && record.submitted_by) {
        await sendApprovalNotification(
          record.submitted_by,
          "Approval update",
          `Your ${record.type} was returned by the ${step.toUpperCase()}${note ? `: ${note}` : "."}`
        );
      }

      const { data: updated, error: updateError } = await supabase
        .from("approvals")
        .update(updates)
        .eq("id", record.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.json({ approval: updated });
    } catch (error) {
      console.error("[Approvals] PATCH action error:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;
