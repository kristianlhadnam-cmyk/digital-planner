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
  Modal,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, startOfWeek } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { RootStackParamList, DrawingPath, DrawingSticker, Point, CalendarEvent } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import { getDayData, getHoursOfDay, getPrevDate, getNextDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
import NavigationButton from '../components/NavigationButton';
import { 
  getDayStickers,
  saveDayStickers,
  getCustomEvents,
  saveCustomEvent,
  deleteCustomEvent,
} from '../services/StorageService';
import { getEventsForDate, openExternalCalendar } from '../services/CalendarService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DailyView'>;
  route: RouteProp<RootStackParamList, 'DailyView'>;
};

const generateId = (): string => `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Mini Canvas Component ───
function MiniCanvas({ onSave, onCancel }: { onSave: (paths: DrawingPath[], hasBg: boolean) => void; onCancel: () => void }) {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [color, setColor] = useState(PEN_COLORS[0]);
  const [size, setSize] = useState(PEN_SIZES[1]);
  const [hasBg, setHasBg] = useState(true);
  const pathsRef = useRef<DrawingPath[]>([]);
  const currentRef = useRef<Point[]>([]);
  const colorRef = useRef(color);
  const sizeRef = useRef(size);

  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { sizeRef.current = size; }, [size]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: (evt) => {
      currentRef.current = [{ x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }];
      setCurrentPoints([...currentRef.current]);
    },
    onPanResponderMove: (evt) => {
      const last = currentRef.current[currentRef.current.length - 1];
      if (last) {
        const dx = evt.nativeEvent.locationX - last.x, dy = evt.nativeEvent.locationY - last.y;
        if (dx * dx + dy * dy < 2) return;
      }
      currentRef.current = [...currentRef.current, { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }];
      setCurrentPoints([...currentRef.current]);
    },
    onPanResponderRelease: () => {
      if (currentRef.current.length > 0) {
        const newPath: DrawingPath = { id: `p_${Date.now()}`, points: [...currentRef.current], color: colorRef.current, strokeWidth: sizeRef.current };
        pathsRef.current = [...pathsRef.current, newPath];
        setPaths([...pathsRef.current]);
      }
      currentRef.current = []; setCurrentPoints([]);
    },
  })).current;

  const ptsToPath = (pts: Point[]): string => {
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  return (
    <View style={mcs.container}>
      <View style={mcs.topBar}>
        <Text style={mcs.topTitle}>✏️ Tegn</Text>
        <View style={mcs.topActions}>
          <TouchableOpacity style={mcs.btnOutline} onPress={() => { pathsRef.current = []; setPaths([]); }}>
            <Text style={mcs.btnOutlineText}>Tøm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mcs.btnSecondary} onPress={onCancel}>
            <Text style={mcs.btnText}>Avbryt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mcs.btnPrimary} onPress={() => onSave(paths, hasBg)}>
            <Text style={mcs.btnPrimaryText}>✔ Lagre</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={mcs.toolbar}>
        <View style={mcs.toolLeft}>
          <Text style={mcs.toolLabel}>Farge:</Text>
          {PEN_COLORS.map((c) => (
            <TouchableOpacity key={c} style={[mcs.colorBtn, { backgroundColor: c }, color === c && mcs.colorSelected]} onPress={() => setColor(c)} />
          ))}
          <View style={mcs.separator} />
          <Text style={mcs.toolLabel}>Str:</Text>
          {PEN_SIZES.map((s) => (
            <TouchableOpacity key={s} style={[mcs.sizeBtn, size === s && mcs.sizeSelected]} onPress={() => setSize(s)}>
              <View style={[mcs.sizeDot, { width: s * 2, height: s * 2 }]} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={[mcs.bgToggle, hasBg && mcs.bgToggleActive]} onPress={() => setHasBg(!hasBg)}>
          <Text style={[mcs.bgToggleText, hasBg && mcs.bgToggleTextActive]}>▣ Bakgrunn</Text>
        </TouchableOpacity>
      </View>

      <View style={mcs.canvas} {...pan.panHandlers} collapsable={false}>
        <Svg width="100%" height="100%" pointerEvents="none">
          {paths.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {currentPoints.length > 0 && <Path d={ptsToPath(currentPoints)} stroke={color} strokeWidth={size} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
      </View>
    </View>
  );
}

const mcs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1120' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  topTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
  topActions: { flexDirection: 'row', gap: 12 },
  btnOutline: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#1e293b', borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  btnOutlineText: { color: '#94a3b8' },
  btnSecondary: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#2563eb', borderRadius: 8 },
  btnText: { color: '#f1f5f9', fontWeight: '600' },
  btnPrimary: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3b82f6', borderRadius: 8 },
  btnPrimaryText: { color: '#ffffff', fontWeight: '700' },
  toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#0f172a', borderBottomWidth: 1, borderBottomColor: '#334155' },
  toolLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  toolLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', marginRight: 4 },
  colorBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: '#ffffff' },
  separator: { width: 1, height: 24, backgroundColor: '#334155', marginHorizontal: 4 },
  sizeBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sizeSelected: { borderColor: '#3b82f6' },
  sizeDot: { borderRadius: 20, backgroundColor: '#f1f5f9' },
  bgToggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#334155', backgroundColor: '#1e293b' },
  bgToggleActive: { backgroundColor: '#2563eb', borderColor: '#3b82f6' },
  bgToggleText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },
  bgToggleTextActive: { color: '#ffffff' },
  canvas: { flex: 1, margin: 12, backgroundColor: '#f8fafc', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
});

// ─── Sticker Component ───
function DrawingStickerView({ sticker, onUpdate, onDelete }: { sticker: DrawingSticker; onUpdate: (s: DrawingSticker) => void; onDelete: () => void }) {
  const [pos, setPos] = useState({ x: sticker.positionX, y: sticker.positionY });
  const dragStart = useRef({ x: 0, y: 0 });

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      dragStart.current = { x: pos.x - evt.nativeEvent.pageX, y: pos.y - evt.nativeEvent.pageY };
    },
    onPanResponderMove: (evt) => {
      const newX = Math.max(0, Math.min(SCREEN_WIDTH - 150, dragStart.current.x + evt.nativeEvent.pageX));
      const newY = Math.max(0, dragStart.current.y + evt.nativeEvent.pageY);
      setPos({ x: newX, y: newY });
    },
    onPanResponderRelease: () => {
      onUpdate({ ...sticker, positionX: pos.x, positionY: pos.y });
    },
  })).current;

  const ptsToPath = (pts: Point[]): string => pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <View style={{ position: 'absolute', left: pos.x, top: pos.y, width: 150, height: 150, zIndex: 50 }} {...pan.panHandlers}>
      <View style={[sticker.hasBackground ? svs.hasBg : svs.noBg]}>
        <TouchableOpacity style={svs.deleteBtn} onPress={onDelete}>
          <Text style={svs.deleteBtnText}>✕</Text>
        </TouchableOpacity>
        <Svg width="100%" height="100%" pointerEvents="none">
          {sticker.drawings.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
      </View>
    </View>
  );
}

const svs = StyleSheet.create({
  hasBg: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 12, borderWidth: 2, borderColor: '#3b82f6', overflow: 'hidden' },
  noBg: { flex: 1, backgroundColor: 'transparent', borderRadius: 12, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, zIndex: 10, width: 24, height: 24, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
});

// ─── Main Screen ───
export default function DailyViewScreen({ navigation, route }: Props) {
  const { date } = route.params;
  const dayData = getDayData(date);
  const hours = getHoursOfDay();

  const [stickers, setStickers] = useState<DrawingSticker[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [customEvents, setCustomEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddText, setQuickAddText] = useState('');

  useEffect(() => { loadData(); }, [date]);

  const loadData = async () => {
    setLoading(true);
    try { setStickers(await getDayStickers(date) || []); } catch { setStickers([]); }
    try { setCalendarEvents(await getEventsForDate(date)); } catch { setCalendarEvents([]); }
    try { setCustomEvents(await getCustomEvents(date) || []); } catch { setCustomEvents([]); }
    setLoading(false);
  };

  const persistStickers = async (newStickers: DrawingSticker[]) => {
    setStickers(newStickers);
    try { await saveDayStickers(date, newStickers); } catch {}
  };

  const handleSaveSticker = async (drawingPaths: DrawingPath[], hasBg: boolean = true) => {
    if (drawingPaths.length === 0) { setShowModal(false); return; }
    const newSticker: DrawingSticker = {
      id: generateId(),
      drawings: drawingPaths,
      positionX: 16,
      positionY: 0,
      width: 150,
      height: 150,
      hasBackground: hasBg,
      createdAt: new Date().toISOString(),
    };
    await persistStickers([...stickers, newSticker]);
    setShowModal(false);
  };

  const handleUpdateSticker = async (updated: DrawingSticker) => {
    await persistStickers(stickers.map((s) => s.id === updated.id ? updated : s));
  };

  const handleDeleteSticker = (id: string) => {
    Alert.alert('Slett', 'Slett denne tegningen?', [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Slett', style: 'destructive', onPress: () => persistStickers(stickers.filter((s) => s.id !== id)) },
    ]);
  };

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
    if (!text) { Alert.alert('Tomt felt', 'Skriv en beskrivelse.'); return; }
    const parsed = parseEventText(text);
    if (!parsed.title) { Alert.alert('Mangler tittel', 'Legg til en tittel etter tidspunktet.'); return; }
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

  const deleteCustomEvt = (eventId: string, title: string) => {
    Alert.alert('Slett', `Slett "${title}"?`, [
      { text: 'Avbryt', style: 'cancel' },
      { text: 'Slett', style: 'destructive', onPress: async () => { await deleteCustomEvent(date, eventId); setCustomEvents(await getCustomEvents(date) || []); }},
    ]);
  };

  const allEvents = [...calendarEvents, ...customEvents];
  const eventsAtHour = (hour: string): CalendarEvent[] => allEvents.filter((e) => !e.allDay && new Date(e.startDate).getHours() === parseInt(hour.split(':')[0], 10));
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

      <View style={styles.dayNav}>
        <TouchableOpacity style={styles.dayNavBtn} onPress={() => navigation.replace('DailyView', { date: getPrevDate(date) })}>
          <Text style={styles.navText}>← Forrige</Text>
        </TouchableOpacity>
        <View style={styles.dayNavCenter}>
          <Text style={[styles.dayNameBig, dayData.isToday && styles.todayColor]}>{dayData.dayName}</Text>
          <Text style={styles.dayDateBig}>{dayData.monthName} {dayData.dayOfMonth}, {dayData.year}</Text>
          {dayData.isToday && <View style={styles.todayBadge}><Text style={styles.todayBadgeText}>I DAG</Text></View>}
        </View>
        <TouchableOpacity style={styles.dayNavBtn} onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}>
          <Text style={styles.navText}>Neste →</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.quickActions}>
        <NavigationButton title="✅ Gjøremål" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notater" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Kalender" variant="small" onPress={openExternalCalendar} />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowQuickAdd(true)} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>➕ Legg til hendelse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.drawBtn} onPress={() => setShowModal(true)} activeOpacity={0.7}>
          <Text style={styles.drawBtnText}>✏️</Text>
        </TouchableOpacity>
      </View>

      {showQuickAdd && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
          <View style={styles.quickAddForm}>
            <View style={styles.quickAddHeader}>
              <Text style={styles.quickAddLabel}>➕ Ny hendelse</Text>
              <TouchableOpacity onPress={() => { setQuickAddText(''); setShowQuickAdd(false); }}>
                <Text style={styles.quickAddClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.quickAddHint}>F.eks. "9:00 Møte" eller "Hel dag - Ferie"</Text>
            <TextInput style={styles.quickAddInput} value={quickAddText} onChangeText={setQuickAddText} placeholder="Skriv tid + hendelse..." placeholderTextColor={COLORS.textSecondary} autoFocus returnKeyType="done" onSubmitEditing={handleQuickAdd} />
            <TouchableOpacity style={styles.quickAddSubmit} onPress={handleQuickAdd} activeOpacity={0.7}>
              <Text style={styles.quickAddSubmitText}>✓ Legg til</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} nestedScrollEnabled>
        {allDayEvents.map((e) => (
          <View key={e.id} style={[styles.allDayEvent, { borderLeftColor: e.color ?? COLORS.accent }]}>
            <Text style={styles.allDayBadge}>HEL DAG</Text>
            <Text style={styles.allDayTitle}>{e.title}</Text>
            {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text style={styles.deleteIcon}>🗑️</Text></TouchableOpacity>}
          </View>
        ))}

        {hours.map((hour) => {
          const evts = eventsAtHour(hour);
          return (
            <View key={hour} style={styles.hourRow}>
              <View style={styles.hourLabel}><Text style={styles.hourLabelText}>{hour}</Text></View>
              <View style={styles.hourContent}>
                {evts.map((e) => (
                  <View key={e.id} style={[styles.eventCard, { borderLeftColor: e.color ?? COLORS.accent }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.eventTime}>{format(new Date(e.startDate), 'HH:mm')} - {format(new Date(e.endDate), 'HH:mm')}</Text>
                      <Text style={styles.eventTitle}>{e.title}</Text>
                      {isCustomEvent(e) ? <Text style={styles.eventBadgeCustom}>📝 Lokal</Text> : <Text style={styles.eventSource}>{e.calendarSource}</Text>}
                    </View>
                    {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text style={styles.deleteIcon}>🗑️</Text></TouchableOpacity>}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {allEvents.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>Ingen hendelser i dag</Text>
            <Text style={styles.emptyHint}>Trykk "Legg til hendelse" for å legge til noe</Text>
          </View>
        )}

        {stickers.map((sticker) => (
          <View key={sticker.id} style={{ height: 160, marginBottom: 8, position: 'relative', zIndex: 50 }}>
            <DrawingStickerView sticker={sticker} onUpdate={handleUpdateSticker} onDelete={() => handleDeleteSticker(sticker.id)} />
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <MiniCanvas onSave={handleSaveSticker} onCancel={() => setShowModal(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0b1120' },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#1e293b' },
  dayNavBtn: { padding: 8 },
  navText: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  dayNavCenter: { alignItems: 'center' },
  dayNameBig: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },
  todayColor: { color: '#3b82f6' },
  dayDateBig: { fontSize: 13, color: '#94a3b8', marginTop: 2 },
  todayBadge: { backgroundColor: '#1e3a5f', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  todayBadgeText: { color: '#3b82f6', fontSize: 10, fontWeight: '800' },
  quickActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  actionRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  addBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  drawBtn: { backgroundColor: '#2563eb', padding: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: 48 },
  drawBtnText: { color: '#ffffff', fontSize: 20 },
  quickAddForm: { marginHorizontal: 12, marginBottom: 8, backgroundColor: '#1e293b', padding: 14, borderRadius: 12, borderWidth: 2, borderColor: '#3b82f6' },
  quickAddHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quickAddLabel: { color: '#3b82f6', fontSize: 15, fontWeight: '700' },
  quickAddClose: { color: '#94a3b8', fontSize: 18, fontWeight: '700', padding: 4 },
  quickAddHint: { color: '#94a3b8', fontSize: 12, marginBottom: 8 },
  quickAddInput: { backgroundColor: '#0b1120', borderRadius: 8, padding: 12, color: '#f1f5f9', fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  quickAddSubmit: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  quickAddSubmitText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 100 },
  allDayEvent: { backgroundColor: '#1e293b', padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  allDayBadge: { color: '#3b82f6', fontSize: 10, fontWeight: '800', backgroundColor: '#1e3a5f', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  allDayTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', flex: 1 },
  hourRow: { flexDirection: 'row', minHeight: 44, borderBottomWidth: 0.5, borderBottomColor: '#334155' },
  hourLabel: { width: 56, paddingTop: 8, paddingRight: 8, alignItems: 'flex-end' },
  hourLabelText: { color: '#94a3b8', fontSize: 12 },
  hourContent: { flex: 1, paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: '#334155', paddingLeft: 8 },
  eventCard: { backgroundColor: '#1e293b', padding: 10, borderRadius: 6, marginBottom: 4, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center' },
  eventTime: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  eventTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', marginTop: 2 },
  eventSource: { color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  eventBadgeCustom: { color: '#3b82f6', fontSize: 10, fontWeight: '700', marginTop: 2 },
  deleteIcon: { fontSize: 16, padding: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '600' },
  emptyHint: { color: '#94a3b8', fontSize: 13, marginTop: 8 },
});
