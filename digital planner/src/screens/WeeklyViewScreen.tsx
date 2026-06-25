import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { format, addDays, subDays } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { RootStackParamList, DrawingPath, Point, CalendarEvent } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import { getWeekData } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
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

const generateId = (): string => {
  return `path_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export default function WeeklyViewScreen({ navigation, route }: Props) {
  const { year, weekNumber, startDate } = route.params;
  const weekData = useMemo(
    () => getWeekData(year, weekNumber, startDate),
    [year, weekNumber, startDate]
  );

  const [dayDrawings, setDayDrawings] = useState<Record<string, DrawingPath[]>>({});
  const [dayEvents, setDayEvents] = useState<Record<string, CalendarEvent[]>>({});

  // Draw state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [currentDrawing, setCurrentDrawing] = useState<Point[]>([]);

  const drawingsRef = useRef<Record<string, DrawingPath[]>>({});
  const currentPointsRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { sizeRef.current = selectedSize; }, [selectedSize]);
  useEffect(() => { eraserRef.current = isEraser; }, [isEraser]);

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
      let calendarEvts: CalendarEvent[] = [];
      try { calendarEvts = await getEventsForDate(day.dateString); } catch { calendarEvts = []; }
      let customEvts: CalendarEvent[] = [];
      try { customEvts = await getCustomEvents(day.dateString); } catch { customEvts = []; }
      evtMap[day.dateString] = [...calendarEvts, ...customEvts];
    }

    drawingsRef.current = drawMap;
    setDayDrawings(drawMap);
    setDayEvents(evtMap);
  };

  const persistDrawings = useCallback(async (dateString: string, newDrawings: DrawingPath[]) => {
    drawingsRef.current[dateString] = newDrawings;
    setDayDrawings(prev => ({ ...prev, [dateString]: newDrawings }));
    try { await saveDayDrawings(dateString, newDrawings); } catch {}
  }, []);

  const getDrawingPanResponder = (dateString: string) =>
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
          const current = drawingsRef.current[dateString] || [];
          const filtered = current.filter((p) =>
            !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25)
          );
          if (filtered.length !== current.length) persistDrawings(dateString, filtered);
        } else {
          currentPointsRef.current = [{ x, y }];
          setCurrentDrawing([{ x, y }]);
        }
      },

      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const y = evt.nativeEvent.locationY;

        if (eraserRef.current) {
          const current = drawingsRef.current[dateString] || [];
          const filtered = current.filter((p) =>
            !p.points.some((pt) => Math.abs(pt.x - x) < 25 && Math.abs(pt.y - y) < 25)
          );
          if (filtered.length !== current.length) persistDrawings(dateString, filtered);
          return;
        }

        const last = currentPointsRef.current[currentPointsRef.current.length - 1];
        if (last) { const dx = x - last.x, dy = y - last.y; if (dx * dx + dy * dy < 2) return; }
        currentPointsRef.current = [...currentPointsRef.current, { x, y }];
        setCurrentDrawing([...currentPointsRef.current]);
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
          const current = drawingsRef.current[dateString] || [];
          persistDrawings(dateString, [...current, newPath]);
        }
        currentPointsRef.current = [];
        setCurrentDrawing([]);
      },

      onPanResponderTerminate: () => {
        if (currentPointsRef.current.length > 0 && !eraserRef.current) {
          const newPath: DrawingPath = {
            id: generateId(),
            points: [...currentPointsRef.current],
            color: colorRef.current,
            strokeWidth: sizeRef.current,
          };
          const current = drawingsRef.current[dateString] || [];
          persistDrawings(dateString, [...current, newPath]);
        }
        currentPointsRef.current = [];
        setCurrentDrawing([]);
      },
    });

  const pointsToPath = (points: Point[]): string => {
    if (!points || points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  };

  const prevStart = format(subDays(weekData.startDate, 7), 'yyyy-MM-dd');
  const nextStart = format(addDays(weekData.startDate, 7), 'yyyy-MM-dd');
  const primaryMonth = weekData.days[3]?.monthName ?? '';

  const isCustomEvent = (event: CalendarEvent) => event.id.startsWith('custom_');

  const clearAllDrawings = () => {
    weekData.days.forEach(day => persistDrawings(day.dateString, []));
  };

  const undoLastOnAll = () => {
    weekData.days.forEach(day => {
      const current = drawingsRef.current[day.dateString] || [];
      if (current.length > 0) persistDrawings(day.dateString, current.slice(0, -1));
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={year}
        onYearPress={() => navigation.navigate('YearlyView', { year })}
        monthName={primaryMonth}
        onMonthPress={() => navigation.navigate('MonthlyView', { year, month: weekData.month })}
        title={`Week ${weekNumber}`}
      />

      {/* Draw mode indicator */}
      {isDrawMode && (
        <View style={styles.drawModeIndicator}>
          <Text style={styles.drawModeIndicatorText}>
            ✏️ Draw mode — scroll disabled. Draw directly on the schedule!
          </Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        scrollEnabled={!isDrawMode}
        nestedScrollEnabled
      >
        {/* Week nav */}
        <View style={styles.weekNav}>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('WeeklyView', {
                year, weekNumber: weekNumber - 1, startDate: prevStart,
              })
            }
          >
            <Text style={styles.navText}>← Wk {weekNumber - 1}</Text>
          </TouchableOpacity>
          <Text style={styles.weekTitle}>Week {weekNumber}</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('WeeklyView', {
                year, weekNumber: weekNumber + 1, startDate: nextStart,
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
          const panResponder = React.useMemo(() => getDrawingPanResponder(day.dateString), [day.dateString, isDrawMode]);

          return (
            <View
              key={day.dateString}
              style={[styles.dayBlock, day.isToday && styles.todayBlock]}
            >
              {/* Day header */}
              <TouchableOpacity
                style={styles.dayHeader}
                onPress={() => navigation.navigate('DailyView', { date: day.dateString })}
              >
                <View style={styles.dayHeaderLeft}>
                  <Text style={[styles.dayName, day.isToday && styles.todayText]}>
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
                  {drawings.length > 0 && (
                    <Text style={styles.drawBadge}>✏️</Text>
                  )}
                  <Text style={styles.linkArrow}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Events list */}
              {events.length > 0 && (
                <View style={styles.events}>
                  {events.map((evt) => (
                    <View key={evt.id} style={[styles.eventItem, { borderLeftColor: evt.color ?? COLORS.accent }, isCustomEvent(evt) && styles.customEventItem]}>
                      <Text style={styles.eventTime}>
                        {evt.allDay ? 'All Day' : format(new Date(evt.startDate), 'HH:mm')}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.eventTitle} numberOfLines={1}>{evt.title}</Text>
                        {isCustomEvent(evt) && <Text style={styles.customBadgeText}>📝 Custom</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {events.length === 0 && (
                <View style={styles.noEventsBox}>
                  <Text style={styles.noEventsText}>No events scheduled</Text>
                </View>
              )}

              {/* Drawing overlay for this day block */}
              {isDrawMode && (
                <View
                  style={styles.drawOverlay}
                  {...panResponder.panHandlers}
                  collapsable={false}
                >
                  <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                    {drawings.map((path) => (
                      <Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                    {currentDrawing.length > 0 && (
                      <Path d={pointsToPath(currentDrawing)} stroke={selectedColor} strokeWidth={selectedSize} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    )}
                  </Svg>
                </View>
              )}

              {/* Show existing drawings when NOT drawing */}
              {!isDrawMode && drawings.length > 0 && (
                <Svg width="100%" height="60" style={styles.miniPreview} pointerEvents="none">
                  {drawings.map((path) => (
                    <Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
                  ))}
                </Svg>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Drawing toolbar */}
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
              <TouchableOpacity style={styles.toolActionBtn} onPress={undoLastOnAll}>
                <Text style={styles.toolActionText}>↩️</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.toolActionBtn} onPress={clearAllDrawings}>
                <Text style={styles.toolActionText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Floating draw toggle */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 12, paddingBottom: 80 },

  weekNav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14,
  },
  navText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  weekTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  dayBlock: {
    backgroundColor: COLORS.cardBg, borderRadius: 12, marginBottom: 10,
    overflow: 'hidden', borderWidth: 1, borderColor: COLORS.cardBorder, position: 'relative',
  },
  todayBlock: { borderColor: COLORS.highlight, borderWidth: 2 },

  dayHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: COLORS.secondary,
  },
  dayHeaderLeft: { flex: 1 },
  dayHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  todayText: { color: COLORS.highlight },
  dayDate: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  linkArrow: { color: COLORS.accent, fontSize: 20, fontWeight: '700' },

  eventBadge: {
    backgroundColor: COLORS.highlight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
  },
  eventBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
  drawBadge: { fontSize: 14 },

  events: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  eventItem: {
    flexDirection: 'row', alignItems: 'center', padding: 8, marginBottom: 4,
    borderLeftWidth: 3, borderRadius: 4, backgroundColor: COLORS.background, gap: 10,
  },
  customEventItem: { backgroundColor: COLORS.todayBg },
  eventTime: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700', width: 60 },
  eventTitle: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  customBadgeText: { color: COLORS.highlight, fontSize: 9, fontWeight: '700', marginTop: 2 },

  noEventsBox: { paddingHorizontal: 12, paddingVertical: 8 },
  noEventsText: { color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic', textAlign: 'center' },

  drawOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent', zIndex: 10,
  },
  miniPreview: {
    height: 60, marginHorizontal: 12, marginBottom: 4,
  },

  drawModeIndicator: {
    backgroundColor: 'rgba(233, 69, 96, 0.9)', paddingVertical: 6, alignItems: 'center',
  },
  drawModeIndicatorText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

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

  drawToggle: {
    position: 'absolute', bottom: 20, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
  },
  drawToggleActive: { backgroundColor: COLORS.success },
  drawToggleText: { fontSize: 20, color: COLORS.white, fontWeight: '700' },
});
