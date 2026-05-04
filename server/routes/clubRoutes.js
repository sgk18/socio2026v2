import express from "express";
import { queryOne, update } from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
} from "../middleware/authMiddleware.js";

const router = express.Router();

const normalizeRoles = (value) => {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return value.split(",");
          }
        })()
      : value;

  if (!Array.isArray(parsed)) return [];
  const seen = new Set();
  const roles = [];

  for (const item of parsed) {
    const role = String(item ?? "").trim();
    if (!role) continue;
    const key = role.toLowerCase();
    if (key === "member" || seen.has(key)) continue;
    seen.add(key);
    roles.push(role);
  }

  return roles;
};

const parseApplicants = (value) => {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value);
          } catch {
            return [];
          }
        })()
      : value;

  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return [parsed];
  return [];
};

router.post(
  "/:clubId/apply",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const clubId = String(req.params.clubId || "").trim();
      const selectedRole = String(req.body?.role || "").trim();

      if (!clubId) {
        return res.status(400).json({ error: "Club ID is required." });
      }

      if (!selectedRole) {
        return res.status(400).json({ error: "Role is required." });
      }

      if (!req.userInfo) {
        return res.status(401).json({ error: "User info not available." });
      }

      const registerNumber = String(req.userInfo.register_number || "").trim();
      const applicantEmail = String(req.userInfo.email || req.user?.email || "")
        .trim()
        .toLowerCase();
      if (!registerNumber) {
        return res.status(400).json({
          error: "Register number is missing in your profile.",
        });
      }

      if (registerNumber.toUpperCase().startsWith("VIS")) {
        return res.status(403).json({
          error: "Please login through your university email to apply.",
          code: "VISITOR_NOT_ELIGIBLE",
        });
      }

      const club = await queryOne("clubs", { where: { club_id: clubId } });
      if (!club) {
        return res.status(404).json({ error: "Club not found." });
      }

      if (!club.club_registrations) {
        return res.status(403).json({ error: "Applications are currently closed." });
      }

      const availableRoles = normalizeRoles(club.club_roles_available);
      if (availableRoles.length === 0) {
        return res.status(400).json({ error: "No roles are available for this club." });
      }

      const matchedRole =
        availableRoles.find(
          (role) => role.toLowerCase() === selectedRole.toLowerCase()
        ) || null;
      if (!matchedRole) {
        return res.status(400).json({ error: "Selected role is invalid." });
      }

      const existingApplicants = parseApplicants(
        club.clubs_applicants ?? club.clubs_applicant
      );
      const normalizedRegisterNumber = registerNumber.toUpperCase();
      const alreadyApplied = existingApplicants.some(
        (entry) =>
          String(entry?.regno || "")
            .trim()
            .toUpperCase() === normalizedRegisterNumber ||
          String(entry?.email || "")
            .trim()
            .toLowerCase() === applicantEmail
      );

      if (alreadyApplied) {
        return res.status(409).json({
          error: "You have already applied for this club.",
          code: "ALREADY_APPLIED",
        });
      }

      const applicantName = String(
        req.userInfo.name ||
          req.user?.user_metadata?.full_name ||
          req.user?.user_metadata?.name ||
          applicantEmail.split("@")[0] ||
          "Applicant"
      ).trim();

      const applicantPayload = {
        regno: registerNumber,
        name: applicantName,
        email: applicantEmail,
        role_applied_for: matchedRole,
        applied_at: new Date().toISOString(),
      };

      const nextApplicants = [...existingApplicants, applicantPayload];
      await update("clubs", { clubs_applicants: nextApplicants }, { club_id: clubId });

      return res.status(201).json({
        message: "Application submitted successfully.",
        applicant: applicantPayload,
      });
    } catch (error) {
      console.error("Error submitting club application:", error);
      return res
        .status(500)
        .json({ error: "Failed to submit application. Please try again." });
    }
  }
);

router.post(
  "/:clubId/remove-applicant",
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  async (req, res) => {
    try {
      const clubId = String(req.params.clubId || "").trim();
      const applicantRegno = String(req.body?.regno || "").trim();
      const applicantEmail = String(req.body?.email || "").trim().toLowerCase();

      if (!clubId) {
        return res.status(400).json({ error: "Club ID is required." });
      }

      if (!applicantRegno && !applicantEmail) {
        return res.status(400).json({ error: "Applicant identification is required." });
      }

      if (!req.userInfo) {
        return res.status(401).json({ error: "User info not available." });
      }

      const club = await queryOne("clubs", { where: { club_id: clubId } });
      if (!club) {
        return res.status(404).json({ error: "Club not found." });
      }

      const editors = Array.isArray(club.club_editors) ? club.club_editors : [];
      const currentUserEmail = String(req.userInfo.email || req.user?.email || "")
        .trim()
        .toLowerCase();
      const isEditor = editors.some(
        (editor) => String(editor || "").trim().toLowerCase() === currentUserEmail
      );

      if (!isEditor) {
        return res.status(403).json({ error: "Only club editors can remove applicants." });
      }

      const existingApplicants = parseApplicants(
        club.clubs_applicants ?? club.clubs_applicant
      );

      const applicantIndex = existingApplicants.findIndex((entry) => {
        const entryRegno = String(entry?.regno || "").trim().toUpperCase();
        const entryEmail = String(entry?.email || "").trim().toLowerCase();
        return (
          (applicantRegno && entryRegno === applicantRegno.toUpperCase()) ||
          (applicantEmail && entryEmail === applicantEmail)
        );
      });

      if (applicantIndex === -1) {
        return res.status(404).json({ error: "Applicant not found." });
      }

      const removedApplicant = existingApplicants[applicantIndex];
      const nextApplicants = existingApplicants.filter((_, idx) => idx !== applicantIndex);

      await update("clubs", { clubs_applicants: nextApplicants }, { club_id: clubId });

      return res.status(200).json({
        message: "Applicant removed successfully.",
        removedApplicant,
      });
    } catch (error) {
      console.error("Error removing club applicant:", error);
      return res
        .status(500)
        .json({ error: "Failed to remove applicant. Please try again." });
    }
  }
);

export default router;
