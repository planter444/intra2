export const KPI_COUNT = 5;
export const PERFORMANCE_BAND_KEYS = ['outstanding', 'strong', 'developing', 'needsSupport'];
export const DEFAULT_PERFORMANCE_BANDS = {
  pendingLabel: 'Pending',
  outstanding: { label: 'Outstanding', minScore: 85 },
  strong: { label: 'Strong', minScore: 70 },
  developing: { label: 'Developing', minScore: 50 },
  needsSupport: { label: 'Needs support', minScore: 0 }
};

export const APPRAISAL_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  REVIEWED: 'reviewed',
  LOCKED: 'locked'
};

export const getAppraisalStatusLabel = (status) => {
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
    locked: 'Locked'
  };
  return labels[status] || 'Unknown';
};

const normalizeScore = (value) => {
  if (value === '' || value === null || value === undefined) {
    return '';
  }

  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return '';
  }

  return Math.max(0, Math.min(100, nextValue));
};

export const getEmptyKpiEntry = ({ coreRoleCount = KPI_COUNT, indicatorCount = KPI_COUNT } = {}) => ({
  coreRoles: Array.from({ length: Math.max(KPI_COUNT, Number(coreRoleCount) || 0) }, () => ''),
  indicators: Array.from({ length: Math.max(KPI_COUNT, Number(indicatorCount) || 0) }, () => ({ label: '', score: '' }))
});

export const getNormalizedKpiEntry = (entry = {}, options = {}) => {
  const legacyIndicatorCount = Object.keys(entry || {}).reduce((highest, key) => {
    const match = /^k(\d+)$/.exec(String(key || ''));
    if (!match) {
      return highest;
    }

    return Math.max(highest, Number(match[1]) || 0);
  }, 0);
  const coreRoleCount = Math.max(
    KPI_COUNT,
    Array.isArray(entry?.coreRoles) ? entry.coreRoles.length : 0,
    Number(options?.coreRoleCount) || 0
  );
  const indicatorCount = Math.max(
    KPI_COUNT,
    Array.isArray(entry?.indicators) ? entry.indicators.length : 0,
    Number(options?.indicatorCount) || 0,
    legacyIndicatorCount
  );
  const base = getEmptyKpiEntry({ coreRoleCount, indicatorCount });
  const normalizedIndicators = base.indicators.map((indicator, index) => {
    const rawIndicator = Array.isArray(entry?.indicators) ? entry.indicators[index] : null;
    const legacyScore = entry?.[`k${index + 1}`];

    return {
      label: String(rawIndicator?.label || '').trim(),
      score: normalizeScore(rawIndicator?.score ?? legacyScore),
      weight: rawIndicator?.weight || '',
      comment: rawIndicator?.comment || ''
    };
  });

  // Normalize core roles - handle both string and object formats
  const normalizedCoreRoles = base.coreRoles.map((role, index) => {
    const rawRole = Array.isArray(entry?.coreRoles) ? entry.coreRoles[index] : null;
    if (typeof rawRole === 'string') {
      return { role: rawRole.trim(), comment: '' };
    } else if (rawRole && typeof rawRole === 'object') {
      return { role: String(rawRole.role || '').trim(), comment: rawRole.comment || '' };
    }
    return { role: '', comment: '' };
  });

  return {
    coreRoles: normalizedCoreRoles,
    indicators: normalizedIndicators,
    description: entry?.description || '',
    assessmentFrequency: entry?.assessmentFrequency || 'monthly',
    audit: entry?.audit || {}
  };
};

export const serializeKpiEntry = (entry = {}) => {
  const normalized = getNormalizedKpiEntry(entry);

  return normalized.indicators.reduce((accumulator, indicator, index) => {
    accumulator[`k${index + 1}`] = indicator.score;
    return accumulator;
  }, {
    coreRoles: normalized.coreRoles,
    indicators: normalized.indicators
  });
};

export const getNormalizedPerformanceBands = (bands = {}) => {
  const source = bands && typeof bands === 'object' ? bands : {};

  return PERFORMANCE_BAND_KEYS.reduce((accumulator, key) => {
    const fallback = DEFAULT_PERFORMANCE_BANDS[key];
    const current = source[key] && typeof source[key] === 'object' ? source[key] : {};
    accumulator[key] = {
      label: String(current.label || fallback.label).trim() || fallback.label,
      minScore: Math.max(0, Math.min(100, Number(current.minScore ?? fallback.minScore) || 0))
    };
    return accumulator;
  }, {
    pendingLabel: String(source.pendingLabel || DEFAULT_PERFORMANCE_BANDS.pendingLabel).trim() || DEFAULT_PERFORMANCE_BANDS.pendingLabel
  });
};

export const getPerformanceBand = (score, bands = {}) => {
  const normalizedBands = getNormalizedPerformanceBands(bands);

  if (score === null || score === undefined || !Number.isFinite(Number(score))) {
    return normalizedBands.pendingLabel;
  }

  const numericScore = Number(score);
  const match = PERFORMANCE_BAND_KEYS
    .map((key) => normalizedBands[key])
    .sort((left, right) => right.minScore - left.minScore)
    .find((band) => numericScore >= band.minScore);

  return (match || normalizedBands.needsSupport).label;
};

export const getAverageKpiScore = (entry = {}) => {
  const normalized = getNormalizedKpiEntry(entry);
  const scores = normalized.indicators
    .map((indicator) => Number(indicator.score))
    .filter((score) => Number.isFinite(score));

  if (!scores.length) {
    return null;
  }

  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
};

// New appraisal data structure functions
export const createEmptyAppraisal = () => ({
  status: APPRAISAL_STATUS.DRAFT,
  period: {
    startDate: '',
    endDate: '',
    frequency: 'quarterly',
    periodId: `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`
  },
  selfAppraisal: {
    coreRoles: [],
    indicators: [],
    overallComment: '',
    submittedAt: null
  },
  supervisorReview: {
    coreRoles: [],
    indicators: [],
    overallComment: '',
    submittedAt: null,
    reviewerId: null
  },
  ceoReview: {
    overallComment: '',
    submittedAt: null
  },
  audit: {
    createdAt: null,
    lastModifiedAt: null,
    lastModifiedBy: null
  }
});

export const getAppraisalHistory = (settings, employeeId) => {
  const employeeData = settings?.kpi?.records?.[String(employeeId)] || {};
  
  // If using the new historical structure
  if (employeeData.history && Array.isArray(employeeData.history)) {
    return employeeData.history.sort((a, b) => 
      new Date(b.audit?.createdAt || 0) - new Date(a.audit?.createdAt || 0)
    );
  }
  
  // If using legacy structure, treat current as the only historical record
  if (Object.keys(employeeData).length > 0) {
    return [employeeData];
  }
  
  return [];
};

export const getCurrentAppraisal = (settings, employeeId) => {
  const employeeData = settings?.kpi?.records?.[String(employeeId)] || {};
  
  // If using the new historical structure, get the most recent non-locked appraisal
  if (employeeData.history && Array.isArray(employeeData.history)) {
    const current = employeeData.history.find(appraisal => 
      appraisal.status !== APPRAISAL_STATUS.LOCKED
    );
    return current || employeeData.history[0] || createEmptyAppraisal();
  }
  
  // Legacy structure - return the data as-is
  return Object.keys(employeeData).length > 0 ? employeeData : createEmptyAppraisal();
};

export const migrateLegacyKpiToAppraisal = (legacyKpi = {}) => {
  const normalized = getNormalizedKpiEntry(legacyKpi);
  
  return {
    ...createEmptyAppraisal(),
    selfAppraisal: {
      coreRoles: normalized.coreRoles.map(role => ({
        role: role.role || role,
        selfComment: '',
        supervisorComment: '',
        selfScore: null,
        supervisorScore: null
      })),
      indicators: normalized.indicators.map(indicator => ({
        label: indicator.label,
        selfComment: '',
        supervisorComment: '',
        selfScore: indicator.score || null,
        supervisorScore: null,
        weight: indicator.weight || null
      })),
      overallComment: '',
      submittedAt: null
    },
    audit: {
      createdAt: legacyKpi.audit?.lastModifiedAt || new Date().toISOString(),
      lastModifiedAt: legacyKpi.audit?.lastModifiedAt || new Date().toISOString(),
      lastModifiedBy: legacyKpi.audit?.lastModifiedBy || null
    }
  };
};

export const normalizeAppraisalData = (appraisal = {}) => {
  const empty = createEmptyAppraisal();
  
  return {
    status: appraisal.status || empty.status,
    period: {
      startDate: appraisal.period?.startDate || empty.period.startDate,
      endDate: appraisal.period?.endDate || empty.period.endDate,
      frequency: appraisal.period?.frequency || empty.period.frequency
    },
    selfAppraisal: {
      coreRoles: Array.isArray(appraisal.selfAppraisal?.coreRoles) 
        ? appraisal.selfAppraisal.coreRoles 
        : empty.selfAppraisal.coreRoles,
      indicators: Array.isArray(appraisal.selfAppraisal?.indicators) 
        ? appraisal.selfAppraisal.indicators 
        : empty.selfAppraisal.indicators,
      overallComment: appraisal.selfAppraisal?.overallComment || '',
      submittedAt: appraisal.selfAppraisal?.submittedAt || null
    },
    supervisorReview: {
      coreRoles: Array.isArray(appraisal.supervisorReview?.coreRoles) 
        ? appraisal.supervisorReview.coreRoles 
        : empty.supervisorReview.coreRoles,
      indicators: Array.isArray(appraisal.supervisorReview?.indicators) 
        ? appraisal.supervisorReview.indicators 
        : empty.supervisorReview.indicators,
      overallComment: appraisal.supervisorReview?.overallComment || '',
      submittedAt: appraisal.supervisorReview?.submittedAt || null,
      reviewerId: appraisal.supervisorReview?.reviewerId || null
    },
    ceoReview: {
      overallComment: appraisal.ceoReview?.overallComment || '',
      submittedAt: appraisal.ceoReview?.submittedAt || null
    },
    audit: {
      createdAt: appraisal.audit?.createdAt || null,
      lastModifiedAt: appraisal.audit?.lastModifiedAt || null,
      lastModifiedBy: appraisal.audit?.lastModifiedBy || null
    }
  };
};

export const calculateAppraisalScore = (appraisal, reviewType = 'self') => {
  const reviewData = reviewType === 'self' ? appraisal.selfAppraisal : appraisal.supervisorReview;
  const indicators = reviewData.indicators || [];
  
  const scores = indicators
    .map(indicator => reviewType === 'self' ? indicator.selfScore : indicator.supervisorScore)
    .filter(score => score !== null && score !== undefined && score !== '' && !isNaN(Number(score)))
    .map(Number);
    
  if (!scores.length) return null;
  
  return Math.round(scores.reduce((total, score) => total + score, 0) / scores.length);
};

export const canEditAppraisal = (appraisal, userRole, userId) => {
  if (!appraisal) return false;
  
  // CEO can always edit unlocked appraisals
  if (userRole === 'ceo' && appraisal.status !== APPRAISAL_STATUS.LOCKED) return true;
  
  // Admin can always edit unlocked appraisals
  if (userRole === 'admin' && appraisal.status !== APPRAISAL_STATUS.LOCKED) return true;
  
  // Employee can only edit their own draft appraisals
  if (userRole === 'employee' && appraisal.status === APPRAISAL_STATUS.DRAFT) return true;
  
  // Supervisor can edit appraisals that are submitted (for review)
  if (userRole === 'supervisor' && appraisal.status === APPRAISAL_STATUS.SUBMITTED) return true;
  
  return false;
};

export const canViewGrade = (appraisal, userRole, userId, settings) => {
  if (!appraisal) return false;
  
  const gradeVisibility = settings?.kpi?.appraisal?.gradeVisibility || {};
  
  // CEO and admin can always see all grades
  if (userRole === 'ceo' || userRole === 'admin') return true;
  
  // Supervisor can see grades they've assigned
  if (userRole === 'supervisor' && appraisal.supervisorReview?.reviewerId === userId) return true;
  
  // Employee can see their own self-appraisal grades
  if (userRole === 'employee') {
    return true; // Can always see their own self-appraisal
  }
  
  return false;
};
