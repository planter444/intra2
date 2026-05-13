export const KPI_COUNT = 5;
export const PERFORMANCE_BAND_KEYS = ['outstanding', 'strong', 'developing', 'needsSupport'];
export const DEFAULT_PERFORMANCE_BANDS = {
  pendingLabel: 'Pending',
  outstanding: { label: 'Outstanding', minScore: 85 },
  strong: { label: 'Strong', minScore: 70 },
  developing: { label: 'Developing', minScore: 50 },
  needsSupport: { label: 'Needs support', minScore: 0 }
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
      score: normalizeScore(rawIndicator?.score ?? legacyScore)
    };
  });

  return {
    coreRoles: base.coreRoles.map((role, index) => String(Array.isArray(entry?.coreRoles) ? entry.coreRoles[index] || '' : '').trim()),
    indicators: normalizedIndicators
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
