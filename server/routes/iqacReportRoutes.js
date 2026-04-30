import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireOrganiser,
} from "../middleware/authMiddleware.js";
import { generateIqacReport } from "../utils/generateIqacReport.js";
import { getFestTableForSupabase } from "../utils/festTableResolver.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveCreatedBy(val) {
  if (!val) return null;
  if (typeof val === "string") return val.trim();
  if (typeof val === "object" && val.event_creator) return String(val.event_creator).trim();
  return null;
}

async function fetchEntity(entityType, entityId) {
  if (entityType === "event") {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("event_id", entityId)
      .single();
    return { entity: data, error };
  }

  const festTable = await getFestTableForSupabase(supabase);
  const { data, error } = await supabase
    .from(festTable)
    .select("*")
    .eq("fest_id", entityId)
    .single();
  return { entity: data, error };
}

async function computeStats(entityType, entityId, entity) {
  if (entityType === "event") {
    // All registrations for this event
    const { data: regs } = await supabase
      .from("registrations")
      .select("id, participant_organization, registration_type, teammates")
      .eq("event_id", entityId);

    const regIds = (regs || []).map((r) => r.id);

    let attendedCount = 0;
    if (regIds.length > 0) {
      const { data: att } = await supabase
        .from("attendance_status")
        .select("registration_id, status")
        .in("registration_id", regIds)
        .eq("status", "attended");
      attendedCount = att ? att.length : 0;
    }

    let internal = 0;
    let external = 0;
    let total = 0;
    (regs || []).forEach((reg) => {
      const members =
        reg.registration_type === "team"
          ? (() => {
              try {
                return Array.isArray(reg.teammates)
                  ? reg.teammates.length
                  : JSON.parse(reg.teammates || "[]").length;
              } catch (_) {
                return 1;
              }
            })()
          : 1;
      total += members;
      if (reg.participant_organization === "outsider") {
        external += members;
      } else {
        internal += members;
      }
    });

    const volunteerCount = (() => {
      try {
        const vols = Array.isArray(entity.volunteers)
          ? entity.volunteers
          : JSON.parse(entity.volunteers || "[]");
        return vols.length;
      } catch (_) {
        return 0;
      }
    })();

    return {
      total_registered: regs ? regs.length : 0,
      total_participants: total,
      attended: attendedCount,
      absent: total - attendedCount,
      internal,
      external,
      volunteer_count: volunteerCount,
    };
  }

  // For fests — aggregate across all child events
  const { data: events } = await supabase
    .from("events")
    .select("event_id")
    .eq("fest_id", entityId);

  const eventIds = (events || []).map((e) => e.event_id);
  if (eventIds.length === 0) {
    return { total_registered: 0, total_participants: 0, attended: 0, absent: 0, internal: 0, external: 0, volunteer_count: 0 };
  }

  const { data: regs } = await supabase
    .from("registrations")
    .select("id, participant_organization, registration_type, teammates")
    .in("event_id", eventIds);

  const regIds = (regs || []).map((r) => r.id);
  let attendedCount = 0;
  if (regIds.length > 0) {
    const { data: att } = await supabase
      .from("attendance_status")
      .select("registration_id")
      .in("registration_id", regIds)
      .eq("status", "attended");
    attendedCount = att ? att.length : 0;
  }

  let internal = 0;
  let external = 0;
  let total = 0;
  (regs || []).forEach((reg) => {
    const members =
      reg.registration_type === "team"
        ? (() => {
            try {
              return Array.isArray(reg.teammates)
                ? reg.teammates.length
                : JSON.parse(reg.teammates || "[]").length;
            } catch (_) {
              return 1;
            }
          })()
        : 1;
    total += members;
    if (reg.participant_organization === "outsider") external += members;
    else internal += members;
  });

  return {
    total_registered: regs ? regs.length : 0,
    total_participants: total,
    attended: attendedCount,
    absent: total - attendedCount,
    internal,
    external,
    volunteer_count: 0,
    sub_events: eventIds.length,
  };
}

// ── Flatten DB row blobs → flat object for the frontend ─────────────────────

function flattenRow(row) {
  if (!row) return null;
  return {
    ...row,
    outcome_1: row.outcomes?.outcome_1 ?? null,
    outcome_2: row.outcomes?.outcome_2 ?? null,
    skill_course_mapping: row.relevance_mappings?.skill_course_mapping ?? [],
    pos_psos: row.relevance_mappings?.pos_psos ?? null,
    graduate_attributes: row.relevance_mappings?.graduate_attributes ?? null,
    contemporary_requirements: row.relevance_mappings?.contemporary_requirements ?? null,
    sdg_mapping: row.relevance_mappings?.sdg_mapping ?? [],
    submitted_by: row.submission_meta?.submitted_by ?? null,
    submitted_at: row.submission_meta?.submitted_at ?? null,
    updated_at: row.submission_meta?.updated_at ?? null,
  };
}

// ── Route guard: organiser of this entity or masteradmin ────────────────────

async function requireEntityAccess(req, res, next) {
  const { entityType, entityId } = req.params;

  if (!["event", "fest"].includes(entityType)) {
    return res.status(400).json({ error: "entityType must be 'event' or 'fest'" });
  }

  if (req.userInfo.is_masteradmin) return next();

  const { entity, error } = await fetchEntity(entityType, entityId);
  if (error || !entity) return res.status(404).json({ error: `${entityType} not found` });

  const owner = resolveCreatedBy(entity.created_by);
  if (owner !== req.userInfo.email) {
    return res.status(403).json({ error: "Access denied: you are not the organiser of this entity" });
  }

  req.entity = entity;
  next();
}

// ── GET /api/iqac-report/:entityType/:entityId ───────────────────────────────
// Returns existing post-event report data (or empty object if not yet started).

router.get(
  "/iqac-report/:entityType/:entityId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireEntityAccess,
  async (req, res) => {
    const { entityType, entityId } = req.params;
    try {
      const { data: row } = await supabase
        .from("iqac_post_event_reports")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();

      // Flatten blob columns back into a flat object for the frontend
      const report = row ? flattenRow(row) : null;
      return res.json({ report });
    } catch (err) {
      console.error("[IQAC] GET error:", err);
      return res.status(500).json({ error: "Failed to fetch IQAC report" });
    }
  }
);

// ── POST /api/iqac-report/:entityType/:entityId ──────────────────────────────
// Upserts post-event report data (save draft or final submit).

router.post(
  "/iqac-report/:entityType/:entityId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireEntityAccess,
  async (req, res) => {
    const { entityType, entityId } = req.params;
    const userEmail = req.userInfo.email;
    const now = new Date().toISOString();
    const {
      event_summary,
      outcome_1,
      outcome_2,
      goal_achievement,
      key_takeaways,
      impact_on_stakeholders,
      innovations_best_practices,
      skill_course_mapping,
      pos_psos,
      graduate_attributes,
      contemporary_requirements,
      sdg_mapping,
      suggestions,
      winners,
      submit,
    } = req.body;

    // Fetch existing row to preserve submitted_at if already set
    const { data: existing } = await supabase
      .from("iqac_post_event_reports")
      .select("submission_meta")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .maybeSingle();

    const existingMeta = existing?.submission_meta || {};

    try {
      const payload = {
        entity_type: entityType,
        entity_id: entityId,
        event_summary: event_summary ?? null,

        // outcomes blob
        outcomes: {
          outcome_1: outcome_1 ?? null,
          outcome_2: outcome_2 ?? null,
        },

        // analysis columns (flat — easy to query per-field)
        goal_achievement: goal_achievement ?? null,
        key_takeaways: key_takeaways ?? null,
        impact_on_stakeholders: impact_on_stakeholders ?? null,
        innovations_best_practices: innovations_best_practices ?? null,

        // relevance mappings blob
        relevance_mappings: {
          skill_course_mapping: skill_course_mapping ?? [],
          pos_psos: pos_psos ?? null,
          graduate_attributes: graduate_attributes ?? null,
          contemporary_requirements: contemporary_requirements ?? null,
          sdg_mapping: sdg_mapping ?? [],
        },

        suggestions: suggestions ?? null,
        winners: winners ?? null,

        // submission meta blob
        submission_meta: {
          submitted_by: userEmail,
          submitted_at: submit
            ? (existingMeta.submitted_at || now)
            : (existingMeta.submitted_at || null),
          updated_at: now,
        },
      };

      const { data, error } = await supabase
        .from("iqac_post_event_reports")
        .upsert(payload, { onConflict: "entity_type,entity_id" })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ report: flattenRow(data) });
    } catch (err) {
      console.error("[IQAC] POST error:", err);
      return res.status(500).json({ error: "Failed to save IQAC report" });
    }
  }
);

// ── GET /api/iqac-report/:entityType/:entityId/generate ──────────────────────
// Generates and streams a filled IQAC Activity Report .docx.

router.get(
  "/iqac-report/:entityType/:entityId/generate",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  requireEntityAccess,
  async (req, res) => {
    const { entityType, entityId } = req.params;
    try {
      // Fetch entity (may already be on req from requireEntityAccess)
      const { entity: rawEntity, error: entityErr } = await fetchEntity(entityType, entityId);
      if (entityErr || !rawEntity) {
        return res.status(404).json({ error: `${entityType} not found` });
      }

      // Fetch post-event report
      const { data: report } = await supabase
        .from("iqac_post_event_reports")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .maybeSingle();

      // Compute live stats
      const stats = await computeStats(entityType, entityId, rawEntity);

      const docBuffer = await generateIqacReport({
        event: rawEntity,
        report: report || {},
        stats,
        entityType,
      });

      const safeTitle = (rawEntity.title || rawEntity.fest_title || "IQAC_Report")
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60);

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_IQAC_Report.docx"`);
      return res.send(docBuffer);
    } catch (err) {
      console.error("[IQAC] GENERATE error:", err);
      return res.status(500).json({ error: "Failed to generate IQAC report" });
    }
  }
);

export default router;
