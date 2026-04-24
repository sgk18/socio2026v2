import express from "express";
import {
  authenticateUser,
  checkRoleExpiration,
  getUserInfo,
  requireHOD,
} from "../middleware/authMiddleware.js";
import { buildHodAnalyticsSnapshot } from "../services/analyticsEngine.js";

const router = express.Router();

router.use(authenticateUser, getUserInfo(), checkRoleExpiration, requireHOD);

function resolveDepartment(req, res) {
  const dept = req.userInfo.department?.trim();
  if (!dept) {
    res.status(400).json({
      error: "Department not configured for this HOD account. Please contact admin.",
    });
    return null;
  }
  return dept;
}

async function getSnapshot(req, res) {
  const dept = resolveDepartment(req, res);
  if (!dept) return null;
  try {
    return await buildHodAnalyticsSnapshot(req.query, dept);
  } catch (err) {
    console.error("[HOD Analytics] Snapshot error:", err);
    res.status(500).json({
      error: "Failed to generate HOD analytics",
      details: err.message,
    });
    return null;
  }
}

router.get("/overview", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    dataQuality: s.dataQuality,
    kpis: s.overview.kpis,
    stats: s.overview.currentStats,
    previousStats: s.overview.previousStats,
    funnel: s.events.funnel,
    monthlyTrend: s.time.monthlyTrend,
    growthRate: s.time.growthRate,
    insights: s.overview.insights,
    activeTeachers: s.teachers.summary.activeTeachers,
    totalDeptEvents: s.dataQuality.events,
  });
});

router.get("/students", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    segmentation: s.students.segmentation,
    topEngaged: s.students.topEngaged,
    atRisk: s.students.atRisk,
    behavior: s.students.behavior,
    engagementScores: s.students.byStudent,
  });
});

router.get("/teachers", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    teachers: s.teachers,
  });
});

router.get("/events", async (req, res) => {
  const s = await getSnapshot(req, res);
  if (!s) return;
  return res.status(200).json({
    generatedAt: s.generatedAt,
    department: s.department,
    range: s.range,
    attendanceByEvent: s.events.attendanceByEvent,
    topEvents: s.events.topEvents,
    categoryPerformance: s.events.categoryPerformance,
    funnel: s.events.funnel,
    overallAttendanceRate: s.events.overallAttendanceRate,
  });
});

export default router;
