import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { 
  getDayDrawings, 
  saveDayDrawings,
  getCustomEvents,
  saveCustomEvent,
  deleteCustomEvent,
} from '../services/StorageService';
import { getEventsForDate, openExternalCalendar } from '../services/CalendarService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DailyView'>;
  route: RouteProp<RootStackParamList, 'DailyView'>;
};

type TabType = 'schedule' | 'handwrite';

export default function DailyViewScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const dayData = getDayData(date);
  const hours = getHoursOfDay();

  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [loading, setLoading] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);
  
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');

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
      setCalendarEvents(cal);
    } catch {
      setCalendarEvents([]);
    }

    try {
      const custom = await getCustomEvents(date);
      setCustomEvents(custom || []);
    } catch {
      setCustomEvents([]);
    }

    setLoading(false);
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);
  };

  const handleDrawChange = useCallback(
    (newDrawings: DrawingPath[]) => {
      if (isInitialLoad.current) return;

      drawingsRef.current = newDrawings;
      setDrawings(newDrawings);

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

  // Parse text like "9:00 Meeting" or "14:30 Doctor"
  const parseEventText = (text: string): { time: string | null; title: string; allDay: boolean } => {
    const trimmed = text.trim();
    
    // Check for "all day" or "allday"
    const allDayMatch = trimmed.match(/^(all\s*day|allday)\s*[-:]?\s*(.+)/i);
    if (allDayMatch) {
      return { time: null, title: allDayMatch[2].trim(), allDay: true };
    }
    
    // Check for time pattern: "9:00", "09:00", "9.00", "9 ", etc.
    const timeMatch = trimmed.match(/^(\d{1,2})[:.]?(\d{2})?\s*[-:]?\s*(.+)/);
    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = (timeMatch[2] || '00').padStart(2, '0');
      const title = timeMatch[3].trim();
      
      if (parseInt(hour) >= 0 && parseInt(hour) < 24) {
        return { time: `${hour}:${minute}`, title, allDay: false };
      }
    }
    
    // No time found — treat whole text as title (all day)
    return { time: null, title: trimmed, allDay: true };
  };

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text) {
      Alert.alert('Empty Text', 'Please enter an event description.');
      return;
    }

    const parsed = parseEventText(text);
    
    if (!parsed.title) {
      Alert.alert('Missing Title', 'Please add a title after the time.');
      return;
    }

    // Build dates
    const eventDate = new Date(date + 'T00:00:00');
    let startDate: Date;
    let endDate: Date;

    if (parsed.allDay) {
      startDate = new Date(eventDate);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(eventDate);
      endDate.setHours(23, 59, 59, 999);
    } else if (parsed.time) {
      const [h, m] = parsed.time.split(':').map(Number);
      startDate = new Date(eventDate);
      startDate.setHours(h, m, 0, 0);
      endDate = new Date(startDate);
      endDate.setHours(h + 1, m, 0, 0); // 1 hour default
    } else {
      return;
    }

    const newEvent: CalendarEvent = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: parsed.title,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      allDay: parsed.allDay,
      calendarSource: 'local',
      color: COLORS.highlight,
    };

    try {
      await saveCustomEvent(date, newEvent);
      const updated = await getCustomEvents(date);
      setCustomEvents(updated || []);
      setQuickAddText('');
      setShowQuickAdd(false);
    } catch (e) {
      console.log('Save event error:', e);
      Alert.alert('Error', 'Could not save event.');
    }
  };

  const handleDeleteCustomEvent = (eventId: string, title: string) => {
    Alert.alert(
      'Delete Event',
      `Delete "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCustomEvent(date, eventId);
              const updated = await getCustomEvents(date);
              setCustomEvents(updated || []);
            } catch (e) {
              console.log('Delete error:', e);
            }
          },
        },
      ]
    );
  };

  // Combine calendar events + custom events
  const allEvents = [...calendarEvents, ...customEvents];

  const eventsAtHour = (hour: string): CalendarEvent[] => {
    const h = parseInt(hour.split(':')[0], 10);
    return allEvents.filter(
      (e) => !e.allDay && new Date(e.startDate).getHours() === h
    );
  };

  const weekStart = startOfWeek(dayData.date, { weekStartsOn: 1 });
  const isCustomEvent = (event: CalendarEvent) => event.id.startsWith('custom_');

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={dayData.year}
        onYearPress={() => navigation.navigate('YearlyView', { year: dayData.year })}
        monthName={dayData.monthName}
        onMonthPress={() =>
          navigation.navigate('MonthlyView', { year: dayData.year, month: dayData.month })
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
          onPress={() => navigation.replace('DailyView', { date: getPrevDate(date) })}
        >
          <Text style={styles.dayNavText}>← Prev</Text>
        </TouchableOpacity>

        <View style={styles.dayNavCenter}>
          <Text style={[styles.dayNameBig, dayData.isToday && styles.todayColor]}>
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
          onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}
        >
          <Text style={styles.dayNavText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <NavigationButton title="✅ To-Do" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notes" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Calendar" variant="small" onPress={openExternalCalendar} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'schedule' && styles.activeTab]}
          onPress={() => setActiveTab('schedule')}
        >
          <Text style={[styles.tabText, activeTab === 'schedule' && styles.activeTabText]}>
            📋 Schedule
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'handwrite' && styles.activeTab]}
          onPress={() => setActiveTab('handwrite')}
        >
          <Text style={[styles.tabText, activeTab === 'handwrite' && styles.activeTabText]}>
            ✏️ Handwrite Notes
          </Text>
        </TouchableOpacity>
      </View>

      {/* SCHEDULE TAB */}
      {activeTab === 'schedule' && (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={120}
        >
          {/* Quick Add Bar */}
          {showQuickAdd ? (
            <View style={styles.quickAddForm}>
              <Text style={styles.quickAddLabel}>
                ➕ Quick Add Event
              </Text>
              <Text style={styles.quickAddHint}>
                Examples:{'\n'}
                • "9:00 Meeting with John"{'\n'}
                • "14:30 Doctor appointment"{'\n'}
                • "All day - Vacation"
              </Text>
              <TextInput
                style={styles.quickAddInput}
                value={quickAddText}
                onChangeText={setQuickAddText}
                placeholder="Type time + event..."
                placeholderTextColor={COLORS.textSecondary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleQuickAdd}
              />
              <View style={styles.quickAddBtns}>
                <TouchableOpacity 
                  style={styles.btnAdd} 
                  onPress={handleQuickAdd}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnAddText}>✓ Add to Schedule</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.btnCancel}
                  onPress={() => {
                    setQuickAddText('');
                    setShowQuickAdd(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.addEventBtn}
              onPress={() => setShowQuickAdd(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.addEventBtnText}>➕ Add Event to Schedule</Text>
            </TouchableOpacity>
          )}

          <ScrollView contentContainerStyle={styles.scroll}>
            <View>
              {/* All day events */}
              {allEvents.filter((e) => e.allDay).map((e) => (
                <View
                  key={e.id}
                  style={[
                    styles.allDayEvent, 
                    { borderLeftColor: e.color ?? COLORS.accent },
                    isCustomEvent(e) && styles.customEventCard,
                  ]}
                >
                  <Text style={styles.allDayBadge}>ALL DAY</Text>
                  <Text style={styles.allDayTitle}>{e.title}</Text>
                  {isCustomEvent(e) && (
                    <TouchableOpacity
                      onPress={() => handleDeleteCustomEvent(e.id, e.title)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.deleteIcon}>🗑️</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Hourly schedule */}
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
                            isCustomEvent(e) && styles.customEventCard,
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.evtTime}>
                              {format(new Date(e.startDate), 'HH:mm')} -{' '}
                              {format(new Date(e.endDate), 'HH:mm')}
                            </Text>
                            <Text style={styles.evtTitle}>{e.title}</Text>
                            {isCustomEvent(e) ? (
                              <Text style={styles.customBadge}>📝 Custom Event</Text>
                            ) : (
                              <Text style={styles.evtSource}>{e.calendarSource}</Text>
                            )}
                          </View>
                          {isCustomEvent(e) && (
                            <TouchableOpacity
                              onPress={() => handleDeleteCustomEvent(e.id, e.title)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                              <Text style={styles.deleteIcon}>🗑️</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}

              {allEvents.length === 0 && !loading && (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyIcon}>📅</Text>
                  <Text style={styles.emptyText}>No events today</Text>
                  <Text style={styles.emptyHint}>
                    Tap "➕ Add Event" above to add one
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* HANDWRITE TAB */}
      {activeTab === 'handwrite' && (
        <View style={styles.handwriteContainer}>
          <Text style={styles.canvasLabel}>
            ✏️ Personal notes for this day (separate from schedule)
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
  todayBadgeText: { color: COLORS.highlight, fontSize: 10, fontWeight: '800' },

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
  tabText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: COLORS.text },

  addEventBtn: {
    backgroundColor: COLORS.highlight,
    margin: 12,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addEventBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },

  quickAddForm: {
    backgroundColor: COLORS.cardBg,
    margin: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.highlight,
  },
  quickAddLabel: {
    color: COLORS.highlight,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  quickAddHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  quickAddInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  quickAddBtns: {
    flexDirection: 'row',
    gap: 10,
  },
  btnAdd: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flex: 1,
    alignItems: 'center',
  },
  btnAddText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  btnCancel: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  btnCancelText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

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
  customEventCard: {
    borderWidth: 1,
    borderColor: COLORS.highlight,
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
  allDayTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 },

  hourRow: {
    flexDirection: 'row',
    minHeight: 44,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cardBorder,
  },
  hourLabel: { width: 56, paddingTop: 8, paddingRight: 8, alignItems: 'flex-end' },
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
    padding: 10,
    borderRadius: 6,
    marginBottom: 4,
    borderLeftWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  evtTime: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  evtTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  evtSource: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  customBadge: { color: COLORS.highlight, fontSize: 10, fontWeight: '700', marginTop: 2 },
  deleteIcon: { fontSize: 16, padding: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },

  canvasLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
});
