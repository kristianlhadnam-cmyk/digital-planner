import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { RootStackParamList, CalendarEvent } from '../types';
import { COLORS, MONTHS, DAYS_SHORT } from '../utils/constants';
import { getMonthWeeks, formatDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
import {
  getCustomEventsForRange,
} from '../services/StorageService';
import { getEventsForRange } from '../services/CalendarService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MonthlyView'>;
  route: RouteProp<RootStackParamList, 'MonthlyView'>;
};

export default function MonthlyViewScreen({ navigation, route }: Props) {
  const { year, month } = route.params;
  const monthName = MONTHS[month];
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  const [eventsByDate, setEventsByDate] = useState<Record<string, number>>({});
  const [customByDate, setCustomByDate] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      loadEvents();
    }, [year, month])
  );

  const loadEvents = async () => {
    try {
      const monthStart = startOfMonth(new Date(year, month, 1));
      const monthEnd = endOfMonth(new Date(year, month, 1));
      const startStr = format(monthStart, 'yyyy-MM-dd');
      const endStr = format(monthEnd, 'yyyy-MM-dd');

      // Calendar events
      const calEventsMap: Record<string, number> = {};
      try {
        const calEvents = await getEventsForRange(startStr, endStr);
        calEvents.forEach((evt) => {
          const dateKey = format(new Date(evt.startDate), 'yyyy-MM-dd');
          calEventsMap[dateKey] = (calEventsMap[dateKey] || 0) + 1;
        });
      } catch (e) {
        console.log('Calendar events error:', e);
      }
      setEventsByDate(calEventsMap);

      // Custom events
      try {
        const customEventsMap = await getCustomEventsForRange(startStr, endStr);
        const customCount: Record<string, number> = {};
        Object.keys(customEventsMap).forEach((date) => {
          customCount[date] = customEventsMap[date].length;
        });
        setCustomByDate(customCount);
      } catch (e) {
        console.log('Custom events error:', e);
      }
    } catch (e) {
      console.log('Load events error:', e);
    }
  };

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  const getEventCount = (dateString: string) => {
    return (eventsByDate[dateString] || 0) + (customByDate[dateString] || 0);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={year}
        onYearPress={() => navigation.navigate('YearlyView', { year })}
        monthName={monthName}
        title={monthName}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('MonthlyView', {
                year: prevYear,
                month: prevMonth,
              })
            }
          >
            <Text style={styles.navText}>← {MONTHS[prevMonth]}</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthName} {year}
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('MonthlyView', {
                year: nextYear,
                month: nextMonth,
              })
            }
          >
            <Text style={styles.navText}>{MONTHS[nextMonth]} →</Text>
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.highlight }]} />
            <Text style={styles.legendText}>Custom event</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: COLORS.accent }]} />
            <Text style={styles.legendText}>Calendar event</Text>
          </View>
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {/* Headers */}
          <View style={styles.headerRow}>
            <View style={styles.wkHeader}>
              <Text style={styles.headerText}>Wk</Text>
            </View>
            {DAYS_SHORT.map((d) => (
              <View key={d} style={styles.dayHeader}>
                <Text style={styles.headerText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week) => (
            <View key={`${month}-w${week.weekNumber}`} style={styles.weekRow}>
              <TouchableOpacity
                style={styles.wkCell}
                onPress={() =>
                  navigation.navigate('WeeklyView', {
                    year,
                    weekNumber: week.weekNumber,
                    startDate: formatDate(week.startDate),
                  })
                }
              >
                <Text style={styles.wkText}>{week.weekNumber}</Text>
              </TouchableOpacity>

              {week.days.map((day, idx) => {
                const calCount = eventsByDate[day.dateString] || 0;
                const customCount = customByDate[day.dateString] || 0;
                const totalEvents = calCount + customCount;
                
                return (
                  <TouchableOpacity
                    key={`${day.dateString}-${idx}`}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.otherMonth,
                      day.isWeekend && !day.isToday && styles.weekendCell,
                      day.isToday && styles.todayCell,
                    ]}
                    onPress={() =>
                      navigation.navigate('DailyView', {
                        date: day.dateString,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.otherMonthText,
                        day.isToday && styles.todayText,
                      ]}
                    >
                      {day.dayOfMonth}
                    </Text>
                    
                    {/* Event indicators */}
                    {totalEvents > 0 && day.isCurrentMonth && (
                      <View style={styles.eventIndicators}>
                        {customCount > 0 && (
                          <View style={[styles.eventDot, { backgroundColor: COLORS.highlight }]} />
                        )}
                        {calCount > 0 && (
                          <View style={[styles.eventDot, { backgroundColor: COLORS.accent }]} />
                        )}
                      </View>
                    )}
                    
                    {/* Event count badge */}
                    {totalEvents > 0 && day.isCurrentMonth && (
                      <Text style={styles.eventCountText}>
                        {totalEvents}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 12, paddingBottom: 40 },

  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  monthTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 12,
    padding: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },

  grid: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
  },
  wkHeader: { width: 36, alignItems: 'center' },
  dayHeader: { flex: 1, alignItems: 'center' },
  headerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
  },
  wkCell: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
    minHeight: 60,
  },
  wkText: {
    color: COLORS.highlight,
    fontSize: 11,
    fontWeight: '800',
  },
  dayCell: {
    flex: 1,
    minHeight: 60,
    padding: 4,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  otherMonth: {
    backgroundColor: COLORS.background,
    opacity: 0.4,
  },
  todayCell: {
    backgroundColor: COLORS.todayBg,
    borderColor: COLORS.highlight,
    borderWidth: 1.5,
  },
  weekendCell: {
    backgroundColor: COLORS.weekendBg,
  },
  dayText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  otherMonthText: {
    color: COLORS.textSecondary,
  },
  todayText: {
    color: COLORS.highlight,
    fontWeight: '800',
    fontSize: 14,
  },
  eventIndicators: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventCountText: {
    color: COLORS.highlight,
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
});
