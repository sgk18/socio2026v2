import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  PageBreak,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  ImageRun,
} from "docx";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveAcademicYear(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  const month = d.getMonth(); // 0-based
  const year = d.getFullYear();
  // Academic year: June (5) to May (4) of next year
  if (month >= 5) return `${year}-${String(year + 1).slice(2)}`;
  return `${year - 1}-${String(year).slice(2)}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${suffix}`;
}

const THIN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };

const HEADER_SHADING = {
  type: ShadingType.CLEAR,
  color: "auto",
  fill: "1a3a6e",
};

const SUBHEADER_SHADING = {
  type: ShadingType.CLEAR,
  color: "auto",
  fill: "2d5fa6",
};

const LIGHT_SHADING = {
  type: ShadingType.CLEAR,
  color: "auto",
  fill: "e8edf5",
};

function bold(text, size = 20, color = "000000") {
  return new TextRun({ text: String(text ?? ""), bold: true, size, color });
}

function normal(text, size = 20, color = "000000") {
  return new TextRun({ text: String(text ?? ""), size, color });
}

function whiteText(text, size = 22) {
  return new TextRun({ text: String(text ?? ""), bold: true, size, color: "FFFFFF" });
}

function para(children, alignment = AlignmentType.LEFT, spacingAfter = 80) {
  return new Paragraph({
    children: Array.isArray(children) ? children : [children],
    alignment,
    spacing: { after: spacingAfter },
  });
}

function labelValueRow(label, value, labelWidth = 35, valueWidth = 65) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: labelWidth, type: WidthType.PERCENTAGE },
        shading: LIGHT_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([bold(label)])],
        verticalAlign: VerticalAlign.TOP,
      }),
      new TableCell({
        width: { size: valueWidth, type: WidthType.PERCENTAGE },
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([normal(value || "—")])],
        verticalAlign: VerticalAlign.TOP,
      }),
    ],
  });
}

function sectionHeader(text) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: HEADER_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([whiteText(text, 22)], AlignmentType.CENTER, 60)],
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  });
}

function subSectionHeader(text) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: SUBHEADER_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([whiteText(text, 20)], AlignmentType.LEFT, 60)],
        verticalAlign: VerticalAlign.CENTER,
      }),
    ],
  });
}

function fullWidthTextRow(text, shading = null) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        shading: shading || undefined,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([normal(text || "—")], AlignmentType.LEFT, 80)],
        verticalAlign: VerticalAlign.TOP,
      }),
    ],
  });
}

function twoColTextRow(label, text) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: LIGHT_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([bold(label)])],
        verticalAlign: VerticalAlign.TOP,
      }),
      new TableCell({
        width: { size: 65, type: WidthType.PERCENTAGE },
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([normal(text || "—")])],
        verticalAlign: VerticalAlign.TOP,
      }),
    ],
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Generates an IQAC Activity Report .docx buffer.
 *
 * @param {object} data
 *   event        – row from public.events (or public.fests)
 *   report       – row from public.iqac_post_event_reports (may be null)
 *   stats        – { total_registered, attended, absent, internal, external, volunteer_count }
 *   entityType   – 'event' | 'fest'
 */
export async function generateIqacReport({ event, report = {}, stats = {}, entityType = "event" }) {
  const raw = report || {};
  const s = stats || {};

  // Normalize: support both flat (legacy) and blob structure
  const r = {
    ...raw,
    outcome_1: raw.outcomes?.outcome_1 ?? raw.outcome_1 ?? null,
    outcome_2: raw.outcomes?.outcome_2 ?? raw.outcome_2 ?? null,
    skill_course_mapping: raw.relevance_mappings?.skill_course_mapping ?? raw.skill_course_mapping ?? [],
    pos_psos: raw.relevance_mappings?.pos_psos ?? raw.pos_psos ?? null,
    graduate_attributes: raw.relevance_mappings?.graduate_attributes ?? raw.graduate_attributes ?? null,
    contemporary_requirements: raw.relevance_mappings?.contemporary_requirements ?? raw.contemporary_requirements ?? null,
    sdg_mapping: raw.relevance_mappings?.sdg_mapping ?? raw.sdg_mapping ?? [],
  };

  const eventTitle = event.title || event.fest_title || "Untitled";
  const dept = event.organizing_dept || "—";
  const school = event.organizing_school || "—";
  const venue = event.venue || "—";
  const eventDate = formatDate(event.event_date || event.opening_date);
  const endDate = formatDate(event.end_date || event.closing_date);
  const startTime = formatTime(event.event_time);
  const endTime = formatTime(event.end_time);
  const dateTimeStr = startTime
    ? `${eventDate} to ${endDate}  |  ${startTime}${endTime ? " – " + endTime : ""}`
    : `${eventDate} to ${endDate}`;
  const academicYear = deriveAcademicYear(event.event_date || event.opening_date);
  const iqacType = event.iqac_event_type || "—";
  const blogLink = event.blog_link || "—";

  // Target audience
  let audienceStr = "—";
  try {
    const aud = Array.isArray(event.target_audience)
      ? event.target_audience
      : JSON.parse(event.target_audience || "[]");
    if (aud.length > 0) audienceStr = aud.join(", ");
  } catch (_) {}

  // Organising committee
  let committeeRows = [];
  try {
    const comm = Array.isArray(event.organising_committee)
      ? event.organising_committee
      : JSON.parse(event.organising_committee || "[]");
    committeeRows = comm;
  } catch (_) {}

  // External speakers
  let speakerRows = [];
  try {
    const spk = Array.isArray(event.external_speakers)
      ? event.external_speakers
      : JSON.parse(event.external_speakers || "[]");
    speakerRows = spk;
  } catch (_) {}

  // Skill/course mapping
  let skillMappingRows = [];
  try {
    const sm = Array.isArray(r.skill_course_mapping)
      ? r.skill_course_mapping
      : JSON.parse(r.skill_course_mapping || "[]");
    skillMappingRows = sm;
  } catch (_) {}

  // SDG mapping
  let sdgRows = [];
  try {
    const sdg = Array.isArray(r.sdg_mapping)
      ? r.sdg_mapping
      : JSON.parse(r.sdg_mapping || "[]");
    sdgRows = sdg;
  } catch (_) {}

  // Winners
  let winnerRows = [];
  try {
    const w = Array.isArray(r.winners)
      ? r.winners
      : JSON.parse(r.winners || "[]");
    winnerRows = w;
  } catch (_) {}

  // ── PAGE 1: FACING SHEET ──────────────────────────────────────────────────

  const page1Title = new Paragraph({
    children: [
      new TextRun({ text: "ACTIVITY REPORT", bold: true, size: 32, color: "1a3a6e" }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
  });

  const institutionName = new Paragraph({
    children: [
      new TextRun({ text: "CHRIST (Deemed to be University)", bold: true, size: 24 }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 20 },
  });

  const campusName = new Paragraph({
    children: [
      new TextRun({
        text: "Pune Lavasa Campus — The Hub of Analytics",
        size: 20,
        italics: true,
        color: "444444",
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });

  const divider = new Paragraph({
    children: [new TextRun({ text: "─".repeat(80), color: "1a3a6e", size: 16 })],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });

  // Main facing-sheet table
  const facingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeader("EVENT INFORMATION"),
      labelValueRow("Department / Cell / Office", `${dept}  |  ${school}`),
      labelValueRow("Event Title", eventTitle),
      labelValueRow("Date & Time", dateTimeStr),
      labelValueRow("Venue", venue),
      labelValueRow("Academic Year", academicYear),
      labelValueRow("Event Type (IQAC Focus)", iqacType),
      labelValueRow("Blog / Report Link", blogLink),

      sectionHeader("PARTICIPANTS INFORMATION"),
      labelValueRow("Target Audience", audienceStr),
      labelValueRow("No. of Registered Participants", String(s.total_registered ?? "—")),
      labelValueRow("No. of Attendees (Internal)", String(s.internal ?? "—")),
      labelValueRow("No. of Attendees (External)", String(s.external ?? "—")),
      labelValueRow("No. of Student Volunteers", String(s.volunteer_count ?? "—")),

      sectionHeader("ORGANISING COMMITTEE"),
      ...(committeeRows.length > 0
        ? committeeRows.map((c) =>
            twoColTextRow(c.role || "Coordinator", `${c.name || "—"}${c.email ? "  (" + c.email + ")" : ""}`)
          )
        : [fullWidthTextRow("No committee details provided.")]),

      sectionHeader("EXTERNAL SPEAKERS / RESOURCE PERSONS"),
      ...(speakerRows.length > 0
        ? speakerRows.map((sp) =>
            new TableRow({
              children: [
                new TableCell({
                  columnSpan: 2,
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [
                    para([
                      bold(`${sp.name || "—"}`, 20),
                      normal(`  |  ${sp.designation || ""}${sp.organization ? ", " + sp.organization : ""}`),
                    ]),
                    ...(sp.contact || sp.website
                      ? [para([normal(`Contact: ${sp.contact || ""}  ${sp.website ? "| " + sp.website : ""}`, 18, "555555")])]
                      : []),
                  ],
                }),
              ],
            })
          )
        : [fullWidthTextRow("No external speakers / resource persons listed.")]),
    ],
  });

  // ── PAGE 2: SUMMARY & OUTCOMES ────────────────────────────────────────────

  const page2Break = new Paragraph({
    children: [new PageBreak()],
    spacing: { after: 0 },
  });

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeader("SUMMARY OF THE OVERALL EVENT"),
      fullWidthTextRow(r.event_summary),

      sectionHeader("OUTCOMES OF THE EVENT"),
      twoColTextRow("Outcome 1", r.outcome_1),
      twoColTextRow("Outcome 2", r.outcome_2),

      sectionHeader("ANALYSIS"),
      subSectionHeader("Goal Achievement"),
      fullWidthTextRow(r.goal_achievement),
      subSectionHeader("Key Takeaways"),
      fullWidthTextRow(r.key_takeaways),
      subSectionHeader("Impact on Stakeholders"),
      fullWidthTextRow(r.impact_on_stakeholders),
      subSectionHeader("Innovations / Best Practices"),
      fullWidthTextRow(r.innovations_best_practices),
    ],
  });

  // ── PAGE 3: RELEVANCE MAPPINGS ────────────────────────────────────────────

  const page3Break = new Paragraph({
    children: [new PageBreak()],
    spacing: { after: 0 },
  });

  // Skill/course mapping table header
  const skillTableHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: LIGHT_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([bold("Course Code")])],
      }),
      new TableCell({
        width: { size: 45, type: WidthType.PERCENTAGE },
        shading: LIGHT_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([bold("Course Name")])],
      }),
      new TableCell({
        width: { size: 35, type: WidthType.PERCENTAGE },
        shading: LIGHT_SHADING,
        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        children: [para([bold("Mapping Type")])],
      }),
    ],
  });

  const skillMappingDataRows =
    skillMappingRows.length > 0
      ? skillMappingRows.map(
          (sm) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sm.course_code || "—")])],
                }),
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sm.course_name || "—")])],
                }),
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sm.mapping_type || "—")])],
                }),
              ],
            })
        )
      : [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                children: [para([normal("No course mapping provided.")])],
              }),
            ],
          }),
        ];

  // SDG mapping table
  const sdgHeaderRow = new TableRow({
    children: ["SDG No.", "Subject Code", "Subject Name"].map(
      (h) =>
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          shading: LIGHT_SHADING,
          borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
          children: [para([bold(h)])],
        })
    ),
  });

  const sdgDataRows =
    sdgRows.length > 0
      ? sdgRows.map(
          (sdg) =>
            new TableRow({
              children: [
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sdg.sdg_number ? `SDG ${sdg.sdg_number}` : "—")])],
                }),
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sdg.subject_code || "—")])],
                }),
                new TableCell({
                  borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                  children: [para([normal(sdg.subject_name || "—")])],
                }),
              ],
            })
        )
      : [
          new TableRow({
            children: [
              new TableCell({
                columnSpan: 3,
                borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                children: [para([normal("No SDG mapping provided.")])],
              }),
            ],
          }),
        ];

  const relevanceTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeader("RELEVANCE OF THE EVENT"),

      subSectionHeader("1. Skill / Learning Mapping (Course Code → Mapping Type)"),
      skillTableHeaderRow,
      ...skillMappingDataRows,

      subSectionHeader("2. Programme Outcomes (POs) & Programme Specific Outcomes (PSOs)"),
      fullWidthTextRow(r.pos_psos),

      subSectionHeader("3. Local / Regional / National / Global Needs & Graduate Attributes"),
      fullWidthTextRow(r.graduate_attributes),

      subSectionHeader("4. Contemporary Requirements (Employability / Entrepreneurship / Skill Development)"),
      fullWidthTextRow(r.contemporary_requirements),

      subSectionHeader("5. Support to Value Systems / Cross-Cutting Issues / SDG Mapping"),
      sdgHeaderRow,
      ...sdgDataRows,
    ],
  });

  // ── PAGE 4: SUGGESTIONS & SIGN-OFF ───────────────────────────────────────

  const page4Break = new Paragraph({
    children: [new PageBreak()],
    spacing: { after: 0 },
  });

  const signoffTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeader("SUGGESTIONS FOR IMPROVEMENT"),
      fullWidthTextRow(r.suggestions),

      sectionHeader("FEEDBACK FROM IQAC"),
      fullWidthTextRow("(To be filled by the IQAC Coordinator)"),

      // Sign-off row
      new TableRow({
        children: [
          ...[
            "Head / Coordinator",
            "Faculty Coordinator / Organiser",
            "IQAC",
          ].map(
            (label) =>
              new TableCell({
                width: { size: 33, type: WidthType.PERCENTAGE },
                borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                children: [
                  para([bold(label)], AlignmentType.CENTER),
                  new Paragraph({ children: [new TextRun({ text: " ", size: 20 })], spacing: { after: 600 } }),
                  para([normal("Signature & Date", 18, "888888")], AlignmentType.CENTER),
                ],
                verticalAlign: VerticalAlign.TOP,
              })
          ),
        ],
      }),
    ],
  });

  // ── Winners (competition events only) ────────────────────────────────────

  const winnersSection = winnerRows.length > 0
    ? [
        page4Break,
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            sectionHeader("WINNERS / RESULTS"),
            new TableRow({
              children: ["Position", "Name", "Register No.", "Team Name"].map(
                (h) =>
                  new TableCell({
                    shading: LIGHT_SHADING,
                    borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                    children: [para([bold(h)])],
                  })
              ),
            }),
            ...winnerRows.map(
              (w) =>
                new TableRow({
                  children: [
                    w.position,
                    w.name,
                    w.register_number,
                    w.team_name,
                  ].map(
                    (val) =>
                      new TableCell({
                        borders: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
                        children: [para([normal(val || "—")])],
                      })
                  ),
                })
            ),
          ],
        }),
      ]
    : [];

  // ── Assemble document ─────────────────────────────────────────────────────

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `CHRIST (Deemed to be University) — Pune Lavasa Campus  |  IQAC Activity Report  |  ${eventTitle}`,
                    size: 16,
                    color: "555555",
                    italics: true,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Page ", size: 16, color: "555555" }),
                  new PageNumber({ size: 16, color: "555555" }),
                  new TextRun({ text: `  |  Generated by SOCIO — ${new Date().toLocaleDateString("en-IN")}`, size: 16, color: "555555" }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          page1Title,
          institutionName,
          campusName,
          divider,
          facingTable,
          page2Break,
          summaryTable,
          page3Break,
          relevanceTable,
          page4Break,
          signoffTable,
          ...winnersSection,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
