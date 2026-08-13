const formatDateOnly = (value) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  const normalized = formatDateOnly(value);
  if (!normalized) {
    return null;
  }

  return new Date(`${normalized}T00:00:00`);
};

const shiftDays = (date, days) => {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
};

const calculateEasterSunday = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const getKenyaPublicHolidayKeys = (year) => {
  const easterSunday = calculateEasterSunday(year);
  const fixedDates = [
    new Date(year, 0, 1),
    new Date(year, 4, 1),
    new Date(year, 5, 1),
    new Date(year, 9, 10),
    new Date(year, 9, 20),
    new Date(year, 11, 12),
    new Date(year, 11, 25),
    new Date(year, 11, 26)
  ];
  const holidays = [
    ...fixedDates,
    shiftDays(easterSunday, -2),
    shiftDays(easterSunday, 1)
  ];
  const keys = new Set();

  holidays.forEach((holiday) => {
    keys.add(formatDateOnly(holiday));
    if (holiday.getDay() === 0) {
      keys.add(formatDateOnly(shiftDays(holiday, 1)));
    }
  });

  return keys;
};

const isWeekend = (value) => {
  const date = parseDateOnly(value);
  if (!date) {
    return false;
  }

  const day = date.getDay();
  return day === 0 || day === 6;
};

const isKenyaPublicHoliday = (value) => {
  const date = parseDateOnly(value);
  if (!date) {
    return false;
  }

  return getKenyaPublicHolidayKeys(date.getFullYear()).has(formatDateOnly(date));
};

const isWorkingDay = (value) => !isWeekend(value) && !isKenyaPublicHoliday(value);

const countKenyaLeaveDays = (startDate, endDate) => {
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(endDate || startDate);

  if (!start || !end || end.getTime() < start.getTime()) {
    return 0;
  }

  let total = 0;
  for (let cursor = new Date(start.getTime()); cursor.getTime() <= end.getTime(); cursor = shiftDays(cursor, 1)) {
    if (isWorkingDay(cursor)) {
      total += 1;
    }
  }

  return total;
};

const getNextWorkingDate = (value) => {
  const date = parseDateOnly(value);
  if (!date) {
    return null;
  }

  let cursor = shiftDays(date, 1);
  while (!isWorkingDay(cursor)) {
    cursor = shiftDays(cursor, 1);
  }

  return formatDateOnly(cursor);
};

export {
  formatDateOnly,
  parseDateOnly,
  getKenyaPublicHolidayKeys,
  isKenyaPublicHoliday,
  isWeekend,
  isWorkingDay,
  countKenyaLeaveDays,
  getNextWorkingDate
};
