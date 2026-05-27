import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { format, startOfWeek } from 'date-fns';
import { RootStackParamList, DrawingPath, CalendarEvent } from '../types';
import { COLORS } from '../utils/constants';
import { getDayData, getHoursOfDay, getPrevDate, getNextDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
import HandwritingCanvas from '../components/HandwritingCanvas';
import NavigationButton from '../components/NavigationButton';
import { getDayDrawings, saveDayDrawings } from '../services/StorageService';
import { getEventsForDate, openExternalCalendar } from '../services/CalendarService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DailyView'>;
  route: RouteProp<RootStackParamList, 'DailyView'>;
};

export default function DailyViewScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const dayData = getDayData(date);
  const hours = getHoursOfDay();

  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [activeTab, setActiveTab] = useState<'schedule' | 'handwrite'>(
    'schedule'
  );
  const [loading, setLoading] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);
  
  const drawingsRef = useRef<DrawingPath[]>([]);
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    
    try {
      const saved = await getDayDrawings(date);
      drawingsRef.current = saved || [];
      setDrawings(saved || []);
      setCanvasKey(prev => prev + 1);
    } catch (e) {
      console.log('Load drawings error:', e);
      setDrawings([]);
    }
    
    try {
      const cal = await getEventsForDate(date);
      setEvents(cal);
    } catch {
      setEvents([]);
    }
    
    setLoading(false);
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);
  };

  const handleDrawChange = useCallback(
    (newDrawings: DrawingPath[]) => {
      if (isInitialLoad.current) {
        return;
      }
      
      drawingsRef.current = newDrawings;
      
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await saveDayDrawings(date, newDrawings);
        } catch (e) {
          console.log('Save drawings error:', e);
        }
      }, 500);
    },
    [date]
  );

  const eventsAtHour = (hour: string): CalendarEvent[] => {
    const h = parseInt(hour.split(':')[0], 10);
    return events.filter(
      (e) => !e.allDay && new Date(e.startDate).getHours() === h
    );
  };

  const weekStart = startOfWeek(dayData.date, { weekStartsOn: 1 });

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={dayData.year}
        onYearPress={() =>
          navigation.navigate('YearlyView', { year: dayData.year })
        }
        monthName={dayData.monthName}
        onMonthPress={() =>
          navigation.navigate('MonthlyView', {
            year: dayData.year,
            month: dayData.month,
          })
        }
        weekNumber={dayData.weekNumber}
        onWeekPress={() =>
          navigation.navigate('WeeklyView', {
            year: dayData.year,
            weekNumber: dayData.weekNumber,
            startDate: format(weekStart, 'yyyy-MM-dd'),
          })
        }
        title={`${dayData.dayName.slice(0, 3)} ${dayData.dayOfMonth}`}
      />

      <View style={styles.dayNav}>
        <TouchableOpacity
          style={styles.dayNavBtn}
          onPress={() =>
            navigation.replace('DailyView', { date: getPrevDate(date) })
          }
        >
          <Text style={styles.dayNavText}>← Prev</Text>
        </TouchableOpacity>

        <View style={styles.dayNavCenter}>
          <Text
            style={[styles.dayNameBig, dayData.isToday && styles.todayColor]}
          >
            {dayData.dayName}
          </Text>
          <Text style={styles.dayDateBig}>
            {dayData.monthName} {dayData.dayOfMonth}, {dayData.year}
          </Text>
          {dayData.isToday && (
            <View style={styles.todayBadge}>
              <Text style={styles.todayBadgeText}>TODAY</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.dayNavBtn}
          onPress={() =>
            navigation.replace('DailyView', { date: getNextDate(date) })
          }
        >
          <Text style={styles.dayNavText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <NavigationButton
          title="✅ To-Do"
          variant="small"
          onPress={() => navigation.navigate('TodoList')}
        />
        <NavigationButton
          title="📝 Notes"
          variant="small"
          onPress={() => navigation.navigate('NotesJournal')}
        />
        <NavigationButton
          title="📅 Calendar"
          variant="small"
          onPress={openExternalCalendar}
        />
      </View>

      <View style={styles.tabs}>
        {(['schedule', 'handwrite'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab === 'schedule' ? '📋 Schedule' : '✏️ Handwrite'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'schedule' ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View>
            {events
              .filter((e) => e.allDay)
              .map((e) => (
                <View
                  key={e.id}
                  style={[
                    styles.allDayEvent,
                    { borderLeftColor: e.color ?? COLORS.accent },
                  ]}
                >
                  <Text style={styles.allDayBadge}>ALL DAY</Text>
                  <Text style={styles.allDayTitle}>{e.title}</Text>
                </View>
              ))}

            {hours.map((hour) => {
              const evts = eventsAtHour(hour);
              return (
                <View key={hour} style={styles.hourRow}>
                  <View style={styles.hourLabel}>
                    <Text style={styles.hourText}>{hour}</Text>
                  </View>
                  <View style={styles.hourContent}>
                    {evts.map((e) => (
                      <View
                        key={e.id}
                        style={[
                          styles.scheduleEvent,
                          { borderLeftColor: e.color ?? COLORS.accent },
                        ]}
                      >
                        <Text style={styles.evtTime}>
                          {format(new Date(e.startDate), 'HH:mm')} –{' '}
                          {format(new Date(e.endDate), 'HH:mm')}
                        </Text>
                        <Text style={styles.evtTitle}>{e.title}</Text>
                        <Text style={styles.evtSource}>
                          {e.calendarSource}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            {events.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📅</Text>
                <Text style={styles.emptyText}>No events today</Text>
                <TouchableOpacity
                  style={styles.openCalBtn}
                  onPress={openExternalCalendar}
                >
                  <Text style={styles.openCalBtnText}>
                    Open Calendar App
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.handwriteContainer}>
          <Text style={styles.canvasLabel}>
            ✏️ Write your appointments & notes below
          </Text>
          {!loading && (
            <HandwritingCanvas
              key={`canvas-${date}-${canvasKey}`}
              initialDrawings={drawings}
              onDrawingsChange={handleDrawChange}
              height={520}
              showLines
              lineSpacing={32}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  dayNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
  },
  dayNavBtn: { padding: 8 },
  dayNavText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  dayNavCenter: { alignItems: 'center' },
  dayNameBig: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  todayColor: { color: COLORS.highlight },
  dayDateBig: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  todayBadge: {
    backgroundColor: COLORS.todayBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  todayBadgeText: {
    color: COLORS.highlight,
    fontSize: 10,
    fontWeight: '800',
  },

  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.secondary },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: COLORS.highlight },
  tabText: { color: COLORS.textSecondary, fontSize: 15, fontWeight: '600' },
  activeTabText: { color: COLORS.text },

  scroll: { padding: 12, paddingBottom: 40 },

  handwriteContainer: {
    flex: 1,
    padding: 12,
  },

  allDayEvent: {
    backgroundColor: COLORS.cardBg,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allDayBadge: {
    color: COLORS.highlight,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: COLORS.todayBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  allDayTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600' },

  hourRow: {
    flexDirection: 'row',
    minHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cardBorder,
  },
  hourLabel: {
    width: 56,
    paddingTop: 8,
    paddingRight: 8,
    alignItems: 'flex-end',
  },
  hourText: { color: COLORS.textSecondary, fontSize: 12 },
  hourContent: {
    flex: 1,
    paddingVertical: 4,
    borderLeftWidth: 1,
    borderLeftColor: COLORS.cardBorder,
    paddingLeft: 8,
  },
  scheduleEvent: {
    backgroundColor: COLORS.cardBg,
    padding: 8,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
  },
  evtTime: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  evtTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  evtSource: {
    color: COLORS.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    marginTop: 2,
  },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { color: COLORS.textSecondary, fontSize: 16, marginBottom: 20 },
  openCalBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  openCalBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },

  canvasLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
});
