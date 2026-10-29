-- Update navigationKpiMatrix label from "KPI Management" to "Appraisal Management"
-- Update navigationKpiSelf label from "My KPI" to "My Appraisal"
-- Add kpi.setupMode and kpi.appraisalEditorRoles to existing settings

UPDATE system_settings
SET payload = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        payload,
      '{labels,navigationKpiMatrix}',
      '"Appraisal Management"'::jsonb,
      true
    ),
    '{labels,navigationKpiSelf}',
    '"My Appraisal"'::jsonb,
    true
  ),
  '{kpi,setupMode}',
  '"one"'::jsonb,
  true
),
'{kpi,appraisalEditorRoles}',
'["ceo", "admin", "finance"]'::jsonb,
true
)
WHERE scope = 'global'
AND (
  payload->'labels'->>'navigationKpiMatrix' = 'KPI Management'
  OR NOT (payload ? 'labels' AND payload->'labels' ? 'navigationKpiMatrix')
  OR NOT (payload ? 'kpi' AND payload->'kpi' ? 'setupMode')
  OR NOT (payload ? 'kpi' AND payload->'kpi' ? 'appraisalEditorRoles')
);
