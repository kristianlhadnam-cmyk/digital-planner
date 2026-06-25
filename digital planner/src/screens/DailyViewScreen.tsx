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
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, startOfWeek } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { RootStackParamList, DrawingPath, Point, CalendarEvent } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import { getDayData, getHoursOfDay, getPrevDate, getNextDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
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

const generateId = (): string => {
  return `path_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export default function DailyViewScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const dayData = getDayData(date);
  const hours = getHoursOfDay();

  // Draw state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  // Schedule state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');

  const drawingsRef = useRef<DrawingPath[]>([]);
  const currentPointsRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);
  const saveTimeoutRef = useRef<any>(null);
  const isInitialLoad = useRef(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { sizeRef.current = selectedSize; }, [selectedSize]);
  useEffect(() => { eraserRef.current = isEraser; }, [isEraser]);

  useEffect(() => {
    loadData();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    try {
      const saved = await getDayDrawings(date);
      drawingsRef.current = saved || [];
      setDrawings(saved || []);
    } catch { setDrawings([]); }
    try {
      const cal = await getEventsForDate(date);
      setCalendarEvents(cal);
    } catch { setCalendarEvents([]); }
    try {
      const custom = await getCustomEvents(date);
      setCustomEvents(custom || []);
    } catch { setCustomEvents([]); }
    setLoading(false);
    setTimeout(() => { isInitialLoad.current = false; }, 500);
  };

  const persistDrawings = useCallback(async (newDrawings: DrawingPath[]) => {
    if (isInitialLoad.current || !date) return;
    drawingsRef.current = newDrawings;
    setDrawings(newDrawings);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      try { await saveDayDrawings(date, newDrawings); } catch {}
    }, 500);
  }, [date]);

  // Drawing PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDrawMode,
      onMoveShouldSetPanResponder: () => isDrawMode,
      onStartShouldSetPanResponderCapture: () => isDrawMode,
      onMoveShouldSetPanResponderCapture: () => isDrawMode,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const filtered = drawingsRef.current.filter((p) =>
            !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25)
          );
          if (filtered.length !== drawingsRef.current.length) {
            persistDrawings(filtered);
          }
        } else {
          currentPointsRef.current = [{ x, y }];
          setCurrentPoints([{ x, y }]);
        }
      },

      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const filtered = drawingsRef.current.filter((p) =>
            !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25)
          );
          if (filtered.length !== drawingsRef.current.length) persistDrawings(filtered);
          return;
        }

        const last = currentPointsRef.current[currentPointsRef.current.length - 1];
        if (last) {
          const dx = x - last.x, dy = y - last.y;
          if (dx * dx + dy * dy < 2) return;
        }
        currentPointsRef.current = [...currentPointsRef.current, { x, y }];
        setCurrentPoints([...currentPointsRef.current]);
      },

      onPanResponderRelease: () => {
        if (eraserRef.current) return;
        if (currentPointsRef.current.length > 0) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPointsRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };
          persistDrawings([...drawingsRef.current, newPath]);
        }
        currentPointsRef.current = [];
        setCurrentPoints([]);
      },

      onPanResponderTerminate: () => {
        if (currentPointsRef.current.length > 0 && !eraserRef.current) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPointsRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };
          persistDrawings([...drawingsRef.current, newPath]);
        }
        currentPointsRef.current = [];
        setCurrentPoints([]);
      },
    })
  ).current;

  const pointsToPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1)
      return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  };

  const clearDrawings = () => persistDrawings([]);
  const undoLast = () => persistDrawings(drawingsRef.current.slice(0, -1));

  // Quick add event
  const parseEventText = (text: string): { time: string | null; title: string; allDay: boolean } => {
    const trimmed = text.trim();
    const allDayMatch = trimmed.match(/^(all\s*day|allday)\s*[-:]?\s*(.+)/i);
    if (allDayMatch) return { time: null, title: allDayMatch[2].trim(), allDay: true };
    const timeMatch = trimmed.match(/^(\d{1,2})[:.]?(\d{2})?\s*[-:]?\s*(.+)/);
    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, '0');
      const minute = (timeMatch[2] || '00').padStart(2, '0');
      const title = timeMatch[3].trim();
      if (parseInt(hour) >= 0 && parseInt(hour) < 24) return { time: `${hour}:${minute}`, title, allDay: false };
    }
    return { time: null, title: trimmed, allDay: true };
  };

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text) { Alert.alert('Empty Text', 'Please enter an event description.'); return; }
    const parsed = parseEventText(text);
    if (!parsed.title) { Alert.alert('Missing Title', 'Please add a title after the time.'); return; }
    const eventDate = new Date(date + 'T00:00:00');
    let startDate: Date, endDate: Date;
    if (parsed.allDay) {
      startDate = new Date(eventDate); startDate.setHours(0, 0, 0, 0);
      endDate = new Date(eventDate); endDate.setHours(23, 59, 59, 999);
    } else if (parsed.time) {
      const [h, m] = parsed.time.split(':').map(Number);
      startDate = new Date(eventDate); startDate.setHours(h, m, 0, 0);
      endDate = new Date(startDate); endDate.setHours(h + 1, m, 0, 0);
    } else return;

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
    } catch { Alert.alert('Error', 'Could not save event.'); }
  };

  const handleDeleteCustomEvent = (eventId: string, title: string) => {
    Alert.alert('Delete Event', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await deleteCustomEvent(date, eventId); const u = await getCustomEvents(date); setCustomEvents(u || []); } catch {}
      }},
    ]);
  };

  const allEvents = [...calendarEvents, ...customEvents];
  const eventsAtHour = (hour: string): CalendarEvent[] => {
    const h = parseInt(hour.split(':')[0], 10);
    return allEvents.filter((e) => !e.allDay && new Date(e.startDate).getHours() === h);
  };
  const weekStart = startOfWeek(dayData.date, { weekStartsOn: 1 });
  const isCustomEvent = (event: CalendarEvent) => event.id.startsWith('custom_');

  const allDayEvents = allEvents.filter((e) => e.allDay);

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={dayData.year}
        onYearPress={() => navigation.navigate('YearlyView', { year: dayData.year })}
        monthName={dayData.monthName}
        onMonthPress={() => navigation.navigate('MonthlyView', { year: dayData.year, month: dayData.month })}
        weekNumber={dayData.weekNumber}
        onWeekPress={() => navigation.navigate('WeeklyView', { year: dayData.year, weekNumber: dayData.weekNumber, startDate: format(weekStart, 'yyyy-MM-dd') })}
        title={`${dayData.dayName.slice(0, 3)} ${dayData.dayOfMonth}`}
      />

      {/* Day nav */}
      <View style={styles.dayNav}>
        <TouchableOpacity style={styles.dayNavBtn} onPress={() => navigation.replace('DailyView', { date: getPrevDate(date) })}>
          <Text style={styles.dayNavText}>← Prev</Text>
        </TouchableOpacity>
        <View style={styles.dayNavCenter}>
          <Text style={[styles.dayNameBig, dayData.isToday && styles.todayColor]}>{dayData.dayName}</Text>
          <Text style={styles.dayDateBig}>{dayData.monthName} {dayData.dayOfMonth}, {dayData.year}</Text>
          {dayData.isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>TODAY</Text></View>}
        </View>
        <TouchableOpacity style={styles.dayNavBtn} onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}>
          <Text style={styles.dayNavText}>Next →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <NavigationButton title="✅ To-Do" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notes" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Calendar" variant="small" onPress={openExternalCalendar} />
      </View>

      {/* Quick add / draw toggle row */}
      <View style={styles.actionRow}>
        {!showQuickAdd ? (
          <TouchableOpacity style={styles.addEventBtn} onPress={() => setShowQuickAdd(true)} activeOpacity={0.7}>
            <Text style={styles.addEventBtnText}>➕ Add Event</Text>
          </TouchableOpacity>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
            <View style={styles.quickAddForm}>
              <View style={styles.quickAddHeader}>
                <Text style={styles.quickAddLabel}>➕ Quick Add Event</Text>
                <TouchableOpacity onPress={() => { setQuickAddText(''); setShowQuickAdd(false); }}>
                  <Text style={styles.quickAddClose}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.quickAddHint}>e.g. "9:00 Meeting" or "All day - Vacation"</Text>
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
              <TouchableOpacity style={styles.btnAdd} onPress={handleQuickAdd} activeOpacity={0.7}>
                <Text style={styles.btnAddText}>✓ Add</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Main content area with drawing overlay */}
      <View style={styles.mainContent}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          scrollEnabled={!isDrawMode}
          showsVerticalScrollIndicator={!isDrawMode}
          nestedScrollEnabled
        >
          {/* All day events */}
          {allDayEvents.map((e) => (
            <View key={e.id} style={[styles.allDayEvent, { borderLeftColor: e.color ?? COLORS.accent }, isCustomEvent(e) && styles.customEventCard]}>
              <Text style={styles.allDayBadge}>ALL DAY</Text>
              <Text style={styles.allDayTitle}>{e.title}</Text>
              {isCustomEvent(e) && (
                <TouchableOpacity onPress={() => handleDeleteCustomEvent(e.id, e.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
                    <View key={e.id} style={[styles.scheduleEvent, { borderLeftColor: e.color ?? COLORS.accent }, isCustomEvent(e) && styles.customEventCard]}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.evtTime}>{format(new Date(e.startDate), 'HH:mm')} - {format(new Date(e.endDate), 'HH:mm')}</Text>
                        <Text style={styles.evtTitle}>{e.title}</Text>
                        {isCustomEvent(e) ? (
                          <Text style={styles.customBadge}>📝 Custom</Text>
                        ) : (
                          <Text style={styles.evtSource}>{e.calendarSource}</Text>
                        )}
                      </View>
                      {isCustomEvent(e) && (
                        <TouchableOpacity onPress={() => handleDeleteCustomEvent(e.id, e.title)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
              <Text style={styles.emptyHint}>Tap "➕ Add Event" above to add one</Text>
            </View>
          )}
        </ScrollView>

        {/* Drawing overlay - only intercepts touches in draw mode */}
        {isDrawMode && (
          <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers} collapsable={false}>
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
              {drawings.map((path) => (
                <Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {currentPoints.length > 0 && (
                <Path d={pointsToPath(currentPoints)} stroke={selectedColor} strokeWidth={selectedSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </Svg>
          </View>
        )}

        {/* Show existing drawings as overlay also when NOT in draw mode */}
        {!isDrawMode && drawings.length > 0 && (
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
            {drawings.map((path) => (
              <Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
            ))}
          </Svg>
        )}
      </View>

      {/* Draw mode toolbar */}
      {isDrawMode && showToolbar && (
        <View style={styles.drawToolbar}>
          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>Color:</Text>
            {PEN_COLORS.map((color) => (
              <TouchableOpacity key={color} style={[styles.colorBtn, { backgroundColor: color }, selectedColor === color && !isEraser && styles.colorSelected]} onPress={() => { setSelectedColor(color); setIsEraser(false); }} />
            ))}
          </View>
          <View style={styles.toolRow}>
            <Text style={styles.toolLabel}>Size:</Text>
            {PEN_SIZES.map((size) => (
              <TouchableOpacity key={size} style={[styles.sizeBtn, selectedSize === size && styles.sizeSelected]} onPress={() => setSelectedSize(size)}>
                <View style={[styles.sizeDot, { width: size * 2.5, height: size * 2.5 }]} />
              </TouchableOpacity>
            ))}
            <View style={styles.toolActions}>
              <TouchableOpacity style={[styles.toolActionBtn, isEraser && styles.toolActionActive]} onPress={() => setIsEraser(!isEraser)}>
                <Text style={styles.toolActionText}>🧹</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolActionBtn} onPress={undoLast}>
                <Text style={styles.toolActionText}>↩️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolActionBtn} onPress={clearDrawings}>
                <Text style={styles.toolActionText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating draw mode toggle */}
      <TouchableOpacity
        style={[styles.drawToggle, isDrawMode && styles.drawToggleActive]}
        onPress={() => {
          setIsDrawMode(!isDrawMode);
          if (!isDrawMode) setShowToolbar(true);
        }}
        activeOpacity={0.85}
      >
        <Text style={styles.drawToggleText}>{isDrawMode ? '✕ Done' : '✏️'}</Text>
      </TouchableOpacity>

      {/* Draw mode indicator */}
      {isDrawMode && (
        <View style={styles.drawModeIndicator}>
          <Text style={styles.drawModeIndicatorText}>
            ✏️ Draw mode — scroll disabled. Tap ✓ when done.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  dayNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.primary,
  },
  dayNavBtn: { padding: 8 },
  dayNavText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  dayNavCenter: { alignItems: 'center' },
  dayNameBig: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  todayColor: { color: COLORS.highlight },
  dayDateBig: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  todayBadge: { backgroundColor: COLORS.todayBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  todayBadgeText: { color: COLORS.highlight, fontSize: 10, fontWeight: '800' },

  quickActions: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.primary,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },

  actionRow: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  addEventBtn: {
    backgroundColor: COLORS.highlight, padding: 12, borderRadius: 10, alignItems: 'center',
  },
  addEventBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  quickAddForm: {
    backgroundColor: COLORS.cardBg, padding: 14, borderRadius: 12,
    borderWidth: 2, borderColor: COLORS.highlight,
  },
  quickAddHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quickAddLabel: { color: COLORS.highlight, fontSize: 15, fontWeight: '700' },
  quickAddClose: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700', padding: 4 },
  quickAddHint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  quickAddInput: {
    backgroundColor: COLORS.background, borderRadius: 8, padding: 12,
    color: COLORS.text, fontSize: 15, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.cardBorder,
  },
  btnAdd: { backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  btnAddText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },

  mainContent: { flex: 1, position: 'relative' },
  scroll: { padding: 12, paddingBottom: 80 },

  allDayEvent: {
    backgroundColor: COLORS.cardBg, padding: 10, borderRadius: 8, marginBottom: 8,
    borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  customEventCard: { borderWidth: 1, borderColor: COLORS.highlight },
  allDayBadge: {
    color: COLORS.highlight, fontSize: 10, fontWeight: '800',
    backgroundColor: COLORS.todayBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
  },
  allDayTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 },

  hourRow: { flexDirection: 'row', minHeight: 44, borderBottomWidth: 0.5, borderBottomColor: COLORS.cardBorder },
  hourLabel: { width: 56, paddingTop: 8, paddingRight: 8, alignItems: 'flex-end' },
  hourText: { color: COLORS.textSecondary, fontSize: 12 },
  hourContent: { flex: 1, paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder, paddingLeft: 8 },
  scheduleEvent: {
    backgroundColor: COLORS.cardBg, padding: 10, borderRadius: 6, marginBottom: 4,
    borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center',
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

  // Drawing toolbar
  drawToolbar: {
    backgroundColor: COLORS.secondary, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, padding: 10,
  },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  toolLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', width: 40 },
  colorBtn: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#ffffff', transform: [{ scale: 1.2 }] },
  sizeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sizeSelected: { borderColor: COLORS.highlight },
  sizeDot: { borderRadius: 20, backgroundColor: COLORS.text },
  toolActions: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
  toolActionBtn: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.cardBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  toolActionActive: { borderColor: COLORS.highlight, backgroundColor: COLORS.todayBg },
  toolActionText: { fontSize: 16 },

  // Floating draw mode toggle
  drawToggle: {
    position: 'absolute', bottom: 20, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  drawToggleActive: { backgroundColor: COLORS.success },
  drawToggleText: { fontSize: 20, color: COLORS.white, fontWeight: '700' },

  // Draw mode indicator
  drawModeIndicator: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(233, 69, 96, 0.9)', paddingVertical: 6, alignItems: 'center',
  },
  drawModeIndicatorText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },
});
