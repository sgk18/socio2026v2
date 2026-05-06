import express from "express";
import supabase from "../config/supabaseClient.js";

const router = express.Router();

const ALLOWED_CATEGORIES = new Set([
  "account",
  "events",
  "technical",
  "mobile",
  "organizer"
]);

const safeText = (value, fallback = "") => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

router.get("/support/articles", async (req, res) => {
  try {
    const categoryParam = safeText(req.query.category).trim().toLowerCase();
    const searchParam = safeText(req.query.search).trim().toLowerCase();

    if (categoryParam && categoryParam !== "all" && !ALLOWED_CATEGORIES.has(categoryParam)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category filter."
      });
    }

    let query = supabase
      .from("support_articles")
      .select("id, category, title, description, read_time_minutes, helpful_count, created_at")
      .eq("status", "published")
      .order("created_at", { ascending: false });

    if (categoryParam && categoryParam !== "all") {
      query = query.eq("category", categoryParam);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching support articles:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load support articles right now."
      });
    }

    let articles = Array.isArray(data) ? data : [];

    if (searchParam) {
      articles = articles.filter((article) => {
        const title = safeText(article?.title).toLowerCase();
        const description = safeText(article?.description).toLowerCase();
        return title.includes(searchParam) || description.includes(searchParam);
      });
    }

    return res.status(200).json({ success: true, articles });
  } catch (error) {
    console.error("Error loading support articles:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load support articles right now."
    });
  }
});

router.get("/support/articles/:id", async (req, res) => {
  try {
    const rawId = safeText(req.params.id).trim();
    const id = Number.parseInt(rawId, 10);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid article id."
      });
    }

    const { data, error } = await supabase
      .from("support_articles")
      .select("id, category, title, description, content, read_time_minutes, helpful_count, created_at, updated_at")
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({ success: false, message: "Article not found." });
      }

      console.error("Error fetching support article:", error);
      return res.status(500).json({
        success: false,
        message: "Unable to load support article right now."
      });
    }

    return res.status(200).json({ success: true, article: data });
  } catch (error) {
    console.error("Error loading support article:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load support article right now."
    });
  }
});

export default router;
