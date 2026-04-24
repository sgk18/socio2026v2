import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
  requireOrganiser,
} from "../middleware/authMiddleware.js";
import { sendPushToEmail } from "../utils/webPushService.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const router = express.Router();

// Resolve organiser email from events.created_by (text or jsonb)
function resolveCreatedByEmail(createdBy) {
  if (!createdBy) return null;
  if (typeof createdBy === "string") return createdBy.trim();
  if (typeof createdBy === "object" && createdBy.event_creator) {
    return String(createdBy.event_creator).trim();
  }
  return null;
}

// ─── POST /api/feedbacks/:eventId/send ───────────────────────────────────────
// Organiser sends feedback notifications to all registered participants.
// Gated: event must have ended >= 7 days ago. One-shot per event.

router.post(
  "/feedbacks/:eventId/send",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("event_id, title, created_by, event_date, end_date, feedback_sent_at")
        .eq("event_id", eventId)
        .single();

      if (eventError || !event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const ownerEmail = resolveCreatedByEmail(event.created_by);
      if (ownerEmail !== req.userInfo.email && !req.userInfo.is_masteradmin) {
        return res.status(403).json({ error: "You can only send feedback forms for events you created" });
      }

      if (event.feedback_sent_at) {
        return res.status(409).json({ error: "Feedback form already sent for this event" });
      }

      const endDateStr = event.end_date || event.event_date;
      if (!endDateStr) {
        return res.status(400).json({ error: "Event has no date set" });
      }

      const endDateTime = new Date(endDateStr);
      endDateTime.setHours(23, 59, 59, 999);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      if (endDateTime > sevenDaysAgo) {
        return res.status(400).json({
          error: "Feedback form can only be sent 7 or more days after the event ends",
          event_ends: endDateStr,
        });
      }

      const { data: registrations, error: regError } = await supabase
        .from("registrations")
        .select("user_email, individual_email")
        .eq("event_id", eventId);

      if (regError) throw regError;

      if (!registrations || registrations.length === 0) {
        return res.status(400).json({ error: "No registered participants found for this event" });
      }

      const emails = new Set();
      for (const reg of registrations) {
        const email = reg.individual_email || reg.user_email;
        if (email) emails.add(email);
      }

      const now = new Date().toISOString();

      const notifications = Array.from(emails).map((email) => ({
        title: `Feedback for ${event.title}`,
        message: `How was the event? Please share your feedback — it only takes a minute.`,
        type: "feedback_form",
        event_id: eventId,
        event_title: event.title,
        action_url: `/feedback/${eventId}`,
        user_email: email,
        is_broadcast: false,
        read: false,
      }));

      const { error: notifError } = await supabase
        .from("notifications")
        .insert(notifications);

      if (notifError) throw notifError;

      const { error: updateError } = await supabase
        .from("events")
        .update({ feedback_sent_at: now })
        .eq("event_id", eventId);

      if (updateError) throw updateError;

      for (const email of emails) {
        sendPushToEmail(email, {
          title: `Feedback for ${event.title}`,
          body: `How was the event? Please share your feedback — it only takes a minute.`,
          tag: `feedback_${eventId}`,
          actionUrl: `/feedback/${eventId}`,
        }).catch(() => {});
      }

      console.log(
        `[FEEDBACK] Sent feedback notifications for event "${event.title}" to ${emails.size} participants`
      );

      return res.json({ sent: emails.size, feedback_sent_at: now });
    } catch (error) {
      console.error("Error sending feedback notifications:", error);
      return res.status(500).json({ error: "Failed to send feedback notifications" });
    }
  }
);

// ─── GET /api/feedbacks/:eventId/check ──────────────────────────────────────
// Participant checks if they have already submitted feedback for this event.

router.get(
  "/feedbacks/:eventId/check",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const reg_no =
        req.userInfo.register_number ||
        req.userInfo.visitor_id ||
        req.userInfo.email;

      const { data, error } = await supabase
        .from("feedbacks")
        .select("id")
        .eq("event_id", eventId)
        .eq("reg_no", reg_no)
        .maybeSingle();

      if (error) throw error;

      return res.json({ submitted: !!data });
    } catch (error) {
      console.error("Error checking feedback status:", error);
      return res.status(500).json({ error: "Failed to check feedback status" });
    }
  }
);

// ─── POST /api/feedbacks/:eventId/submit ────────────────────────────────────
// Participant submits feedback. Verified: must be registered for the event.

router.post(
  "/feedbacks/:eventId/submit",
  authenticateUser,
  getUserInfo(),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      const { ratings } = req.body;

      if (!Array.isArray(ratings) || ratings.length !== 5) {
        return res.status(400).json({ error: "ratings must be an array of exactly 5 values" });
      }
      for (const r of ratings) {
        if (typeof r !== "number" || !Number.isInteger(r) || r < 1 || r > 5) {
          return res.status(400).json({ error: "Each rating must be an integer between 1 and 5" });
        }
      }

      const userEmail = req.userInfo.email;

      const { data: reg, error: regError } = await supabase
        .from("registrations")
        .select("registration_id")
        .eq("event_id", eventId)
        .or(`user_email.eq.${userEmail},individual_email.eq.${userEmail}`)
        .maybeSingle();

      if (regError) throw regError;
      if (!reg) {
        return res.status(403).json({ error: "You are not registered for this event" });
      }

      const reg_no =
        req.userInfo.register_number ||
        req.userInfo.visitor_id ||
        req.userInfo.email;

      const { error: insertError } = await supabase
        .from("feedbacks")
        .insert({ event_id: eventId, reg_no, data: { reg_no, ratings } });

      if (insertError) {
        if (insertError.code === "23505") {
          return res.status(409).json({ error: "You have already submitted feedback for this event" });
        }
        throw insertError;
      }

      // Mark any feedback_form notifications for this event as read for this user
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_email", userEmail)
        .eq("event_id", eventId)
        .eq("type", "feedback_form");

      console.log(`[FEEDBACK] Submission recorded for event ${eventId}, reg_no ${reg_no}`);
      return res.status(201).json({ success: true });
    } catch (error) {
      console.error("Error submitting feedback:", error);
      return res.status(500).json({ error: "Failed to submit feedback" });
    }
  }
);

// ─── GET /api/feedbacks/:eventId ─────────────────────────────────────────────
// Organiser views aggregates + raw submission table for an event they own.

router.get(
  "/feedbacks/:eventId",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  requireOrganiser,
  async (req, res) => {
    try {
      const { eventId } = req.params;

      const { data: event, error: eventError } = await supabase
        .from("events")
        .select("event_id, title, created_by, feedback_sent_at")
        .eq("event_id", eventId)
        .single();

      if (eventError || !event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const ownerEmail = resolveCreatedByEmail(event.created_by);
      if (ownerEmail !== req.userInfo.email && !req.userInfo.is_masteradmin) {
        return res.status(403).json({ error: "Access denied: you are not the organiser of this event" });
      }

      const { count: totalRegistered, error: countError } = await supabase
        .from("registrations")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId);

      if (countError) throw countError;

      const { data: feedbacks, error: fbError } = await supabase
        .from("feedbacks")
        .select("*")
        .eq("event_id", eventId)
        .order("submitted_at", { ascending: false });

      if (fbError) throw fbError;

      const submissions = feedbacks || [];
      const totalSubmissions = submissions.length;
      const registered = totalRegistered ?? 0;

      const questionAverages = [0, 1, 2, 3, 4].map((qIdx) => {
        if (totalSubmissions === 0) return "0.00";
        const sum = submissions.reduce((acc, fb) => {
          const r = Array.isArray(fb.data?.ratings) ? fb.data.ratings[qIdx] : 0;
          return acc + (typeof r === "number" ? r : 0);
        }, 0);
        return (sum / totalSubmissions).toFixed(2);
      });

      const overallAvg =
        totalSubmissions === 0
          ? "0.00"
          : (() => {
              const all = submissions.flatMap((fb) =>
                Array.isArray(fb.data?.ratings) ? fb.data.ratings : []
              );
              return all.length > 0
                ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(2)
                : "0.00";
            })();

      const rows = submissions.map((fb) => ({
        reg_no: fb.reg_no,
        q1: fb.data?.ratings?.[0] ?? null,
        q2: fb.data?.ratings?.[1] ?? null,
        q3: fb.data?.ratings?.[2] ?? null,
        q4: fb.data?.ratings?.[3] ?? null,
        q5: fb.data?.ratings?.[4] ?? null,
        submitted_at: fb.submitted_at,
      }));

      return res.json({
        event: {
          event_id: event.event_id,
          title: event.title,
          feedback_sent_at: event.feedback_sent_at,
        },
        summary: {
          total_registered: registered,
          total_submissions: totalSubmissions,
          response_rate_pct:
            registered > 0
              ? ((totalSubmissions / registered) * 100).toFixed(1)
              : "0.0",
          question_averages: questionAverages,
          overall_average: overallAvg,
        },
        rows,
      });
    } catch (error) {
      console.error("Error fetching feedback:", error);
      return res.status(500).json({ error: "Failed to fetch feedback" });
    }
  }
);

export default router;
