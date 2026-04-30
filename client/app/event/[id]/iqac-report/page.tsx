"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Download, Save, Plus, X, CheckCircle } from "lucide-react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CourseMapping {
  course_code: string;
  course_name: string;
  mapping_type: "LRNG" | "Skills" | "CrossCutting" | "";
}

interface SdgMapping {
  sdg_number: string;
  subject_code: string;
  subject_name: string;
}

interface Winner {
  position: string;
  name: string;
  register_number: string;
  team_name: string;
}

interface IqacReport {
  event_summary: string;
  outcome_1: string;
  outcome_2: string;
  goal_achievement: string;
  key_takeaways: string;
  impact_on_stakeholders: string;
  innovations_best_practices: string;
  skill_course_mapping: CourseMapping[];
  pos_psos: string;
  graduate_attributes: string;
  contemporary_requirements: string;
  sdg_mapping: SdgMapping[];
  suggestions: string;
  winners: Winner[];
  submitted_at?: string;
}

const EMPTY_REPORT: IqacReport = {
  event_summary: "",
  outcome_1: "",
  outcome_2: "",
  goal_achievement: "",
  key_takeaways: "",
  impact_on_stakeholders: "",
  innovations_best_practices: "",
  skill_course_mapping: [],
  pos_psos: "",
  graduate_attributes: "",
  contemporary_requirements: "",
  sdg_mapping: [],
  suggestions: "",
  winners: [],
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function TextArea({
  label,
  hint,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        placeholder="Type here..."
      />
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-[#1a3a6e] to-[#2d5fa6] px-6 py-3">
        <h2 className="text-sm font-bold text-white tracking-wide">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IqacReportPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { session, userData } = useAuth();
  const router = useRouter();

  const [event, setEvent] = useState<any>(null);
  const [report, setReport] = useState<IqacReport>(EMPTY_REPORT);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [eventEnded, setEventEnded] = useState(false);

  const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");

  // ── Fetch event + existing report ──────────────────────────────────────────

  useEffect(() => {
    if (!session?.access_token || !eventId) return;

    const load = async () => {
      try {
        const [evRes, rpRes] = await Promise.all([
          fetch(`${API_BASE}/api/events/${eventId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${API_BASE}/api/iqac-report/event/${eventId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        if (evRes.ok) {
          const evData = await evRes.json();
          setEvent(evData);
          const endDate = new Date(evData.end_date || evData.event_date);
          endDate.setHours(23, 59, 59, 999);
          setEventEnded(endDate < new Date());
        }

        if (rpRes.ok) {
          const rpData = await rpRes.json();
          if (rpData.report) {
            setReport({
              ...EMPTY_REPORT,
              ...rpData.report,
              skill_course_mapping: Array.isArray(rpData.report.skill_course_mapping)
                ? rpData.report.skill_course_mapping
                : [],
              sdg_mapping: Array.isArray(rpData.report.sdg_mapping)
                ? rpData.report.sdg_mapping
                : [],
              winners: Array.isArray(rpData.report.winners) ? rpData.report.winners : [],
            });
          }
        }
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [session?.access_token, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────

  const set = useCallback(
    (field: keyof IqacReport) => (value: any) =>
      setReport((prev) => ({ ...prev, [field]: value })),
    []
  );

  const saveDraft = async (submit = false) => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/iqac-report/event/${eventId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...report, submit }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } finally {
      setSaving(false);
    }
  };

  const downloadDocx = async () => {
    if (!session?.access_token) return;
    // Save latest state first
    await saveDraft();
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/iqac-report/event/${eventId}/generate`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${event?.title || "IQAC_Report"}_IQAC_Report.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate report. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── Course mapping helpers ─────────────────────────────────────────────────

  const addCourseRow = () =>
    set("skill_course_mapping")([
      ...report.skill_course_mapping,
      { course_code: "", course_name: "", mapping_type: "" },
    ]);

  const updateCourseRow = (idx: number, field: keyof CourseMapping, val: string) => {
    const updated = report.skill_course_mapping.map((r, i) =>
      i === idx ? { ...r, [field]: val } : r
    );
    set("skill_course_mapping")(updated);
  };

  const removeCourseRow = (idx: number) =>
    set("skill_course_mapping")(report.skill_course_mapping.filter((_, i) => i !== idx));

  // ── SDG mapping helpers ────────────────────────────────────────────────────

  const addSdgRow = () =>
    set("sdg_mapping")([
      ...report.sdg_mapping,
      { sdg_number: "", subject_code: "", subject_name: "" },
    ]);

  const updateSdgRow = (idx: number, field: keyof SdgMapping, val: string) => {
    const updated = report.sdg_mapping.map((r, i) =>
      i === idx ? { ...r, [field]: val } : r
    );
    set("sdg_mapping")(updated);
  };

  const removeSdgRow = (idx: number) =>
    set("sdg_mapping")(report.sdg_mapping.filter((_, i) => i !== idx));

  // ── Winners helpers ────────────────────────────────────────────────────────

  const addWinner = () =>
    set("winners")([
      ...report.winners,
      { position: "", name: "", register_number: "", team_name: "" },
    ]);

  const updateWinner = (idx: number, field: keyof Winner, val: string) => {
    const updated = report.winners.map((w, i) =>
      i === idx ? { ...w, [field]: val } : w
    );
    set("winners")(updated);
  };

  const removeWinner = (idx: number) =>
    set("winners")(report.winners.filter((_, i) => i !== idx));

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">Event not found.</p>
        <Link href="/manage" className="text-indigo-600 text-sm hover:underline">← Back to Manage</Link>
      </div>
    );
  }

  if (!eventEnded) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
          <span className="text-2xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold text-gray-800">Report Not Available Yet</h1>
        <p className="text-sm text-gray-500 text-center max-w-sm">
          The IQAC post-event report can only be filled after the event ends
          ({new Date(event.end_date || event.event_date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}).
        </p>
        <Link href="/manage" className="text-indigo-600 text-sm hover:underline">← Back to Manage</Link>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs text-gray-500">IQAC Activity Report</p>
              <h1 className="text-sm font-bold text-gray-800 leading-tight">{event.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={() => saveDraft()}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={downloadDocx}
              disabled={generating || saving}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#154CB3] text-white text-sm font-medium hover:bg-[#1240a0] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              {generating ? "Generating…" : "Download DOCX"}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Page 2: Summary & Outcomes ── */}
        <SectionCard title="SUMMARY OF THE OVERALL EVENT">
          <TextArea
            label="Event Summary"
            hint="Short summary of the event activities and highlights. Min 100 words recommended."
            value={report.event_summary}
            onChange={set("event_summary")}
            rows={5}
          />
        </SectionCard>

        <SectionCard title="OUTCOMES OF THE EVENT">
          <TextArea label="Outcome 1" value={report.outcome_1} onChange={set("outcome_1")} rows={2} />
          <TextArea label="Outcome 2" value={report.outcome_2} onChange={set("outcome_2")} rows={2} />
        </SectionCard>

        <SectionCard title="ANALYSIS">
          <TextArea
            label="Goal Achievement"
            hint="Were the event objectives met? Explain how and to what extent. Min 40 words."
            value={report.goal_achievement}
            onChange={set("goal_achievement")}
          />
          <TextArea
            label="Key Takeaways"
            hint="Summarise the key points and outcomes for participants. Min 40 words."
            value={report.key_takeaways}
            onChange={set("key_takeaways")}
          />
          <TextArea
            label="Impact on Stakeholders"
            hint="How did the event impact students, staff, industry, etc. Min 40 words."
            value={report.impact_on_stakeholders}
            onChange={set("impact_on_stakeholders")}
          />
          <TextArea
            label="Innovations / Best Practices"
            hint="What worked well? What was unique or impactful? Min 40 words."
            value={report.innovations_best_practices}
            onChange={set("innovations_best_practices")}
          />
        </SectionCard>

        {/* ── Page 3: Relevance Mappings ── */}
        <SectionCard title="RELEVANCE — SKILL / LEARNING MAPPING">
          <p className="text-xs text-gray-500">
            Map this event to course(s). Mapping type: LRNG = Learning outcome, Skills = Skill development, CrossCutting = Cross-cutting issue.
          </p>
          <div className="space-y-2">
            {report.skill_course_mapping.length === 0 && (
              <p className="text-xs text-gray-400 italic">No courses mapped yet.</p>
            )}
            {report.skill_course_mapping.map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                <input
                  value={row.course_code}
                  onChange={(e) => updateCourseRow(idx, "course_code", e.target.value)}
                  placeholder="Course Code"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  value={row.course_name}
                  onChange={(e) => updateCourseRow(idx, "course_name", e.target.value)}
                  placeholder="Course Name"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="flex gap-1">
                  <select
                    value={row.mapping_type}
                    onChange={(e) => updateCourseRow(idx, "mapping_type", e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
                  >
                    <option value="">Type</option>
                    <option value="LRNG">LRNG</option>
                    <option value="Skills">Skills</option>
                    <option value="CrossCutting">CrossCutting</option>
                  </select>
                  <button type="button" onClick={() => removeCourseRow(idx)} className="text-gray-400 hover:text-red-500 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addCourseRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add course mapping
            </button>
          </div>
        </SectionCard>

        <SectionCard title="RELEVANCE — POs, PSOs & GRADUATE ATTRIBUTES">
          <TextArea
            label="Programme Outcomes (POs) & Programme Specific Outcomes (PSOs)"
            hint="List POs/PSOs this event maps to."
            value={report.pos_psos}
            onChange={set("pos_psos")}
            rows={3}
          />
          <TextArea
            label="Local / Regional / National / Global Needs & Graduate Attributes"
            value={report.graduate_attributes}
            onChange={set("graduate_attributes")}
            rows={3}
          />
          <TextArea
            label="Contemporary Requirements (Employability / Entrepreneurship / Skill Development)"
            value={report.contemporary_requirements}
            onChange={set("contemporary_requirements")}
            rows={3}
          />
        </SectionCard>

        <SectionCard title="RELEVANCE — SDG MAPPING">
          <p className="text-xs text-gray-500">
            Map with SDG number, subject code, and subject name.
          </p>
          <div className="space-y-2">
            {report.sdg_mapping.length === 0 && (
              <p className="text-xs text-gray-400 italic">No SDG mapping added yet.</p>
            )}
            {report.sdg_mapping.map((row, idx) => (
              <div key={idx} className="grid grid-cols-3 gap-2 items-center">
                <input
                  value={row.sdg_number}
                  onChange={(e) => updateSdgRow(idx, "sdg_number", e.target.value)}
                  placeholder="SDG No. (e.g. 4)"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <input
                  value={row.subject_code}
                  onChange={(e) => updateSdgRow(idx, "subject_code", e.target.value)}
                  placeholder="Subject Code"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <div className="flex gap-1">
                  <input
                    value={row.subject_name}
                    onChange={(e) => updateSdgRow(idx, "subject_name", e.target.value)}
                    placeholder="Subject Name"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button type="button" onClick={() => removeSdgRow(idx)} className="text-gray-400 hover:text-red-500 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addSdgRow}
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add SDG mapping
            </button>
          </div>
        </SectionCard>

        {/* Suggestions */}
        <SectionCard title="SUGGESTIONS FOR IMPROVEMENT">
          <TextArea
            label="Suggestions"
            hint="Include observations from review meetings or stakeholder feedback."
            value={report.suggestions}
            onChange={set("suggestions")}
            rows={4}
          />
        </SectionCard>

        {/* Winners — shown only if event has prizes */}
        {(event.prizes?.length > 0 || report.winners.length > 0) && (
          <SectionCard title="WINNERS / RESULTS (Competition Events)">
            <div className="space-y-2">
              {report.winners.length === 0 && (
                <p className="text-xs text-gray-400 italic">No winners added yet.</p>
              )}
              {report.winners.map((w, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-center">
                  <input
                    value={w.position}
                    onChange={(e) => updateWinner(idx, "position", e.target.value)}
                    placeholder="Position (e.g. 1st)"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    value={w.name}
                    onChange={(e) => updateWinner(idx, "name", e.target.value)}
                    placeholder="Name"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    value={w.register_number}
                    onChange={(e) => updateWinner(idx, "register_number", e.target.value)}
                    placeholder="Register No."
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <div className="flex gap-1">
                    <input
                      value={w.team_name}
                      onChange={(e) => updateWinner(idx, "team_name", e.target.value)}
                      placeholder="Team Name"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button type="button" onClick={() => removeWinner(idx)} className="text-gray-400 hover:text-red-500 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addWinner}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add winner
              </button>
            </div>
          </SectionCard>
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <button
            onClick={() => saveDraft()}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={downloadDocx}
            disabled={generating || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#154CB3] text-white text-sm font-semibold hover:bg-[#1240a0] disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {generating ? "Generating…" : "Download IQAC Report (.docx)"}
          </button>
        </div>
      </div>
    </div>
  );
}
