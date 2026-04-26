"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingUp, Users, Calendar, Ticket, Star, ChevronRight,
  RotateCcw, Award, ArrowUpDown, Loader2, RefreshCw,
  CheckCircle, AlertTriangle, AlertCircle, Building2, Globe,
  MessageSquare, GraduationCap,
} from "lucide-react";
import {
  fetchHodAnalytics,
  fetchHodFestsInternal,
  fetchHodFestDetail,
  type HodAnalyticsBundle,
  type HodFest,
  type HodFestSummary,
  type HodFestEvent,
} from "@/lib/hodAnalyticsApi";

// ── Constants (identical to Dean) ─────────────────────────────────────────────
const PRIMARY  = "#154CB3";
const ACCENT   = "#0EA5A4";
const SUCCESS  = "#10B981";
const WARN     = "#F59E0B";
const DANGER   = "#EF4444";

const CAT_COLORS: Record<string, string> = {
  Tech: "#154CB3", Workshop: "#0EA5A4", Cultural: "#A855F7",
  Sports: "#F59E0B", Talk: "#0284C7", Competition: "#EF4444",
  Social: "#22C55E", Other: "#64748b",
};

const FB_QUESTIONS = [
  { id: "q1" as const, short: "Overall experience" },
  { id: "q2" as const, short: "Content relevance" },
  { id: "q3" as const, short: "Organisation" },
  { id: "q4" as const, short: "Venue & logistics" },
  { id: "q5" as const, short: "Likelihood to return" },
];

// ── Helpers (identical to Dean) ────────────────────────────────────────────────
function pct(n: number) { return `${n.toFixed(1)}%`; }
function fbColor(v: number) { return v >= 4.3 ? SUCCESS : v >= 3.7 ? WARN : DANGER; }
function rateColor(r: number) { return r >= 80 ? SUCCESS : r >= 60 ? WARN : DANGER; }
function rateLabel(r: number) { return r >= 80 ? "Strong" : r >= 60 ? "Steady" : "Low turnout"; }
function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  if (!y || !mo) return m;
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("en-GB", {
    month: "short", year: "2-digit",
  });
}

// ── ProgressBar (identical to Dean) ───────────────────────────────────────────
function ProgressBar({ value, max, color, height = "h-2" }: {
  value: number; max: number; color: string; height?: string;
}) {
  const w = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={`${height} rounded-full bg-slate-100 overflow-hidden`}>
      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

// ── CatPill (identical to Dean) ────────────────────────────────────────────────
function CatPill({ cat }: { cat: string }) {
  const c = CAT_COLORS[cat] || CAT_COLORS.Other;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {cat}
    </span>
  );
}

// ── KpiCard (identical to Dean) ────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}18`, color: accent }}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-[28px] font-bold leading-none tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="mt-1.5 text-[11px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

// ── InsightCard (identical to Dean) ───────────────────────────────────────────
function InsightCard({ icon, label, title, valueNum, valueLabel, hint, tone }: {
  icon: React.ReactNode; label: string; title: string;
  valueNum: string | number; valueLabel: string; hint?: string; tone: "good" | "bad";
}) {
  const s = tone === "good"
    ? { bg: "from-emerald-50 to-white", ring: "ring-emerald-100", chip: "bg-emerald-100 text-emerald-700", icon: "text-emerald-600 bg-emerald-100" }
    : { bg: "from-red-50 to-white",     ring: "ring-red-100",     chip: "bg-red-100 text-red-700",         icon: "text-red-600 bg-red-100" };
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${s.bg} ring-1 ${s.ring} p-4`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${s.icon}`}>{icon}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${s.chip}`}>{label}</span>
      </div>
      <p className="mt-3 text-[13px] font-semibold leading-snug text-slate-700">{title}</p>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold leading-none text-slate-900 tabular-nums">{valueNum}</span>
        <span className="text-xs font-semibold text-slate-500">{valueLabel}</span>
      </div>
      {hint && <p className="mt-1.5 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

// ── Sortable table helpers (identical to Dean) ─────────────────────────────────
type SortDir = "asc" | "desc";
function useSortable<T>(rows: T[], defaultKey: keyof T) {
  const [key, setKey] = useState<keyof T>(defaultKey);
  const [dir, setDir] = useState<SortDir>("desc");
  const sorted = useMemo(() => [...rows].sort((a, b) => {
    const av = a[key], bv = b[key];
    if (typeof av === "number" && typeof bv === "number") return dir === "asc" ? av - bv : bv - av;
    return dir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  }), [rows, key, dir]);
  function toggle(k: keyof T) {
    if (k === key) setDir(d => d === "asc" ? "desc" : "asc");
    else { setKey(k); setDir("desc"); }
  }
  return { sorted, key, dir, toggle };
}

function Th<T>({ label, k, cur, dir, onToggle }: {
  label: string; k: keyof T; cur: keyof T; dir: SortDir; onToggle: (k: keyof T) => void;
}) {
  const active = k === cur;
  return (
    <th
      onClick={() => onToggle(k)}
      className="cursor-pointer px-3 py-2 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 select-none"
      style={{ color: active ? PRIMARY : undefined }}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label} <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4 }} />
        {active && <span className="text-[9px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// ── EventRow — same component as Dean, works with HodFestEvent (identical shape)
function EventRow({ e, expanded, onToggle }: {
  e: HodFestEvent; expanded: boolean; onToggle: () => void;
}) {
  const sc = rateColor(e.rate);
  const sl = rateLabel(e.rate);
  const dropoff = e.regs - e.attend;
  return (
    <div className={`rounded-xl transition-colors ${expanded ? "bg-slate-50/70 ring-1 ring-slate-200" : "hover:bg-slate-50"}`}>
      <button onClick={onToggle} className="w-full text-left grid grid-cols-12 items-center gap-3 py-3 px-3">
        <div className="col-span-12 md:col-span-5 flex min-w-0 items-center gap-2">
          <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md text-slate-400 transition-transform ${expanded ? "rotate-90" : ""}`}>
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{e.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <CatPill cat={e.cat} />
              <span className="tabular-nums">{e.date}</span>
            </div>
          </div>
        </div>
        <div className="col-span-3 md:col-span-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:hidden">Regs</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{e.regs}</p>
        </div>
        <div className="col-span-3 md:col-span-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 md:hidden">Attended</p>
          <p className="text-sm font-bold tabular-nums text-slate-900">{e.attend}</p>
          {dropoff > 0 && <p className="text-[10px] tabular-nums text-slate-400">−{dropoff} drop</p>}
        </div>
        <div className="col-span-6 md:col-span-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-bold tabular-nums" style={{ color: sc }}>{e.rate}%</span>
            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: sc }}>
              {e.rate >= 80 ? <CheckCircle className="h-3 w-3" /> : e.rate >= 60 ? <TrendingUp className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {sl}
            </span>
          </div>
          <ProgressBar value={e.rate} max={100} color={sc} />
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* About */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">About this event</p>
            {e.description
              ? <p className="text-[12.5px] leading-relaxed text-slate-700">{e.description}</p>
              : <p className="text-[12px] text-slate-400 italic">No description added.</p>}
            {(e.insiders + e.outsiders) > 0 && (
              <div className="mt-3 flex gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Building2 size={11} style={{ color: PRIMARY }} />
                  Christ: <strong className="tabular-nums">{e.insiders}</strong>
                </span>
                <span className="flex items-center gap-1.5 text-slate-600">
                  <Globe size={11} style={{ color: ACCENT }} />
                  External: <strong className="tabular-nums">{e.outsiders}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Feedback */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                Feedback · {e.feedback.count} responses
              </p>
              {e.feedback.count > 0 && (
                <p className="text-lg font-bold tabular-nums" style={{ color: fbColor(e.feedback.score) }}>
                  {e.feedback.score.toFixed(1)}
                </p>
              )}
            </div>
            {e.feedback.count > 0 ? (
              <div className="space-y-2">
                {FB_QUESTIONS.map((q) => {
                  const v = e.feedback[q.id];
                  return (
                    <div key={q.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
                      <span className="w-5 text-[10px] font-bold uppercase tracking-widest text-slate-400 tabular-nums">{q.id.toUpperCase()}</span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-slate-700">{q.short}</p>
                        <ProgressBar value={v} max={5} color={fbColor(v)} height="h-1.5" />
                      </div>
                      <span className="text-[12px] font-bold tabular-nums" style={{ color: fbColor(v) }}>{v.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[12px] text-slate-400 italic">No feedback submitted yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fest → Event drill-down (mirrors Dean's DrillDown, 2-step since HOD is dept-scoped)
function HodDrillDown() {
  const [step, setStep]               = useState<1 | 2>(1);
  const [fests, setFests]             = useState<HodFest[]>([]);
  const [selFest, setSelFest]         = useState<HodFest | null>(null);
  const [festDetail, setFestDetail]   = useState<HodFestSummary | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchHodFestsInternal()
      .then(d => setFests(d.fests))
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function pickFest(f: HodFest) {
    setSelFest(f); setLoading(true); setError(null); setExpandedEvent(null);
    try {
      const data = await fetchHodFestDetail(f.id);
      setFestDetail(data); setStep(2);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  function reset() { setStep(1); setSelFest(null); setFestDetail(null); setExpandedEvent(null); }

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      {/* Step breadcrumb — same markup as Dean */}
      <div className="flex items-center gap-1 border-b border-slate-100 bg-slate-50/60 px-5 py-3 flex-wrap">
        {([
          { n: 1 as const, label: "Fest",   val: selFest?.name },
          { n: 2 as const, label: "Detail", val: null },
        ]).map((s, i) => {
          const done   = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-slate-300" />}
              <button
                disabled={!done}
                onClick={() => { if (s.n === 1) reset(); }}
                className={`flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors ${active ? "bg-blue-50 text-blue-700" : done ? "cursor-pointer text-slate-600 hover:bg-slate-100" : "text-slate-400"}`}
              >
                <span
                  className={`grid place-items-center rounded-full text-[10px] font-bold ${active ? "bg-blue-600 text-white" : done ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}
                  style={{ width: 18, height: 18 }}
                >
                  {s.n}
                </span>
                {done && s.val ? s.val : s.label}
              </button>
            </div>
          );
        })}
        {step > 1 && (
          <button onClick={reset} className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600">
            <RotateCcw size={11} /> Reset
          </button>
        )}
      </div>

      <div className="p-5">
        {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-600">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin" style={{ color: PRIMARY }} />
          </div>
        ) : (
          <>
            {/* Step 1 — Fest grid */}
            {step === 1 && (
              <>
                <p className="mb-4 text-[12px] text-slate-500">Select a fest to explore its events and performance.</p>
                {fests.length === 0 ? (
                  <p className="text-[12px] text-slate-400">No fests found for your department.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fests.map(f => (
                      <button
                        key={f.id}
                        onClick={() => pickFest(f)}
                        className="group rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:border-blue-300 hover:shadow-md transition-all"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <p className="text-[13px] font-semibold text-slate-900 leading-snug">{f.name}</p>
                          <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-blue-500 transition-colors" />
                        </div>
                        {f.dates && (
                          <p className="text-[11px] text-slate-500">{f.dates}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 2 — Fest detail (same structure as Dean's step 3) */}
            {step === 2 && festDetail && (
              <div className="space-y-6">
                {/* Fest header */}
                <div>
                  <h3 className="text-base font-bold text-slate-900">{festDetail.fest.name}</h3>
                  <p className="text-[12px] text-slate-500 mt-0.5">{festDetail.fest.dates}</p>
                </div>

                {/* Summary KPIs (identical layout to Dean's fest-detail KPIs) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {[
                    { label: "Events",        value: String(festDetail.summary.events),                              accent: PRIMARY },
                    { label: "Registrations", value: festDetail.summary.registrations.toLocaleString("en-IN"),       accent: ACCENT },
                    { label: "Attended",      value: festDetail.summary.attendance.toLocaleString("en-IN"),          accent: SUCCESS },
                    { label: "Turnout",       value: pct(festDetail.summary.attendanceRate),                         accent: rateColor(festDetail.summary.attendanceRate) },
                    { label: "Christ",        value: festDetail.summary.insiders.toLocaleString("en-IN"),            accent: PRIMARY },
                    { label: "External",      value: festDetail.summary.outsiders.toLocaleString("en-IN"),           accent: WARN },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
                      <p className="mt-1.5 text-xl font-bold leading-none tabular-nums text-slate-900">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Events list (identical to Dean) */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="grid grid-cols-12 gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      <div className="col-span-12 md:col-span-5">Event</div>
                      <div className="col-span-3 md:col-span-2 text-center">Regs</div>
                      <div className="col-span-3 md:col-span-2 text-center">Attended</div>
                      <div className="col-span-6 md:col-span-3">Attendance %</div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100 p-2">
                    {festDetail.events.length === 0 ? (
                      <p className="py-8 text-center text-[13px] text-slate-400">No events found.</p>
                    ) : festDetail.events.map(e => (
                      <EventRow
                        key={e.id} e={e}
                        expanded={expandedEvent === e.id}
                        onToggle={() => setExpandedEvent(prev => prev === e.id ? null : e.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Event Performance table (mirrors Dean's DeptTable) ─────────────────────────
type EventTableRow = {
  title: string;
  category: string;
  registrations: number;
  attended: number;
  attendanceRate: number;
  avgFeedback: number;
};

function EventTable({ rows }: { rows: EventTableRow[] }) {
  const { sorted, key, dir, toggle } = useSortable(rows, "registrations");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Event</th>
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Category</th>
            {(["registrations", "attended", "attendanceRate", "avgFeedback"] as const).map(k => (
              <Th<EventTableRow>
                key={k}
                label={k === "attendanceRate" ? "Attendance %" : k === "avgFeedback" ? "Feedback" : k === "attended" ? "Attended" : "Regs"}
                k={k} cur={key} dir={dir} onToggle={toggle}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.title + i} className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
              <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[220px] truncate">{r.title}</td>
              <td className="px-3 py-2.5"><CatPill cat={r.category} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.registrations.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.attended.toLocaleString("en-IN")}</td>
              <td className="px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums" style={{ color: rateColor(r.attendanceRate) }}>{pct(r.attendanceRate)}</span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums" style={{ color: r.avgFeedback > 0 ? fbColor(r.avgFeedback) : "#94a3b8" }}>
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

// ── Category Performance table (mirrors Dean's FestTable) ──────────────────────
type CatTableRow = {
  category: string;
  events: number;
  attendanceRate: number;
  avgFeedback: number;
  avgSuccessScore: number;
};

function CategoryTable({ rows }: { rows: CatTableRow[] }) {
  const { sorted, key, dir, toggle } = useSortable(rows, "events");
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px] border-collapse">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Category</th>
            {(["events", "attendanceRate", "avgFeedback", "avgSuccessScore"] as const).map(k => (
              <Th<CatTableRow>
                key={k}
                label={k === "attendanceRate" ? "Attendance %" : k === "avgFeedback" ? "Feedback" : k === "avgSuccessScore" ? "Success Score" : "Events"}
                k={k} cur={key} dir={dir} onToggle={toggle}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.category} className={`border-b border-slate-100 ${i % 2 === 1 ? "bg-slate-50/40" : ""}`}>
              <td className="px-3 py-2.5"><CatPill cat={r.category} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{r.events}</td>
              <td className="px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums" style={{ color: rateColor(r.attendanceRate) }}>{pct(r.attendanceRate)}</span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className="font-bold tabular-nums" style={{ color: r.avgFeedback > 0 ? fbColor(r.avgFeedback) : "#94a3b8" }}>
                  {r.avgFeedback > 0 ? r.avgFeedback.toFixed(1) : "—"}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">{r.avgSuccessScore.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── SectionHeading (identical to Dean) ────────────────────────────────────────
function SectionHeading({ n, label }: { n: number; label: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[10px] font-bold tabular-nums text-white"
        style={{ background: PRIMARY }}
      >
        {n}
      </span>
      <h2 className="text-sm font-bold tracking-tight text-slate-900">{label}</h2>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function HodAnalyticsDashboard() {
  const [bundle, setBundle]   = useState<HodAnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const b = await fetchHodAnalytics();
      setBundle(b);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // ── Derived values ──────────────────────────────────────────────────────────

  const avgFeedback = useMemo(() => {
    if (!bundle) return 0;
    const withFb = bundle.events.attendanceByEvent.filter(e => e.avgFeedback > 0);
    if (!withFb.length) return 0;
    return withFb.reduce((s, e) => s + e.avgFeedback, 0) / withFb.length;
  }, [bundle]);

  const highlights = useMemo(() => {
    if (!bundle) return null;
    const evs = bundle.events.attendanceByEvent;
    if (evs.length < 2) return null;
    const bestAttendance  = [...evs].sort((a, b) => b.attended - a.attended)[0] ?? null;
    const bestFeedback    = [...evs].filter(e => e.avgFeedback > 0).sort((a, b) => b.avgFeedback - a.avgFeedback)[0] ?? null;
    const worstTurnout    = [...evs].sort((a, b) => a.attendanceRate - b.attendanceRate)[0] ?? null;
    const lowestAttendance = [...evs].sort((a, b) => a.attended - b.attended)[0] ?? null;
    return { bestAttendance, bestFeedback, worstTurnout, lowestAttendance };
  }, [bundle]);

  const monthlyData = useMemo(() => {
    if (!bundle) return [];
    return bundle.overview.monthlyTrend.map(m => ({
      ...m,
      month: formatMonth(m.month),
    }));
  }, [bundle]);

  const totalStudents = useMemo(() => {
    if (!bundle) return 0;
    return bundle.students.segmentation.active + bundle.students.segmentation.inactive;
  }, [bundle]);

  const donutData = useMemo(() => {
    if (!bundle || totalStudents === 0) return [];
    return [
      { name: "Active students",   value: bundle.students.segmentation.active,   color: PRIMARY },
      { name: "Inactive students", value: bundle.students.segmentation.inactive,  color: "#cbd5e1" },
    ];
  }, [bundle, totalStudents]);

  // ── Loading / error states (identical look to Dean) ─────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
        <p className="text-sm font-semibold text-red-700">{error}</p>
        <button onClick={load} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (!bundle) return null;

  const showHighlights = !!highlights;

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 pb-12 pt-6">

      {/* Page header — identical layout to Dean */}
      <div className="mx-auto mb-8 flex max-w-screen-xl items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-slate-900">HOD Dashboard</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            {bundle.overview.department} · Department event &amp; fest analytics
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[12px] font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="mx-auto max-w-screen-xl space-y-8">

        {/* §1 — Fest → Event Explorer (Dean: Dept → Fest → Event Explorer) */}
        <section>
          <SectionHeading n={1} label="Fest → Event Explorer" />
          <HodDrillDown />
        </section>

        {/* §2 — Top Summary (identical card grid to Dean) */}
        <section>
          <SectionHeading n={2} label="Top Summary" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={<Calendar size={16} />}
              label="Total Events"
              value={String(bundle.overview.totalDeptEvents)}
              accent={PRIMARY}
            />
            <KpiCard
              icon={<Ticket size={16} />}
              label="Registrations"
              value={bundle.overview.funnel.registered.toLocaleString("en-IN")}
              accent={ACCENT}
            />
            <KpiCard
              icon={<Users size={16} />}
              label="Attended"
              value={bundle.overview.funnel.attended.toLocaleString("en-IN")}
              accent={SUCCESS}
            />
            <KpiCard
              icon={<TrendingUp size={16} />}
              label="Avg Attendance"
              value={pct(bundle.events.overallAttendanceRate)}
              sub="department-wide"
              accent={rateColor(bundle.events.overallAttendanceRate)}
            />
            <KpiCard
              icon={<GraduationCap size={16} />}
              label="Active Students"
              value={String(bundle.students.segmentation.active)}
              sub="in period"
              accent="#8B5CF6"
            />
            <KpiCard
              icon={<Star size={16} />}
              label="Avg Feedback"
              value={avgFeedback > 0 ? `${avgFeedback.toFixed(1)}/5` : "—"}
              accent={avgFeedback > 0 ? fbColor(avgFeedback) : "#94a3b8"}
            />
          </div>
        </section>

        {/* §3 — Trends (identical 2/3 + 1/3 split to Dean) */}
        <section>
          <SectionHeading n={3} label="Trends" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* Monthly area chart (Dean: regs vs attendance) */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Monthly Registrations vs Attendance Rate
              </p>
              {monthlyData.length === 0
                ? <p className="text-[12px] text-slate-400">No trend data available.</p>
                : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hodGRegs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={PRIMARY} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={PRIMARY} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="hodGAtt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={SUCCESS} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={SUCCESS} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid #e2e8f0" }} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                      <Area type="monotone" dataKey="registrations"  stroke={PRIMARY} fill="url(#hodGRegs)" strokeWidth={2} dot={false} name="Registrations" />
                      <Area type="monotone" dataKey="attendanceRate" stroke={SUCCESS} fill="url(#hodGAtt)"  strokeWidth={2} dot={false} name="Attendance Rate %" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
            </div>

            {/* Student engagement donut (Dean: Insider vs Outsider) */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">Student Engagement</p>
              {donutData.length === 0
                ? <p className="text-[12px] text-slate-400">No student data.</p>
                : (
                  <>
                    <div className="relative">
                      <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={donutData} cx="50%" cy="50%"
                              innerRadius="65%" outerRadius="90%"
                              dataKey="value" startAngle={90} endAngle={-270}
                              paddingAngle={2} stroke="none"
                            >
                              {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => [v.toLocaleString("en-IN"), ""]}
                              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="pointer-events-none absolute inset-0 grid place-items-center">
                        <div className="text-center">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Total</p>
                          <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-slate-900">
                            {totalStudents.toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {donutData.map(d => (
                        <div key={d.name} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                            <span className="text-[12px] text-slate-600">{d.name}</span>
                          </div>
                          <span className="text-[12px] font-bold tabular-nums text-slate-900">
                            {d.value.toLocaleString("en-IN")} ({totalStudents > 0 ? Math.round(d.value / totalStudents * 100) : 0}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </div>
          </div>
        </section>

        {/* §4 — Highlights (identical 4-card grid to Dean) */}
        {showHighlights && highlights && (
          <section>
            <SectionHeading n={4} label="Highlights" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <InsightCard
                icon={<Users size={14} />}
                label="Best Attendance"
                title={highlights.bestAttendance?.title ?? "—"}
                valueNum={highlights.bestAttendance ? highlights.bestAttendance.attended.toLocaleString("en-IN") : "—"}
                valueLabel="attendees"
                tone="good"
              />
              <InsightCard
                icon={<MessageSquare size={14} />}
                label="Best Feedback"
                title={highlights.bestFeedback?.title ?? "—"}
                valueNum={highlights.bestFeedback?.avgFeedback ? highlights.bestFeedback.avgFeedback.toFixed(1) : "—"}
                valueLabel="/ 5 avg"
                tone="good"
              />
              <InsightCard
                icon={<AlertTriangle size={14} />}
                label="Worst Turnout"
                title={highlights.worstTurnout?.title ?? "—"}
                valueNum={highlights.worstTurnout ? pct(highlights.worstTurnout.attendanceRate) : "—"}
                valueLabel="turnout"
                tone="bad"
              />
              <InsightCard
                icon={<TrendingUp size={14} />}
                label="Lowest Attendance"
                title={highlights.lowestAttendance?.title ?? "—"}
                valueNum={highlights.lowestAttendance ? highlights.lowestAttendance.attended.toLocaleString("en-IN") : "—"}
                valueLabel="attendees"
                tone="bad"
              />
            </div>
          </section>
        )}

        {/* §5 — Department Analysis (mirrors Dean's SchoolAnalysis narrative) */}
        <section>
          <SectionHeading n={showHighlights ? 5 : 4} label="Department Analysis" />
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: `${PRIMARY}18`, color: PRIMARY }}>
                <Award size={14} />
              </span>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Department Summary</p>
              {(() => {
                const rate = bundle.events.overallAttendanceRate;
                const health = rate >= 75 ? "strong" : rate >= 55 ? "moderate" : "needs attention";
                const healthColor = rate >= 75 ? SUCCESS : rate >= 55 ? WARN : DANGER;
                return (
                  <span className="ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest" style={{ background: `${healthColor}18`, color: healthColor }}>
                    {health}
                  </span>
                );
              })()}
            </div>
            {(() => {
              const rate = bundle.events.overallAttendanceRate;
              const health = rate >= 75 ? "strong" : rate >= 55 ? "moderate" : "needs attention";
              const healthColor = rate >= 75 ? SUCCESS : rate >= 55 ? WARN : DANGER;
              return (
                <p className="text-[13px] leading-relaxed text-slate-600">
                  The <strong className="text-slate-900">{bundle.overview.department}</strong> department has run{" "}
                  <strong className="text-slate-900">{bundle.overview.totalDeptEvents} events</strong> drawing{" "}
                  <strong className="text-slate-900">{bundle.overview.funnel.registered.toLocaleString("en-IN")} registrations</strong> with{" "}
                  <strong style={{ color: healthColor }}>{pct(rate)} average attendance</strong> — a {health} engagement signal.
                  {avgFeedback > 0 && (
                    <> Average feedback score is{" "}
                    <strong style={{ color: fbColor(avgFeedback) }}>{avgFeedback.toFixed(1)} / 5</strong>.</>
                  )}
                  {" "}<strong className="text-slate-900">{bundle.students.segmentation.active}</strong> students are actively engaged
                  ({totalStudents > 0 ? Math.round(bundle.students.segmentation.active / totalStudents * 100) : 0}% of the department).
                  {bundle.overview.activeTeachers > 0 && (
                    <> <strong className="text-slate-900">{bundle.overview.activeTeachers} teachers</strong> are actively organising events.</>
                  )}
                </p>
              );
            })()}
          </div>
        </section>

        {/* §6 — Event Performance (mirrors Dean's Department Performance table) */}
        <section>
          <SectionHeading n={showHighlights ? 6 : 5} label="Event Performance" />
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            {bundle.events.attendanceByEvent.length === 0
              ? <p className="p-5 text-[12px] text-slate-400">No event data available.</p>
              : <EventTable rows={bundle.events.attendanceByEvent} />}
          </div>
        </section>

        {/* §7 — Category Performance (mirrors Dean's Fest-wise Performance table) */}
        <section>
          <SectionHeading n={showHighlights ? 7 : 6} label="Category Performance" />
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            {bundle.events.categoryPerformance.length === 0
              ? <p className="p-5 text-[12px] text-slate-400">No category data available.</p>
              : <CategoryTable rows={bundle.events.categoryPerformance} />}
          </div>
        </section>

      </div>
    </div>
  );
}
