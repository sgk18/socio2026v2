"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, Users, Calendar, Ticket, Star,
  ChevronRight, RotateCcw, Globe, Building2, Award, AlertTriangle,
  ArrowUpDown, Loader2, RefreshCw,
} from "lucide-react";
import {
  fetchDeanSummary, fetchDeanDepartments, fetchDeanFests,
  fetchDrillDepartments, fetchDrillFests, fetchDrillEvents, fetchDrillEventDetail,
  type DeanSummary, type DeanDeptRow, type DeanFestRow, type DeanHighlights,
  type DrillDept, type DrillFest, type DrillEvent, type DrillEventDetail,
} from "@/lib/deanAnalyticsApi";

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#0B0F17",
  panel:   "#121826",
  panel2:  "#0F1522",
  line:    "#1F2A3D",
  line2:   "#2A3850",
  ink:     "#E6EBF5",
  ink2:    "#A8B3C7",
  ink3:    "#6B7894",
  primary: "#5B8DEF",
  accent:  "#2DD4BF",
  good:    "#34D399",
  warn:    "#F59E0B",
  bad:     "#F87171",
  violet:  "#A78BFA",
};

const FB_QUESTIONS = [
  "Overall experience",
  "Content relevance",
  "Organisation",
  "Venue & logistics",
  "Likelihood to return",
];

// ── Tiny helpers ──────────────────────────────────────────────────────────────
function pct(n: number) { return `${n.toFixed(1)}%`; }
function fmt(n: number) { return n.toLocaleString("en-IN"); }
function rateColor(r: number) { return r >= 75 ? C.good : r >= 55 ? C.warn : C.bad; }
function fbColor(v: number) { return v >= 4.2 ? C.good : v >= 3.5 ? C.warn : C.bad; }

// ── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16 }} className={`p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span style={{ background: C.primary + "22", color: C.primary, fontSize: 12, fontWeight: 700, borderRadius: 8, padding: "2px 9px" }}>
        {n < 10 ? `0${n}` : n}
      </span>
      <h2 style={{ color: C.ink, fontSize: 15, fontWeight: 700 }}>{label}</h2>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string; sub?: string; color: string }) {
  return (
    <Card className="flex items-start gap-4">
      <div style={{ background: color + "22", color, borderRadius: 12, padding: 10, flexShrink: 0 }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p style={{ color: C.ink3, fontSize: 12, fontWeight: 500 }}>{label}</p>
        <p style={{ color: C.ink, fontSize: 22, fontWeight: 800, lineHeight: 1.2 }} className="num">{value}</p>
        {sub && <p style={{ color: C.ink3, fontSize: 11, marginTop: 2 }}>{sub}</p>}
      </div>
    </Card>
  );
}

// ── Insight Tile ─────────────────────────────────────────────────────────────
function InsightTile({ label, name, value, sub, tone }: { label: string; name: string; value: string; sub?: string; tone: "good" | "bad" | "neutral" }) {
  const color = tone === "good" ? C.good : tone === "bad" ? C.bad : C.primary;
  return (
    <Card>
      <p style={{ color: C.ink3, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ color: C.ink, fontSize: 14, fontWeight: 700, marginTop: 6, lineHeight: 1.3 }}>{name}</p>
      <p style={{ color, fontSize: 20, fontWeight: 800, marginTop: 4 }} className="num">{value}</p>
      {sub && <p style={{ color: C.ink3, fontSize: 11, marginTop: 2 }}>{sub}</p>}
    </Card>
  );
}

// ── Sortable table ────────────────────────────────────────────────────────────
type SortDir = "asc" | "desc";
function useSortable<T>(rows: T[], defaultKey: keyof T) {
  const [key, setKey] = useState<keyof T>(defaultKey);
  const [dir, setDir] = useState<SortDir>("desc");
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
      return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }, [rows, key, dir]);
  function toggle(k: keyof T) {
    if (k === key) setDir((d) => d === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  }
  return { sorted, key, dir, toggle };
}

function Th({ label, sortKey, current, dir, onToggle }: { label: string; sortKey: string; current: string; dir: SortDir; onToggle: (k: string) => void }) {
  const active = sortKey === current;
  return (
    <th
      onClick={() => onToggle(sortKey)}
      style={{ color: active ? C.primary : C.ink3, cursor: "pointer", padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right", whiteSpace: "nowrap", userSelect: "none" }}
    >
      <span className="flex items-center justify-end gap-1">
        {label}
        <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4 }} />
        {active && <span style={{ fontSize: 9 }}>{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// ── School-wide Analysis ─────────────────────────────────────────────────────
function SchoolAnalysis({ summary }: { summary: DeanSummary }) {
  const rate = summary.avgAttendanceRate;
  const health = rate >= 75 ? "strong" : rate >= 55 ? "moderate" : "needs attention";
  const healthColor = rate >= 75 ? C.good : rate >= 55 ? C.warn : C.bad;
  const insiderPct = summary.insiderOutsider.insiders + summary.insiderOutsider.outsiders > 0
    ? Math.round(summary.insiderOutsider.insiders / (summary.insiderOutsider.insiders + summary.insiderOutsider.outsiders) * 100)
    : 0;
  const topMonth = summary.monthlyTrend.length
    ? summary.monthlyTrend.reduce((a, b) => b.registrations > a.registrations ? b : a)
    : null;

  return (
    <Card className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Award size={16} style={{ color: C.primary }} />
        <h2 style={{ color: C.ink, fontSize: 14, fontWeight: 700 }}>School-wide Analysis</h2>
        <span style={{ background: healthColor + "22", color: healthColor, fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px", marginLeft: "auto" }}>
          {health.toUpperCase()}
        </span>
      </div>
      <p style={{ color: C.ink2, fontSize: 13, lineHeight: 1.7 }}>
        The institution has run <strong style={{ color: C.ink }}>{fmt(summary.totalEvents)} events</strong> across{" "}
        <strong style={{ color: C.ink }}>{summary.totalFests} fests</strong>, drawing{" "}
        <strong style={{ color: C.ink }}>{fmt(summary.totalRegistrations)} registrations</strong> with{" "}
        <strong style={{ color: healthColor }}>{pct(summary.avgAttendanceRate)} average attendance</strong> — a{" "}
        {health} engagement signal. The average feedback score is{" "}
        <strong style={{ color: fbColor(summary.avgFeedback) }}>{summary.avgFeedback.toFixed(1)} / 5</strong>.
        {" "}Participation is <strong style={{ color: C.ink }}>{insiderPct}% Christ members</strong> and{" "}
        <strong style={{ color: C.ink }}>{100 - insiderPct}% external participants</strong>.
        {topMonth && (
          <> Peak activity was in <strong style={{ color: C.ink }}>{topMonth.month}</strong> with{" "}
          <strong style={{ color: C.ink }}>{fmt(topMonth.registrations)}</strong> registrations.</>
        )}
      </p>
    </Card>
  );
}

// ── Drill-down wizard ─────────────────────────────────────────────────────────
type DrillStep = 1 | 2 | 3 | 4;

function DeptCard({ d, onClick }: { d: DrillDept; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.primary)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p style={{ color: C.ink, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{d.name}</p>
        <ChevronRight size={16} style={{ color: C.ink3, flexShrink: 0 }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["Fests", d.fests], ["Events", d.events], ["Regs", fmt(d.registrations)], ["Turnout", pct(d.attendanceRate)]].map(([l, v]) => (
          <div key={String(l)}>
            <p style={{ color: C.ink3, fontSize: 10, fontWeight: 600 }}>{l}</p>
            <p style={{ color: l === "Turnout" ? rateColor(d.attendanceRate) : C.ink, fontSize: 14, fontWeight: 700 }} className="num">{v}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function FestCard({ f, onClick }: { f: DrillFest; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.primary)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.line)}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <p style={{ color: C.ink, fontSize: 13, fontWeight: 700 }}>{f.name}</p>
        <ChevronRight size={16} style={{ color: C.ink3, flexShrink: 0 }} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[["Events", f.events], ["Regs", fmt(f.registrations)], ["Attended", fmt(f.attendance)], ["Turnout", pct(f.attendanceRate)]].map(([l, v]) => (
          <div key={String(l)}>
            <p style={{ color: C.ink3, fontSize: 10, fontWeight: 600 }}>{l}</p>
            <p style={{ color: l === "Turnout" ? rateColor(f.attendanceRate) : C.ink, fontSize: 14, fontWeight: 700 }} className="num">{v}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function EventCard({ e, onClick }: { e: DrillEvent; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
      onMouseEnter={(ev) => (ev.currentTarget.style.borderColor = C.primary)}
      onMouseLeave={(ev) => (ev.currentTarget.style.borderColor = C.line)}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p style={{ color: C.ink, fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{e.name}</p>
        <ChevronRight size={16} style={{ color: C.ink3, flexShrink: 0 }} />
      </div>
      <p style={{ color: C.ink3, fontSize: 11, marginBottom: 10 }}>{e.cat} · {e.date}</p>
      <div className="grid grid-cols-2 gap-2">
        {[["Regs", fmt(e.regs)], ["Turnout", pct(e.rate)]].map(([l, v]) => (
          <div key={String(l)}>
            <p style={{ color: C.ink3, fontSize: 10, fontWeight: 600 }}>{l}</p>
            <p style={{ color: l === "Turnout" ? rateColor(e.rate) : C.ink, fontSize: 14, fontWeight: 700 }} className="num">{v}</p>
          </div>
        ))}
      </div>
    </button>
  );
}

function EventDetail({ detail }: { detail: DrillEventDetail }) {
  const total = detail.insiders + detail.outsiders;
  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Registrations", v: fmt(detail.regs), c: C.primary },
          { l: "Attended", v: fmt(detail.attend), c: C.good },
          { l: "Turnout", v: pct(detail.rate), c: rateColor(detail.rate) },
          { l: "Feedback", v: detail.feedback.score > 0 ? `${detail.feedback.score.toFixed(1)}/5` : "—", c: fbColor(detail.feedback.score) },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px" }}>
            <p style={{ color: C.ink3, fontSize: 11, fontWeight: 600 }}>{l}</p>
            <p style={{ color: c, fontSize: 20, fontWeight: 800 }} className="num">{v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* About */}
        <Card>
          <p style={{ color: C.ink3, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>About this event</p>
          <p style={{ color: C.ink, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{detail.name}</p>
          <p style={{ color: C.ink3, fontSize: 11, marginBottom: 10 }}>{detail.cat} · {detail.date} · {detail.department}</p>
          {detail.description && <p style={{ color: C.ink2, fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>{detail.description}</p>}
          {total > 0 && (
            <>
              <p style={{ color: C.ink3, fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Participant mix</p>
              <div className="flex items-center gap-2 mb-2">
                <div style={{ flex: 1, background: C.line, borderRadius: 999, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${Math.round(detail.insiders / total * 100)}%`, background: C.primary, height: "100%" }} />
                </div>
                <span style={{ color: C.ink3, fontSize: 11, whiteSpace: "nowrap" }}>
                  {Math.round(detail.insiders / total * 100)}% inside
                </span>
              </div>
              <div className="flex gap-4">
                <span style={{ color: C.ink2, fontSize: 11 }}><span style={{ color: C.primary }}>■</span> Christ {fmt(detail.insiders)}</span>
                <span style={{ color: C.ink2, fontSize: 11 }}><span style={{ color: C.accent }}>■</span> External {fmt(detail.outsiders)}</span>
              </div>
            </>
          )}
        </Card>

        {/* Feedback */}
        <Card>
          <p style={{ color: C.ink3, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Feedback</p>
          {detail.feedback.count === 0 ? (
            <p style={{ color: C.ink3, fontSize: 12 }}>No feedback submissions yet.</p>
          ) : (
            <>
              <div className="flex items-end gap-3 mb-4">
                <p style={{ color: fbColor(detail.feedback.score), fontSize: 36, fontWeight: 900, lineHeight: 1 }} className="num">{detail.feedback.score.toFixed(1)}</p>
                <div>
                  <div className="flex gap-0.5 mb-1">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} size={12} style={{ color: s <= Math.round(detail.feedback.score) ? C.warn : C.line2, fill: s <= Math.round(detail.feedback.score) ? C.warn : "none" }} />
                    ))}
                  </div>
                  <p style={{ color: C.ink3, fontSize: 11 }}>{detail.feedback.count} responses</p>
                </div>
              </div>
              <div className="space-y-2">
                {(["q1","q2","q3","q4","q5"] as const).map((q, i) => {
                  const v = detail.feedback[q];
                  return (
                    <div key={q}>
                      <div className="flex justify-between mb-0.5">
                        <span style={{ color: C.ink3, fontSize: 11 }}>{FB_QUESTIONS[i]}</span>
                        <span style={{ color: fbColor(v), fontSize: 11, fontWeight: 700 }} className="num">{v.toFixed(1)}</span>
                      </div>
                      <div style={{ background: C.line, borderRadius: 999, height: 4, overflow: "hidden" }}>
                        <div style={{ width: `${(v / 5) * 100}%`, background: fbColor(v), height: "100%" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function DrillDown() {
  const [step, setStep] = useState<DrillStep>(1);
  const [selDept, setSelDept] = useState<DrillDept | null>(null);
  const [selFest, setSelFest] = useState<DrillFest | null>(null);
  const [selEvent, setSelEvent] = useState<DrillEvent | null>(null);

  const [depts, setDepts] = useState<DrillDept[]>([]);
  const [fests, setFests] = useState<DrillFest[]>([]);
  const [events, setEvents] = useState<DrillEvent[]>([]);
  const [eventDetail, setEventDetail] = useState<DrillEventDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchDrillDepartments()
      .then((d) => setDepts(d.departments))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function pickDept(d: DrillDept) {
    setSelDept(d); setLoading(true); setError(null);
    try {
      const data = await fetchDrillFests(d.name);
      setFests(data.fests); setStep(2);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function pickFest(f: DrillFest) {
    setSelFest(f); setLoading(true); setError(null);
    try {
      const data = await fetchDrillEvents(selDept!.name, f.id);
      setEvents(data.events); setStep(3);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  async function pickEvent(e: DrillEvent) {
    setSelEvent(e); setLoading(true); setError(null);
    try {
      const data = await fetchDrillEventDetail(e.id);
      setEventDetail(data.event); setStep(4);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function reset() { setStep(1); setSelDept(null); setSelFest(null); setSelEvent(null); setEventDetail(null); }
  function goStep(s: DrillStep) {
    if (s === 1) reset();
    else if (s === 2) { setStep(2); setSelFest(null); setSelEvent(null); setEventDetail(null); }
    else if (s === 3) { setStep(3); setSelEvent(null); setEventDetail(null); }
  }

  const stepLabels = ["Department", "Fest", "Event", "Detail"];
  const stepValues = [selDept?.name, selFest?.name, selEvent?.name, null];

  return (
    <Card>
      {/* Breadcrumb stepper */}
      <div className="flex items-center gap-1 mb-5 flex-wrap">
        {stepLabels.map((lbl, i) => {
          const s = (i + 1) as DrillStep;
          const done = step > s;
          const active = step === s;
          const canClick = done;
          return (
            <div key={lbl} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} style={{ color: C.ink3 }} />}
              <button
                disabled={!canClick}
                onClick={() => canClick && goStep(s)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 8, background: active ? C.primary + "22" : done ? C.line : "transparent", cursor: canClick ? "pointer" : "default", border: "none" }}
              >
                <span style={{ background: active ? C.primary : done ? C.good : C.ink3 + "44", color: active || done ? "#fff" : C.ink3, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                <span style={{ color: active ? C.primary : done ? C.ink2 : C.ink3, fontSize: 12, fontWeight: active ? 700 : 500 }}>
                  {done && stepValues[i] ? stepValues[i] : lbl}
                </span>
              </button>
            </div>
          );
        })}
        {step > 1 && (
          <button onClick={reset} style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, color: C.ink3, fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {error && <p style={{ color: C.bad, fontSize: 12, marginBottom: 12 }}>{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} style={{ color: C.primary, animation: "spin 1s linear infinite" }} />
        </div>
      ) : (
        <>
          {step === 1 && (
            <>
              <p style={{ color: C.ink3, fontSize: 12, marginBottom: 16 }}>Select a department to explore its fests and events.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {depts.map((d) => <DeptCard key={d.name} d={d} onClick={() => pickDept(d)} />)}
                {!depts.length && <p style={{ color: C.ink3, fontSize: 12 }}>No departments found.</p>}
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <p style={{ color: C.ink3, fontSize: 12, marginBottom: 16 }}>Fests with events from <strong style={{ color: C.ink }}>{selDept?.name}</strong>.</p>
              {!fests.length ? (
                <p style={{ color: C.ink3, fontSize: 12 }}>No fests found for this department.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {fests.map((f) => <FestCard key={f.id} f={f} onClick={() => pickFest(f)} />)}
                </div>
              )}
            </>
          )}
          {step === 3 && (
            <>
              <p style={{ color: C.ink3, fontSize: 12, marginBottom: 16 }}>Events from <strong style={{ color: C.ink }}>{selDept?.name}</strong> in <strong style={{ color: C.ink }}>{selFest?.name}</strong>.</p>
              {!events.length ? (
                <p style={{ color: C.ink3, fontSize: 12 }}>No events found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {events.map((e) => <EventCard key={e.id} e={e} onClick={() => pickEvent(e)} />)}
                </div>
              )}
            </>
          )}
          {step === 4 && eventDetail && <EventDetail detail={eventDetail} />}
        </>
      )}
    </Card>
  );
}

// ── Dept Table ────────────────────────────────────────────────────────────────
function DeptTable({ rows }: { rows: DeanDeptRow[] }) {
  const { sorted, key, dir, toggle } = useSortable(rows, "registrations");
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.line2}` }}>
            <th style={{ color: C.ink3, padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>Department</th>
            {(["events","registrations","attendance","attendanceRate"] as const).map((k) => (
              <Th key={k} label={k === "attendanceRate" ? "Rate" : k.charAt(0).toUpperCase() + k.slice(1)} sortKey={k} current={key as string} dir={dir} onToggle={(k) => toggle(k as keyof DeanDeptRow)} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.name} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? "transparent" : C.panel2 + "55" }}>
              <td style={{ color: C.ink, padding: "10px 12px", fontWeight: 500 }}>{r.name}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{r.events}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{fmt(r.registrations)}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{fmt(r.attendance)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <span style={{ color: rateColor(r.attendanceRate), fontWeight: 700 }} className="num">{pct(r.attendanceRate)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fest Table ────────────────────────────────────────────────────────────────
function FestTable({ rows }: { rows: DeanFestRow[] }) {
  const { sorted, key, dir, toggle } = useSortable(rows, "registrations");
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.line2}` }}>
            <th style={{ color: C.ink3, padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", textAlign: "left" }}>Fest</th>
            {(["events","registrations","attendance","attendanceRate","avgFeedback"] as const).map((k) => (
              <Th key={k} label={k === "attendanceRate" ? "Rate" : k === "avgFeedback" ? "Feedback" : k.charAt(0).toUpperCase() + k.slice(1)} sortKey={k} current={key as string} dir={dir} onToggle={(k) => toggle(k as keyof DeanFestRow)} />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} style={{ borderBottom: `1px solid ${C.line}`, background: i % 2 === 0 ? "transparent" : C.panel2 + "55" }}>
              <td style={{ color: C.ink, padding: "10px 12px", fontWeight: 500 }}>{r.name}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{r.events}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{fmt(r.registrations)}</td>
              <td style={{ color: C.ink2, padding: "10px 12px", textAlign: "right" }} className="num">{fmt(r.attendance)}</td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <span style={{ color: rateColor(r.attendanceRate), fontWeight: 700 }} className="num">{pct(r.attendanceRate)}</span>
              </td>
              <td style={{ padding: "10px 12px", textAlign: "right" }}>
                <span style={{ color: r.avgFeedback > 0 ? fbColor(r.avgFeedback) : C.ink3, fontWeight: 700 }} className="num">
                  {r.avgFeedback > 0 ? r.avgFeedback.toFixed(1) : "—"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function DeanAnalyticsDashboard() {
  const [summary, setSummary] = useState<DeanSummary | null>(null);
  const [depts, setDepts] = useState<DeanDeptRow[]>([]);
  const [fests, setFests] = useState<DeanFestRow[]>([]);
  const [highlights, setHighlights] = useState<DeanHighlights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, d, f] = await Promise.all([
        fetchDeanSummary(),
        fetchDeanDepartments(),
        fetchDeanFests(),
      ]);
      setSummary(s);
      setDepts(d.departments);
      setFests(f.fests);
      setHighlights(f.highlights);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="flex items-center gap-3">
          <Loader2 size={24} style={{ color: C.primary, animation: "spin 1s linear infinite" }} />
          <p style={{ color: C.ink2, fontSize: 14 }}>Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto", background: C.panel, border: `1px solid ${C.bad}33`, borderRadius: 16, padding: 24 }}>
          <p style={{ color: C.bad, fontWeight: 700, marginBottom: 8 }}>Failed to load analytics</p>
          <p style={{ color: C.ink2, fontSize: 13, marginBottom: 16 }}>{error}</p>
          <button onClick={load} style={{ background: C.primary, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const totalParticipants = summary.insiderOutsider.insiders + summary.insiderOutsider.outsiders;
  const donutData = totalParticipants > 0 ? [
    { name: "Christ members", value: summary.insiderOutsider.insiders, color: C.primary },
    { name: "External", value: summary.insiderOutsider.outsiders, color: C.accent },
  ] : [];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } .num { font-variant-numeric: tabular-nums; }`}</style>

      {/* Hero */}
      <div style={{ borderBottom: `1px solid ${C.line}`, padding: "20px 24px" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ color: C.ink, fontSize: 22, fontWeight: 800 }}>Dean Dashboard</h1>
              <p style={{ color: C.ink3, fontSize: 13, marginTop: 2 }}>Institution-wide event & fest analytics</p>
            </div>
            <button onClick={load} style={{ display: "flex", alignItems: "center", gap: 6, background: C.line, color: C.ink2, border: "none", borderRadius: 10, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 24px" }} className="space-y-8">

        {/* Section 1 — Drill-down */}
        <div>
          <SectionHeading n={1} label="Department → Fest → Event Explorer" />
          <DrillDown />
        </div>

        {/* School-wide analysis */}
        <SchoolAnalysis summary={summary} />

        {/* Section 2 — Top Summary */}
        <div>
          <SectionHeading n={2} label="Top Summary" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard icon={<Calendar size={18} />} label="Total Fests" value={String(summary.totalFests)} color={C.primary} />
            <KpiCard icon={<Ticket size={18} />} label="Total Events" value={String(summary.totalEvents)} color={C.violet} />
            <KpiCard icon={<Users size={18} />} label="Registrations" value={fmt(summary.totalRegistrations)} color={C.accent} />
            <KpiCard icon={<TrendingUp size={18} />} label="Attended" value={fmt(summary.totalAttended)} color={C.good} />
            <KpiCard icon={<TrendingDown size={18} />} label="Avg Attendance" value={pct(summary.avgAttendanceRate)} sub="institution-wide" color={rateColor(summary.avgAttendanceRate)} />
            <KpiCard icon={<Star size={18} />} label="Avg Feedback" value={summary.avgFeedback > 0 ? `${summary.avgFeedback.toFixed(1)}/5` : "—"} color={fbColor(summary.avgFeedback)} />
          </div>
        </div>

        {/* Section 3 — Trends */}
        <div>
          <SectionHeading n={3} label="Trends" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly trend */}
            <Card className="lg:col-span-2">
              <p style={{ color: C.ink2, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Monthly Registrations vs Attendance</p>
              {summary.monthlyTrend.length === 0 ? (
                <p style={{ color: C.ink3, fontSize: 12 }}>No trend data available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={summary.monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradRegs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.primary} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradAtt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C.good} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={C.good} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: C.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.ink3, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 10, color: C.ink, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11, color: C.ink3 }} />
                    <Area type="monotone" dataKey="registrations" stroke={C.primary} fill="url(#gradRegs)" strokeWidth={2} dot={false} name="Registrations" />
                    <Area type="monotone" dataKey="attendance" stroke={C.good} fill="url(#gradAtt)" strokeWidth={2} dot={false} name="Attendance" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Card>

            {/* Insider / Outsider donut */}
            <Card>
              <p style={{ color: C.ink2, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Insider vs Outsider</p>
              {donutData.length === 0 ? (
                <p style={{ color: C.ink3, fontSize: 12 }}>No participation data.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" strokeWidth={0}>
                        {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: C.panel, border: `1px solid ${C.line2}`, borderRadius: 10, fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-2">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                          <span style={{ color: C.ink3, fontSize: 11 }}>{d.name}</span>
                        </div>
                        <span style={{ color: C.ink, fontSize: 12, fontWeight: 700 }} className="num">
                          {fmt(d.value)} ({totalParticipants > 0 ? Math.round(d.value / totalParticipants * 100) : 0}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>
        </div>

        {/* Section 4 — Highlights */}
        {highlights && (
          <div>
            <SectionHeading n={4} label="Highlights" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <InsightTile label="Best Attendance (Fest)" name={highlights.bestAttendance?.name ?? "—"} value={highlights.bestAttendance ? fmt(highlights.bestAttendance.attendance) : "—"} sub="total attendees" tone="good" />
              <InsightTile label="Best Feedback (Fest)" name={highlights.bestFeedback?.name ?? "—"} value={highlights.bestFeedback?.avgFeedback ? `${highlights.bestFeedback.avgFeedback.toFixed(1)}/5` : "—"} sub="avg rating" tone="good" />
              <InsightTile label="Worst Turnout (Fest)" name={highlights.worstTurnout?.name ?? "—"} value={highlights.worstTurnout ? pct(highlights.worstTurnout.attendanceRate) : "—"} sub="attendance rate" tone="bad" />
              <InsightTile label="Lowest Attendance (Fest)" name={highlights.lowestAttendance?.name ?? "—"} value={highlights.lowestAttendance ? fmt(highlights.lowestAttendance.attendance) : "—"} sub="total attendees" tone="bad" />
            </div>
          </div>
        )}

        {/* Section 5 — Department Performance */}
        <div>
          <SectionHeading n={5} label="Department Performance" />
          <Card>
            {depts.length === 0 ? (
              <p style={{ color: C.ink3, fontSize: 12 }}>No department data available.</p>
            ) : (
              <DeptTable rows={depts} />
            )}
          </Card>
        </div>

        {/* Section 6 — Fest-wise Performance */}
        <div>
          <SectionHeading n={6} label="Fest-wise Performance" />
          <Card>
            {fests.length === 0 ? (
              <p style={{ color: C.ink3, fontSize: 12 }}>No fest data available.</p>
            ) : (
              <FestTable rows={fests} />
            )}
          </Card>
        </div>

      </div>
    </div>
  );
}
