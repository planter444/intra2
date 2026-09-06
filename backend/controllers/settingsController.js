const { getSystemSettings, updateSystemSettings, restoreSystemSettings } = require('../services/settingsService');
const { logAction } = require('../services/auditService');
const { query } = require('../db');

const getSettings = async (req, res, next) => {
  try {
    const settings = await getSystemSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const settings = await updateSystemSettings({ currentUser: req.user, updates: req.body });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SETTINGS_UPDATE',
      entityType: 'system_settings',
      entityId: 'global',
      description: `${req.user.fullName} updated HRMS settings.`,
      metadata: { keys: Object.keys(req.body || {}) },
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const restoreSettings = async (req, res, next) => {
  try {
    const settings = await restoreSystemSettings({ currentUser: req.user });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'SETTINGS_RESTORE_DEFAULTS',
      entityType: 'system_settings',
      entityId: 'global',
      description: `${req.user.fullName} restored default HRMS settings.`,
      metadata: {},
      ipAddress: req.ip
    });

    res.json({ settings });
  } catch (error) {
    next(error);
  }
};

const seedKpiData = async (req, res, next) => {
  try {
    // Fetch all active users (excluding CEO)
    const usersResult = await query(
      'SELECT id, full_name FROM users WHERE is_active = true AND is_deleted = false AND role != $1 ORDER BY full_name',
      ['ceo']
    );

    const coreRolesPool = [
      'Project Management',
      'Team Leadership',
      'Strategic Planning',
      'Client Relations',
      'Budget Management',
      'Quality Assurance',
      'Process Improvement',
      'Training & Development',
      'Risk Management',
      'Stakeholder Communication'
    ];

    const kpiIndicatorsPool = [
      { label: 'Project Completion Rate', weight: 20 },
      { label: 'Client Satisfaction Score', weight: 15 },
      { label: 'Budget Adherence', weight: 15 },
      { label: 'Team Productivity', weight: 15 },
      { label: 'Quality Metrics', weight: 10 },
      { label: 'Innovation & Initiative', weight: 10 },
      { label: 'Communication Effectiveness', weight: 10 },
      { label: 'Problem Solving', weight: 5 },
      { label: 'Time Management', weight: 5 },
      { label: 'Collaboration', weight: 5 }
    ];

    const assessmentFrequencies = ['monthly', 'quarterly', 'half-yearly', 'yearly'];

    const kpiRecords = {};

    usersResult.rows.forEach((user) => {
      // Shuffle and pick 5 core roles
      const shuffledRoles = [...coreRolesPool].sort(() => 0.5 - Math.random());
      const selectedRoles = shuffledRoles.slice(0, 5);

      // Shuffle and pick 5 KPI indicators with random scores
      const shuffledIndicators = [...kpiIndicatorsPool].sort(() => 0.5 - Math.random());
      const selectedIndicators = shuffledIndicators.slice(0, 5).map((ind) => ({
        label: ind.label,
        weight: ind.weight,
        score: Math.floor(Math.random() * 40) + 60 // Random score between 60-100
      }));

      const randomFrequency = assessmentFrequencies[Math.floor(Math.random() * assessmentFrequencies.length)];

      kpiRecords[String(user.id)] = {
        description: `KPI framework for ${user.full_name} - Performance assessment based on core responsibilities and key performance indicators.`,
        coreRoles: selectedRoles,
        indicators: selectedIndicators,
        assessmentFrequency: randomFrequency,
        locked: false,
        updatedAt: new Date().toISOString(),
        audit: {
          lastModifiedBy: req.user.id,
          lastModifiedAt: new Date().toISOString(),
          lastModifiedByName: req.user.fullName
        }
      };
    });

    // Update settings with seeded KPI data
    const settings = await getSystemSettings();
    settings.kpi = {
      ...settings.kpi,
      records: kpiRecords
    };

    await updateSystemSettings({ currentUser: req.user, updates: { kpi: settings.kpi } });

    await logAction({
      actorUserId: req.user.id,
      actorRole: req.user.role,
      action: 'KPI_DATA_SEED',
      entityType: 'kpi_records',
      entityId: 'all',
      description: `${req.user.fullName} seeded KPI data for ${usersResult.rows.length} employees.`,
      metadata: { employeeCount: usersResult.rows.length },
      ipAddress: req.ip
    });

    res.json({ 
      success: true, 
      message: `Successfully seeded KPI data for ${usersResult.rows.length} employees.`,
      settings 
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
  restoreSettings,
  seedKpiData
};
