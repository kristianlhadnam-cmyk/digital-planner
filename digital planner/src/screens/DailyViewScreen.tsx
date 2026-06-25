import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
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

  const [isDrawMode, setIsDrawMode] = useState(false);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
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
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [date]);

  const loadData = async () => {
    setLoading(true);
    isInitialLoad.current = true;
    try { const saved = await getDayDrawings(date); drawingsRef.current = saved || []; setDrawings(saved || []); } catch {}
    try { setCalendarEvents(await getEventsForDate(date)); } catch {}
    try { setCustomEvents(await getCustomEvents(date)); } catch {}
    setLoading(false);
    setTimeout(() => { isInitialLoad.current = false; }, 500);
  };

  const persistDrawings = useCallback(async (newDrawings: DrawingPath[]) => {
    if (isInitialLoad.current || !date) return;
    drawingsRef.current = newDrawings;
    setDrawings(newDrawings);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => { try { await saveDayDrawings(date, newDrawings); } catch {} }, 500);
  }, [date]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => isDrawMode,
    onMoveShouldSetPanResponder: () => isDrawMode,
    onStartShouldSetPanResponderCapture: () => isDrawMode,
    onMoveShouldSetPanResponderCapture: () => isDrawMode,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX, y = evt.nativeEvent.locationY;
      if (eraserRef.current) {
        const filtered = drawingsRef.current.filter((p) => !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25));
        if (filtered.length !== drawingsRef.current.length) persistDrawings(filtered);
      } else { currentPointsRef.current = [{ x, y }]; setCurrentPoints([{ x, y }]); }
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX, y = evt.nativeEvent.locationY;
      if (eraserRef.current) {
        const filtered = drawingsRef.current.filter((p) => !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25));
        if (filtered.length !== drawingsRef.current.length) persistDrawings(filtered);
        return;
      }
      const last = currentPointsRef.current[currentPointsRef.current.length - 1];
      if (last) { const dx = x - last.x, dy = y - last.y; if (dx * dx + dy * dy < 2) return; }
      currentPointsRef.current = [...currentPointsRef.current, { x, y }];
      setCurrentPoints([...currentPointsRef.current]);
    },
    onPanResponderRelease: () => {
      if (eraserRef.current) return;
      if (currentPointsRef.current.length > 0) {
        persistDrawings([...drawingsRef.current, { id: generateId(), points: [...currentPointsRef.current], color: colorRef.current, strokeWidth: sizeRef.current }]);
      }
      currentPointsRef.current = []; setCurrentPoints([]);
    },
    onPanResponderTerminate: () => {
      if (currentPointsRef.current.length > 0 && !eraserRef.current) {
        persistDrawings([...drawingsRef.current, { id: generateId(), points: [...currentPointsRef.current], color: colorRef.current, strokeWidth: sizeRef.current }]);
      }
      currentPointsRef.current = []; setCurrentPoints([]);
    },
  })).current;

  const pointsToPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  };

  const clearDrawings = () => persistDrawings([]);
  const undoLast = () => persistDrawings(drawingsRef.current.slice(0, -1));

  const parseEventText = (text: string): { time: string | null; title: string; allDay: boolean } => {
    const trimmed = text.trim();
    const allDayMatch = trimmed.match(/^(all\s*day|allday)\s*[-:]?\s*(.+)/i);
    if (allDayMatch) return { time: null, title: allDayMatch[2].trim(), allDay: true };
    const timeMatch = trimmed.match(/^(\d{1,2})[:.]?(\d{2})?\s*[-:]?\s*(.+)/);
    if (timeMatch) {
      const hour = timeMatch[1].padStart(2, '0'), minute = (timeMatch[2] || '00').padStart(2, '0'), title = timeMatch[3].trim();
      if (parseInt(hour) >= 0 && parseInt(hour) < 24) return { time: `${hour}:${minute}`, title, allDay: false };
    }
    return { time: null, title: trimmed, allDay: true };
  };

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text) { Alert.alert('Empty', 'Please enter an event description.'); return; }
    const parsed = parseEventText(text);
    if (!parsed.title) { Alert.alert('Missing', 'Add a title after the time.'); return; }
    const eventDate = new Date(date + 'T00:00:00');
    let startDate: Date, endDate: Date;
    if (parsed.allDay) {
      startDate = new Date(eventDate); startDate.setHours(0,0,0,0); endDate = new Date(eventDate); endDate.setHours(23,59,59,999);
    } else if (parsed.time) {
      const [h,m] = parsed.time.split(':').map(Number);
      startDate = new Date(eventDate); startDate.setHours(h,m,0,0); endDate = new Date(startDate); endDate.setHours(h+1,m,0,0);
    } else return;
    try {
      await saveCustomEvent(date, { id: `custom_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, title: parsed.title, startDate: startDate.toISOString(), endDate: endDate.toISOString(), allDay: parsed.allDay, calendarSource: 'local', color: COLORS.highlight });
      setCustomEvents(await getCustomEvents(date)); setQuickAddText(''); setShowQuickAdd(false);
    } catch {}
  };

  const handleDeleteCustomEvent = (eventId: string, title: string) => {
    Alert.alert('Delete', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCustomEvent(date, eventId); setCustomEvents(await getCustomEvents(date) || []); }},
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
    <SafeAreaView className="flex-1 bg-background">
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
      <View className="flex-row justify-between items-center px-3 py-2.5 bg-primary">
        <TouchableOpacity className="p-2" onPress={() => navigation.replace('DailyView', { date: getPrevDate(date) })}>
          <Text className="text-accent text-sm font-semibold">← Prev</Text>
        </TouchableOpacity>
        <View className="items-center">
          <Text className={`text-xl font-extrabold ${dayData.isToday ? 'text-highlight' : 'text-text-primary'}`}>{dayData.dayName}</Text>
          <Text className="text-text-secondary text-sm mt-0.5">{dayData.monthName} {dayData.dayOfMonth}, {dayData.year}</Text>
          {dayData.isToday && <View className="bg-accent rounded px-2 py-0.5 mt-1"><Text className="text-highlight text-xs font-extrabold">TODAY</Text></View>}
        </View>
        <TouchableOpacity className="p-2" onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}>
          <Text className="text-accent text-sm font-semibold">Next →</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-center gap-2.5 py-2 px-3 bg-primary border-b border-card-border">
        <NavigationButton title="✅ To-Do" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notes" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Calendar" variant="small" onPress={openExternalCalendar} />
      </View>

      {/* Quick add */}
      <View className="px-3 pt-2 pb-1">
        {!showQuickAdd ? (
          <TouchableOpacity className="bg-highlight p-3 rounded-xl items-center" onPress={() => setShowQuickAdd(true)} activeOpacity={0.7}>
            <Text className="text-white text-sm font-bold">➕ Add Event</Text>
          </TouchableOpacity>
        ) : (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
            <View className="bg-card p-3.5 rounded-xl border-2 border-highlight">
              <View className="flex-row justify-between items-center mb-1.5">
                <Text className="text-highlight text-base font-bold">➕ Quick Add Event</Text>
                <TouchableOpacity onPress={() => { setQuickAddText(''); setShowQuickAdd(false); }}>
                  <Text className="text-text-secondary text-lg font-bold p-1">✕</Text>
                </TouchableOpacity>
              </View>
              <Text className="text-text-secondary text-xs mb-2">e.g. "9:00 Meeting" or "All day - Vacation"</Text>
              <TextInput
                className="bg-background rounded-lg p-3 text-text-primary text-base mb-2.5 border border-card-border"
                value={quickAddText} onChangeText={setQuickAddText}
                placeholder="Type time + event..." placeholderTextColor={COLORS.textSecondary}
                autoFocus returnKeyType="done" onSubmitEditing={handleQuickAdd}
              />
              <TouchableOpacity className="bg-success rounded-lg py-3 items-center" onPress={handleQuickAdd} activeOpacity={0.7}>
                <Text className="text-white font-bold text-sm">✓ Add</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>

      {/* Main content */}
      <View className="flex-1 relative">
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 12, paddingBottom: 80 }} scrollEnabled={!isDrawMode} showsVerticalScrollIndicator={!isDrawMode} nestedScrollEnabled>
          {allDayEvents.map((e) => (
            <View key={e.id} className={`bg-card p-2.5 rounded-lg mb-2 flex-row items-center gap-2 border-l-4 ${isCustomEvent(e) ? 'border-highlight border' : ''}`} style={{ borderLeftColor: e.color ?? COLORS.accent }}>
              <Text className="text-highlight text-xs font-extrabold bg-accent px-1.5 py-0.5 rounded overflow-hidden">ALL DAY</Text>
              <Text className="text-text-primary text-sm font-semibold flex-1">{e.title}</Text>
              {isCustomEvent(e) && <TouchableOpacity onPress={() => handleDeleteCustomEvent(e.id, e.title)}><Text className="text-base p-1">🗑️</Text></TouchableOpacity>}
            </View>
          ))}
          {hours.map((hour) => {
            const evts = eventsAtHour(hour);
            return (
              <View key={hour} className="flex-row min-h-[44px] border-b border-card-border">
                <View className="w-14 pt-2 pr-2 items-end"><Text className="text-text-secondary text-xs">{hour}</Text></View>
                <View className="flex-1 py-1 pl-2 border-l border-card-border">
                  {evts.map((e) => (
                    <View key={e.id} className={`bg-card p-2.5 rounded-md mb-1 flex-row items-center border-l-[3px] ${isCustomEvent(e) ? 'border-highlight border' : ''}`} style={{ borderLeftColor: e.color ?? COLORS.accent }}>
                      <View className="flex-1">
                        <Text className="text-text-secondary text-xs font-semibold">{format(new Date(e.startDate), 'HH:mm')} - {format(new Date(e.endDate), 'HH:mm')}</Text>
                        <Text className="text-text-primary text-sm font-semibold mt-0.5">{e.title}</Text>
                        {isCustomEvent(e) ? <Text className="text-highlight text-xs font-bold mt-0.5">📝 Custom</Text> : <Text className="text-text-secondary text-[10px] uppercase mt-0.5">{e.calendarSource}</Text>}
                      </View>
                      {isCustomEvent(e) && <TouchableOpacity onPress={() => handleDeleteCustomEvent(e.id, e.title)}><Text className="text-base p-1">🗑️</Text></TouchableOpacity>}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          {allEvents.length === 0 && !loading && (
            <View className="items-center py-16"><Text className="text-5xl mb-3.5">📅</Text><Text className="text-text-primary text-base font-semibold">No events today</Text><Text className="text-text-secondary text-sm mt-2">Tap "➕ Add Event" above to add one</Text></View>
          )}
        </ScrollView>

        {/* Drawing overlay */}
        {isDrawMode && (
          <View className="absolute inset-0" {...panResponder.panHandlers} collapsable={false}>
            <Svg width="100%" height="100%" className="absolute inset-0" pointerEvents="none">
              {drawings.map((path) => (<Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />))}
              {currentPoints.length > 0 && (<Path d={pointsToPath(currentPoints)} stroke={selectedColor} strokeWidth={selectedSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
            </Svg>
          </View>
        )}
        {!isDrawMode && drawings.length > 0 && (
          <Svg width="100%" height="100%" className="absolute inset-0" pointerEvents="none">
            {drawings.map((path) => (<Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />))}
          </Svg>
        )}
      </View>

      {/* Drawing toolbar */}
      {isDrawMode && showToolbar && (
        <View className="bg-secondary border-t border-card-border p-2.5">
          <View className="flex-row items-center gap-1.5 mb-1.5">
            <Text className="text-text-secondary text-xs font-bold w-10">Color:</Text>
            {PEN_COLORS.map((color) => (<TouchableOpacity key={color} className="w-7 h-7 rounded-full border-2 border-transparent" style={{ backgroundColor: color, ...(selectedColor === color && !isEraser ? { borderColor: '#ffffff', transform: [{ scale: 1.2 }] } : {}) }} onPress={() => { setSelectedColor(color); setIsEraser(false); }} />))}
          </View>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-text-secondary text-xs font-bold w-10">Size:</Text>
            {PEN_SIZES.map((size) => (<TouchableOpacity key={size} className={`w-[34px] h-[34px] rounded-full bg-card items-center justify-center border-2 ${selectedSize === size ? 'border-highlight' : 'border-transparent'}`} onPress={() => setSelectedSize(size)}><View className="rounded-full bg-text-primary" style={{ width: size * 2.5, height: size * 2.5 }} /></TouchableOpacity>))}
            <View className="flex-row gap-1.5 ml-auto">
              <TouchableOpacity className={`px-2.5 py-1.5 bg-card rounded-lg border border-card-border ${isEraser ? 'border-highlight bg-accent' : ''}`} onPress={() => setIsEraser(!isEraser)}><Text className="text-base">🧹</Text></TouchableOpacity>
              <TouchableOpacity className="px-2.5 py-1.5 bg-card rounded-lg border border-card-border" onPress={undoLast}><Text className="text-base">↩️</Text></TouchableOpacity>
              <TouchableOpacity className="px-2.5 py-1.5 bg-card rounded-lg border border-card-border" onPress={clearDrawings}><Text className="text-base">🗑️</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating draw toggle */}
      <TouchableOpacity
        className={`absolute bottom-5 right-4 w-[52px] h-[52px] rounded-full items-center justify-center shadow-lg ${isDrawMode ? 'bg-success' : 'bg-accent'}`}
        onPress={() => { setIsDrawMode(!isDrawMode); if (!isDrawMode) setShowToolbar(true); }}
        activeOpacity={0.85}
      >
        <Text className="text-xl text-white font-bold">{isDrawMode ? '✕ Done' : '✏️'}</Text>
      </TouchableOpacity>

      {/* Draw mode indicator */}
      {isDrawMode && (
        <View className="absolute top-0 left-0 right-0 bg-highlight/90 py-1.5 items-center">
          <Text className="text-white text-xs font-semibold">✏️ Draw mode — scroll disabled. Tap ✓ when done.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
