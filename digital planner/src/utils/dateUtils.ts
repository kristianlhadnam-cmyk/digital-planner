// FILE: digital-planner/src/utils/dateUtils.ts

import {
  startOfYear,
  endOfYear,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  getISOWeek,
  addDays,
  isSameMonth,
  isToday,
  parseISO,
  getDay,
  subDays,
} from 'date-fns';

export const getYearData = (year: number) => {
  const months = Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(year, i, 1);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const weeks = getMonthWeeks(year, i);

    return {
      month: i,
      name: format(monthDate, 'MMMM'),
      shortName: format(monthDate, 'MMM'),
      weeks,
      startDate: monthStart,
      endDate: monthEnd,
    };
  });

  return { year, months };
};

export const getMonthWeeks = (year: number, month: number) => {
  const monthStart = startOfMonth(new Date(year, month, 1));
  const monthEnd = endOfMonth(new Date(year, month, 1));

  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );

  return weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    const weekNumber = getISOWeek(weekStart);

    return {
      weekNumber,
      startDate: weekStart,
      endDate: weekEnd,
      days: days.map((day) => ({
        date: day,
        dateString: format(day, 'yyyy-MM-dd'),
        dayOfMonth: day.getDate(),
        isCurrentMonth: isSameMonth(day, monthStart),
        isToday: isToday(day),
        isWeekend: getDay(day) === 0 || getDay(day) === 6,
      })),
    };
  });
};

export const getWeekData = (
  year: number,
  weekNumber: number,
  startDateStr?: string
) => {
  let weekStart: Date;

  if (startDateStr) {
    weekStart = parseISO(startDateStr);
  } else {
    const jan4 = new Date(year, 0, 4);
    const jan4WeekStart = startOfWeek(jan4, { weekStartsOn: 1 });
    weekStart = addDays(jan4WeekStart, (weekNumber - 1) * 7);
  }

  weekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return {
    weekNumber,
    startDate: weekStart,
    endDate: weekEnd,
    month: weekStart.getMonth(),
    year: weekStart.getFullYear(),
    days: days.map((day) => ({
      date: day,
      dateString: format(day, 'yyyy-MM-dd'),
      dayName: format(day, 'EEEE'),
      dayShort: format(day, 'EEE'),
      dayOfMonth: day.getDate(),
      monthName: format(day, 'MMMM'),
      isToday: isToday(day),
      isWeekend: getDay(day) === 0 || getDay(day) === 6,
    })),
  };
};

export const getDayData = (dateString: string) => {
  const date = parseISO(dateString);
  return {
    date,
    dateString,
    dayName: format(date, 'EEEE'),
    dayOfMonth: date.getDate(),
    month: date.getMonth(),
    monthName: format(date, 'MMMM'),
    year: date.getFullYear(),
    weekNumber: getISOWeek(date),
    isToday: isToday(date),
    isWeekend: getDay(date) === 0 || getDay(date) === 6,
  };
};

export const formatDate = (
  date: Date | string,
  formatStr: string = 'yyyy-MM-dd'
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
};

export const getWeekNumberFromDate = (date: Date): number => {
  return getISOWeek(date);
};

export const getHoursOfDay = (): string[] => {
  return Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });
};

export const getPrevDate = (dateString: string): string => {
  return format(subDays(parseISO(dateString), 1), 'yyyy-MM-dd');
};

export const getNextDate = (dateString: string): string => {
  return format(addDays(parseISO(dateString), 1), 'yyyy-MM-dd');
};