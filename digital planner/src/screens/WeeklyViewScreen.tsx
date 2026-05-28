import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { format, addDays, subDays } from 'date-fns';
import { RootStackParamList, DrawingPath, CalendarEvent } from '../types';
import { COLORS } from '../utils/constants';
import { getWeekData } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
import HandwritingCanvas from '../components/HandwritingCanvas';
import {
  getDayDrawings,
  saveDayDrawings,
  getCustomEvents,
} from '../services/StorageService';
import { getEventsForDate } from '../services/CalendarService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'WeeklyView'>;
  route: RouteProp<RootStackParamList, 'WeeklyView'>;
};

export default function WeeklyViewScreen({ navigation, route }: Props) {
  const { year, weekNumber, startDate } = route.params;
  const weekData = useMemo(
    () => getWeekData(year, weekNumber, startDate),
    [year, weekNumber, startDate]
  );

  const [openDayIndex, setOpenDayIndex] = useState<number | null>(null);
  const [dayDrawings, setDayDrawings] = useState<Record<string, DrawingPath[]>>({});
  const [dayEvents, setDayEvents] = useState<Record<string, CalendarEvent[]>>({});

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [weekData])
  );

  const loadAll = async () => {
    const drawMap: Record<string, DrawingPath[]> = {};
    const evtMap: Record<string, CalendarEvent[]> = {};
    
    for (const day of weekData.days) {
      drawMap[day.dateString] = await getDayDrawings(day.dateString);
      
      // Get calendar events
      let calendarEvts: CalendarEvent[] = [];
      try {
        calendarEvts = await getEventsForDate(day.dateString);
      } catch {
        calendarEvts = [];
      }
      
      // Get custom events
      let customEvts: CalendarEvent[] = [];
      try {
        customEvts = await getCustomEvents(day.dateString);
      } catch {
        customEvts = [];
      }
      
      // Combine both
      evtMap[day.dateString] = [...calendarEvts, ...customEvts];
    }
    
    setDayDrawings(drawMap);
    setDayEvents(evtMap);
  };

  const handleDrawChange = useCallback(
    async (dateString: string, drawings: DrawingPath[]) => {
      setDayDrawings((prev) => ({ ...prev, [dateString]: drawings }));
      await saveDayDrawings(dateString, drawings);
    },
    []
  );

  const prevStart = format(subDays(weekData.startDate, 7), 'yyyy-MM-dd');
  const nextStart = format(addDays(weekData.startDate, 7), 'yyyy-MM-dd');
  const primaryMonth = weekData.days[3]?.monthName ?? '';
  
  const isCustomEvent = (event: CalendarEvent) => event.id.startsWith('custom_');

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={year}
        onYearPress={() => navigation.navigate('YearlyView', { year })}
        monthName={primaryMonth}
        onMonthPress={() =>
          navigation.navigate('MonthlyView', {
            year,
            month: weekData.month,
          })
        }
        title={`Week ${weekNumber}`}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('WeeklyView', {
                year,
                weekNumber: weekNumber - 1,
                startDate: prevStart,
              })
            }
          >
            <Text style={styles.navText}>← Wk {weekNumber - 1}</Text>
          </TouchableOpacity>
          <Text style={styles.weekTitle}>Week {weekNumber}</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('WeeklyView', {
                year,
                weekNumber: weekNumber + 1,
                startDate: nextStart,
              })
            }
          >
            <Text style={styles.navText}>Wk {weekNumber + 1} →</Text>
          </TouchableOpacity>
        </View>

        {/* Day blocks */}
        {weekData.days.map((day, idx) => {
          const events = dayEvents[day.dateString] ?? [];
          const drawings = dayDrawings[day.dateString] ?? [];
          
          return (
            <View
              key={day.dateString}
              style={[
                styles.dayBlock,
                day.isToday && styles.todayBlock,
              ]}
            >
              {/* Day header — tap to go to daily view */}
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() =>
                  navigation.navigate('DailyView', { date: day.dateString })
                }
              >
                <View style={styles.dayHeaderLeft}>
                  <Text
                    style={[styles.dayName, day.isToday && styles.todayText]}
                  >
                    {day.dayName}
                  </Text>
                  <Text style={styles.dayDate}>
                    {day.dayOfMonth} {day.monthName}
                  </Text>
                </View>
                <View style={styles.dayHeaderRight}>
                  {events.length > 0 && (
                    <View style={styles.eventBadge}>
                      <Text style={styles.eventBadgeText}>
                        {events.length} event{events.length > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.linkArrow}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Events list */}
              {events.length > 0 && (
                <View style={styles.events}>
                  {events.map((evt) => (
                    <View
                      key={evt.id}
                      style={[
                        styles.eventItem,
                        { borderLeftColor: evt.color ?? COLORS.accent },
                        isCustomEvent(evt) && styles.customEventItem,
                      ]}
                    >
                      <Text style={styles.eventTime}>
                        {evt.allDay
                          ? 'All Day'
                          : format(new Date(evt.startDate), 'HH:mm')}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle} numberOfLines={1}>
                          {evt.title}
                        </Text>
                        {isCustomEvent(evt) && (
                          <Text style={styles.customBadgeText}>📝 Custom</Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* No events message */}
              {events.length === 0 && (
                <View style={styles.noEventsBox}>
                  <Text style={styles.noEventsText}>No events scheduled</Text>
                </View>
              )}

              {/* Writing toggle */}
              <TouchableOpacity
                style={styles.toggleBtn}
                onPress={() =>
                  setOpenDayIndex(openDayIndex === idx ? null : idx)
                }
              >
                <Text style={styles.toggleText}>
                  {openDayIndex === idx
                    ? '▼ Close writing area'
                    : '▶ Open writing area'}
                  {drawings.length > 0 ? '  ✏️' : ''}
                </Text>
              </TouchableOpacity>

              {openDayIndex === idx && (
                <HandwritingCanvas
                  initialDrawings={drawings}
                  onDrawingsChange={(d) => handleDrawChange(day.dateString, d)}
                  height={220}
                  showLines
                  lineSpacing={28}
                />
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 12, paddingBottom: 40 },

  weekNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  weekTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  dayBlock: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  todayBlock: { borderColor: COLORS.highlight, borderWidth: 2 },

  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.secondary,
  },
  dayHeaderLeft: {
    flex: 1,
  },
  dayHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dayName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  todayText: { color: COLORS.highlight },
  dayDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  linkArrow: { color: COLORS.accent, fontSize: 20, fontWeight: '700' },
  
  eventBadge: {
    backgroundColor: COLORS.highlight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  eventBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '700',
  },

  events: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginBottom: 4,
    borderLeftWidth: 3,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    gap: 10,
  },
  customEventItem: {
    backgroundColor: COLORS.todayBg,
  },
  eventTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    width: 60,
  },
  eventTitle: { 
    color: COLORS.text, 
    fontSize: 13, 
    fontWeight: '600',
  },
  customBadgeText: {
    color: COLORS.highlight,
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },

  noEventsBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  noEventsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },

  toggleBtn: { padding: 10, alignItems: 'center' },
  toggleText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '500' },
});
