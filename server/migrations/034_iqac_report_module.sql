-- 034_iqac_report_module.sql
-- IQAC report module: add pre-event IQAC fields to fests, create post-event report table

-- Step 1: Add IQAC pre-event columns to fests (events already has these)
ALTER TABLE public.fests
  ADD COLUMN IF NOT EXISTS iqac_event_type      text,
  ADD COLUMN IF NOT EXISTS target_audience      jsonb,
  ADD COLUMN IF NOT EXISTS external_speakers    jsonb,
  ADD COLUMN IF NOT EXISTS blog_link            text,
  ADD COLUMN IF NOT EXISTS organising_committee jsonb;

-- Step 2: Create post-event IQAC report table (1:1 side-car per event/fest)
--
-- Column groupings:
--   outcomes          jsonb  { outcome_1, outcome_2 }
--   relevance_mappings jsonb { skill_course_mapping, pos_psos, graduate_attributes,
--                              contemporary_requirements, sdg_mapping }
--   submission_meta   jsonb  { submitted_by, submitted_at, updated_at }

CREATE TABLE IF NOT EXISTS public.iqac_post_event_reports (
  id                          uuid   NOT NULL DEFAULT gen_random_uuid(),
  entity_type                 text   NOT NULL CHECK (entity_type IN ('event', 'fest')),
  entity_id                   text   NOT NULL,

  -- Page 2: Summary
  event_summary               text,

  -- Page 2: Outcomes  { outcome_1: text, outcome_2: text }
  outcomes                    jsonb,

  -- Page 2: Analysis (kept as flat columns for easy querying)
  goal_achievement            text,
  key_takeaways               text,
  impact_on_stakeholders      text,
  innovations_best_practices  text,

  -- Page 3: All relevance/mapping data in one blob
  -- {
  --   skill_course_mapping: [{course_code, course_name, mapping_type}],
  --   pos_psos: text,
  --   graduate_attributes: text,
  --   contemporary_requirements: text,
  --   sdg_mapping: [{sdg_number, subject_code, subject_name}]
  -- }
  relevance_mappings          jsonb,

  -- Final page
  suggestions                 text,

  -- Competition events only: [{position, name, register_number, team_name}]
  winners                     jsonb,

  -- Submission metadata  { submitted_by: text, submitted_at: timestamptz, updated_at: timestamptz }
  submission_meta             jsonb,

  CONSTRAINT iqac_post_event_reports_pkey PRIMARY KEY (id),
  CONSTRAINT iqac_post_event_reports_entity_unique UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_iqac_reports_entity
  ON public.iqac_post_event_reports (entity_type, entity_id);

-- Index on submitted_by inside the JSON blob for RLS + lookup
CREATE INDEX IF NOT EXISTS idx_iqac_reports_submitted_by
  ON public.iqac_post_event_reports ((submission_meta->>'submitted_by'));

-- Step 3: RLS
ALTER TABLE public.iqac_post_event_reports ENABLE ROW LEVEL SECURITY;

-- Organiser who submitted can manage their own report
CREATE POLICY "organiser_manage_iqac_report"
  ON public.iqac_post_event_reports
  FOR ALL
  USING ((submission_meta->>'submitted_by') = (auth.jwt() ->> 'email'))
  WITH CHECK ((submission_meta->>'submitted_by') = (auth.jwt() ->> 'email'));

-- Masteradmin can read all
CREATE POLICY "masteradmin_read_all_iqac_reports"
  ON public.iqac_post_event_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_uuid = auth.uid()
        AND u.is_masteradmin = TRUE
    )
  );
