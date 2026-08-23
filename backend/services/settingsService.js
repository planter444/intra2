const defaultSettings = require('../config/defaultSettings');
const settingsModel = require('../models/settingsModel');
const userModel = require('../models/userModel');
const leaveModel = require('../models/leaveModel');

const mergeSettings = (currentPayload = {}, updates = {}) => ({
  ...currentPayload,
  ...updates,
  branding: {
    ...(currentPayload.branding || defaultSettings.branding),
    ...(updates.branding || {})
  },
  labels: {
    ...(currentPayload.labels || defaultSettings.labels),
    ...(updates.labels || {})
  },
  interface: {
    ...(currentPayload.interface || defaultSettings.interface),
    ...(updates.interface || {})
  },
  navigation: {
    ...(currentPayload.navigation || defaultSettings.navigation),
    ...(updates.navigation || {})
  }
});

const normalizeDepartments = (departments = []) => departments.filter((department) => department?.name !== 'Human Resources');

const ensureDocumentDefaults = (payload = {}) => {
  const nextPayload = JSON.parse(JSON.stringify(payload || {}));
  const addendumFolder = { code: 'addendum', label: 'Addendum' };
  const addendumCategory = {
    code: 'addendum',
    label: 'Addendum',
    types: [
      { code: 'addendum', label: 'Addendum' }
    ]
  };

  const folders = Array.isArray(nextPayload.folders) ? nextPayload.folders : [];
  if (!folders.some((folder) => String(folder?.code || '').trim().toLowerCase() === 'addendum')) {
    nextPayload.folders = [...folders, addendumFolder];
  }

  const categories = Array.isArray(nextPayload.documentCategories) ? nextPayload.documentCategories : [];
  if (!categories.some((category) => String(category?.code || '').trim().toLowerCase() === 'addendum')) {
    nextPayload.documentCategories = [...categories, addendumCategory];
  }

  return nextPayload;
};

const ensureKpiDefaults = (payload = {}) => {
  const nextPayload = JSON.parse(JSON.stringify(payload || {}));
  const currentKpi = nextPayload.kpi && typeof nextPayload.kpi === 'object' ? nextPayload.kpi : {};

  nextPayload.kpi = {
    records: {},
    performanceBands: JSON.parse(JSON.stringify(defaultSettings.kpi?.performanceBands || {})),
    ...currentKpi,
    records: currentKpi.records && typeof currentKpi.records === 'object'
      ? currentKpi.records
      : {},
    performanceBands: currentKpi.performanceBands && typeof currentKpi.performanceBands === 'object'
      ? {
          ...(defaultSettings.kpi?.performanceBands || {}),
          ...currentKpi.performanceBands,
          outstanding: {
            ...(defaultSettings.kpi?.performanceBands?.outstanding || {}),
            ...(currentKpi.performanceBands.outstanding || {})
          },
          strong: {
            ...(defaultSettings.kpi?.performanceBands?.strong || {}),
            ...(currentKpi.performanceBands.strong || {})
          },
          developing: {
            ...(defaultSettings.kpi?.performanceBands?.developing || {}),
            ...(currentKpi.performanceBands.developing || {})
          },
          needsSupport: {
            ...(defaultSettings.kpi?.performanceBands?.needsSupport || {}),
            ...(currentKpi.performanceBands.needsSupport || {})
          }
        }
      : JSON.parse(JSON.stringify(defaultSettings.kpi?.performanceBands || {}))
  };

  return nextPayload;
};

const normalizeLegacyPayload = (payload = {}) => {
  const nextPayload = ensureKpiDefaults(ensureDocumentDefaults(JSON.parse(JSON.stringify(payload || {}))));

  if (nextPayload.labels?.employeeDirectoryTitle === 'Employee Directory' || nextPayload.labels?.employeeDirectoryTitle === 'Users') {
    nextPayload.labels.employeeDirectoryTitle = defaultSettings.labels.employeeDirectoryTitle;
  }

  if (nextPayload.labels?.employeeDirectorySubtitle === 'Manage system users and staff.') {
    nextPayload.labels.employeeDirectorySubtitle = defaultSettings.labels.employeeDirectorySubtitle;
  }

  if (nextPayload.labels?.navigationLeaves === 'Leaves') {
    nextPayload.labels.navigationLeaves = defaultSettings.labels.navigationLeaves;
  }

  if (nextPayload.labels?.profileSubtitle === 'Employees can update contact details such as phone number. Identity and role information is managed by HR, Admin, or CEO.') {
    nextPayload.labels.profileSubtitle = defaultSettings.labels.profileSubtitle;
  }

  if (nextPayload.interface?.dashboardHeroTitle === 'Human Resource Management System') {
    nextPayload.interface.dashboardHeroTitle = defaultSettings.interface.dashboardHeroTitle;
  }

  if (nextPayload.interface?.dashboardHeroSubtitle === 'Secure intranet experience for employees, HR, executives, and administrators.') {
    nextPayload.interface.dashboardHeroSubtitle = defaultSettings.interface.dashboardHeroSubtitle;
  }

  if (Array.isArray(nextPayload.roles) && !Array.isArray(nextPayload.roleTitles)) {
    nextPayload.roleTitles = nextPayload.roles
      .filter((role) => !['ceo', 'admin', 'supervisor', 'hr'].includes(String(role?.key || '').toLowerCase()))
      .map((role) => ({ value: String(role?.label || '').trim() }))
      .filter((role) => role.value);
  }

  delete nextPayload.roles;

  return nextPayload;
};

const getSystemSettings = async () => {
  const settings = await settingsModel.getGlobal();
  const departments = normalizeDepartments(await settingsModel.listDepartments());
  const leaveTypes = await leaveModel.listLeaveTypes();
  const mergedPayload = mergeSettings(defaultSettings, normalizeLegacyPayload(settings?.payload || {}));

  const categoryTypes = Array.isArray(mergedPayload.documentCategories)
    ? mergedPayload.documentCategories.flatMap((cat) => Array.isArray(cat?.types) ? cat.types : [])
    : [];
  const baseFolders = Array.isArray(mergedPayload.folders) && mergedPayload.folders.length ? mergedPayload.folders : defaultSettings.folders;
  const folderSeen = new Set();
  const folders = [...baseFolders, ...categoryTypes].reduce((acc, entry) => {
    const code = String(entry?.code || '').trim().toLowerCase();
    const label = String(entry?.label || '').trim() || code;
    if (!code || folderSeen.has(code)) return acc;
    folderSeen.add(code);
    acc.push({ code, label });
    return acc;
  }, []);

  return {
    ...mergedPayload,
    departments: departments.length ? departments : defaultSettings.departments,
    roleTitles: Array.isArray(mergedPayload.roleTitles) && mergedPayload.roleTitles.length ? mergedPayload.roleTitles : defaultSettings.roleTitles,
    folders,
    leaveTypes: leaveTypes.length ? leaveTypes : defaultSettings.leaveTypes
  };
};

const bootstrapSystem = async ({ ceoSeedEmail, ceoSeedPassword, hashPassword }) => {
  const existingSettings = await settingsModel.getGlobal();

  if (!existingSettings) {
    await settingsModel.upsertGlobal(defaultSettings, null);
  }

  const settingsSource = existingSettings?.payload || defaultSettings;
  const existingDepartments = await settingsModel.listDepartments();
  const existingLeaveTypes = await leaveModel.listLeaveTypes();

  if (!existingDepartments.length) {
    await settingsModel.syncDepartments(settingsSource.departments || defaultSettings.departments);
  }

  if (!existingLeaveTypes.length) {
    await leaveModel.syncLeaveTypes(settingsSource.leaveTypes || defaultSettings.leaveTypes);
  }

  const roleCounts = await userModel.countByRole();
  const totalUsers = Object.values(roleCounts).reduce((sum, count) => sum + Number(count || 0), 0);

  if (!totalUsers) {
    const passwordHash = await hashPassword(ceoSeedPassword);
    await userModel.create({
      employeeNo: 'CEO-001',
      firstName: 'Chief',
      lastName: 'Executive',
      email: ceoSeedEmail,
      phone: '0000000000',
      role: 'ceo',
      roleTitle: 'CEO',
      departmentId: null,
      positionTitle: 'Chief Executive Officer',
      passwordHash
    });
  }

  await leaveModel.ensureLeaveBalancesForAllUsers();
};

// Admin and CEO can update the full settings payload. Finance can only update KPI/Performance presentation and header colors.
const normalizeUpdatesByRole = (currentUser, updates = {}) => {
  if (!currentUser || (currentUser.role !== 'finance')) {
    return updates;
  }

  const safe = {};
  // Allow interface.pageExperience for kpi and performance
  if (updates.interface && updates.interface.pageExperience) {
    safe.interface = safe.interface || {};
    safe.interface.pageExperience = {};
    if (updates.interface.pageExperience.kpi) {
      safe.interface.pageExperience.kpi = updates.interface.pageExperience.kpi;
    }
    if (updates.interface.pageExperience.performance) {
      safe.interface.pageExperience.performance = updates.interface.pageExperience.performance;
    }
  }

  // Allow interface.pageHeaderColors for kpi/performance
  if (updates.interface && updates.interface.pageHeaderColors) {
    safe.interface = safe.interface || {};
    safe.interface.pageHeaderColors = {};
    if (updates.interface.pageHeaderColors.kpi) {
      safe.interface.pageHeaderColors.kpi = updates.interface.pageHeaderColors.kpi;
    }
    if (updates.interface.pageHeaderColors.performance) {
      safe.interface.pageHeaderColors.performance = updates.interface.pageHeaderColors.performance;
    }
  }

  // Allow per-page backgrounds for kpi/performance for both variants
  if (updates.interface && updates.interface.backgrounds) {
    safe.interface = safe.interface || {};
    safe.interface.backgrounds = {};
    ['original', 'redesigned'].forEach((variant) => {
      const v = updates.interface.backgrounds[variant];
      if (v && v.perPage) {
        safe.interface.backgrounds[variant] = safe.interface.backgrounds[variant] || {};
        safe.interface.backgrounds[variant].perPage = {};
        if (v.perPage.kpi !== undefined) {
          safe.interface.backgrounds[variant].perPage.kpi = v.perPage.kpi;
        }
        if (v.perPage.performance !== undefined) {
          safe.interface.backgrounds[variant].perPage.performance = v.perPage.performance;
        }
      }
    });
  }

  if (updates.labels) {
    safe.labels = {};
    if (Object.prototype.hasOwnProperty.call(updates.labels, 'documentsModuleTitle')) {
      safe.labels.documentsModuleTitle = updates.labels.documentsModuleTitle;
    }
    if (Object.prototype.hasOwnProperty.call(updates.labels, 'documentsSubtitle')) {
      safe.labels.documentsSubtitle = updates.labels.documentsSubtitle;
    }
  }

  if (Array.isArray(updates.folders)) {
    safe.folders = updates.folders;
  }

  if (Array.isArray(updates.documentCategories)) {
    safe.documentCategories = updates.documentCategories;
  }

  if (updates.kpi && typeof updates.kpi === 'object') {
    safe.kpi = updates.kpi;
  }

  return safe;
};

const updateSystemSettings = async ({ currentUser, updates }) => {
  const current = await settingsModel.getGlobal();
  const normalizedUpdates = normalizeUpdatesByRole(currentUser, updates);
  const mergedPayload = mergeSettings(current?.payload || defaultSettings, normalizedUpdates);

  await settingsModel.upsertGlobal(mergedPayload, currentUser.id);

  if (Array.isArray(normalizedUpdates.departments)) {
    await settingsModel.syncDepartments(normalizedUpdates.departments);
  }

  if (Array.isArray(normalizedUpdates.leaveTypes)) {
    await leaveModel.syncLeaveTypes(normalizedUpdates.leaveTypes);
    await leaveModel.ensureLeaveBalancesForAllUsers();
  }

  return getSystemSettings();
};

const restoreSystemSettings = async ({ currentUser }) => {
  // Restore settings only; do not alter departments, leave types, or balances.
  await settingsModel.upsertGlobal(defaultSettings, currentUser.id);
  return getSystemSettings();
};

module.exports = {
  bootstrapSystem,
  getSystemSettings,
  updateSystemSettings,
  restoreSystemSettings
};
