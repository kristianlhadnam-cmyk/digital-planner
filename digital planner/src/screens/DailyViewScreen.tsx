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

// ─── Mini Canvas for tegning ───
function MiniCanvas({ onSave, onCancel }: { onSave: (paths: DrawingPath[], hasBg: boolean) => void; onCancel: () => void }) {
  const [paths, setPaths] = useState<DrawingPath[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [color, setColor] = useState(PEN_COLORS[6]); // Default: white
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
      {/* Header */}
      <View style={mcs.topBar}>
        <Text style={mcs.topTitle}>✏️ Tegn klistrelapp</Text>
        <View style={mcs.topActions}>
          <TouchableOpacity style={mcs.btnOutline} onPress={() => { pathsRef.current = []; setPaths([]); }}>
            <Text style={mcs.btnText}>Tøm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mcs.btnSecondary} onPress={onCancel}>
            <Text style={mcs.btnText}>Avbryt</Text>
          </TouchableOpacity>
          <TouchableOpacity style={mcs.btnPrimary} onPress={() => onSave(paths, hasBg)}>
            <Text style={mcs.btnPrimaryText}>✔ Lagre</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Vertical toolbar */}
      <View style={mcs.toolbar}>
        <View style={mcs.toolSection}>
          <Text style={mcs.toolLabel}>Farge</Text>
          <View style={mcs.colorRow}>
            {PEN_COLORS.map((c, i) => (
              <TouchableOpacity key={i} style={[mcs.colorBtn, { backgroundColor: c }, color === c && mcs.colorSelected]} onPress={() => setColor(c)} />
            ))}
          </View>
        </View>
        <View style={mcs.toolSection}>
          <Text style={mcs.toolLabel}>Størrelse</Text>
          <View style={mcs.sizeRow}>
            {PEN_SIZES.map((s, i) => (
              <TouchableOpacity key={i} style={[mcs.sizeBtn, size === s && mcs.sizeSelected]} onPress={() => setSize(s)}>
                <View style={[mcs.sizeDot, { width: s * 2.5, height: s * 2.5 }]} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={mcs.toolSection}>
          <TouchableOpacity style={[mcs.bgToggle, hasBg && mcs.bgToggleOn]} onPress={() => setHasBg(!hasBg)}>
            <Text style={[mcs.bgToggleText, hasBg && mcs.bgToggleTextOn]}>▣ Bakgrunn {hasBg ? 'PÅ' : 'AV'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Canvas */}
      <View style={mcs.canvasArea} {...pan.panHandlers} collapsable={false}>
        <Svg width="100%" height="100%" pointerEvents="none">
          {paths.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {currentPoints.length > 0 && <Path d={ptsToPath(currentPoints)} stroke={color} strokeWidth={size} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
      </View>
    </View>
  );
}

const mcs = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  topTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  topActions: { flexDirection: 'row', gap: 8 },
  btnOutline: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.cardBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder },
  btnSecondary: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.accent, borderRadius: 8 },
  btnPrimary: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.highlight, borderRadius: 8 },
  btnText: { color: COLORS.text, fontWeight: '600', fontSize: 13 },
  btnPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  toolbar: { backgroundColor: COLORS.secondary, padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  toolSection: { marginBottom: 8 },
  toolLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: 'transparent' },
  colorSelected: { borderColor: COLORS.white, transform: [{ scale: 1.15 }] },
  sizeRow: { flexDirection: 'row', gap: 8 },
  sizeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  sizeSelected: { borderColor: COLORS.highlight },
  sizeDot: { borderRadius: 20, backgroundColor: COLORS.text },
  bgToggle: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: COLORS.cardBorder, backgroundColor: COLORS.cardBg, alignSelf: 'flex-start' },
  bgToggleOn: { backgroundColor: COLORS.accent, borderColor: COLORS.highlight },
  bgToggleText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  bgToggleTextOn: { color: COLORS.white },
  canvasArea: { flex: 1, margin: 12, backgroundColor: COLORS.canvasBg, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.cardBorder },
});

// ─── Drawing Sticker ───
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
      <View style={[ss.sticker, sticker.hasBackground ? ss.stickerBg : ss.stickerNoBg]}>
        <TouchableOpacity style={ss.deleteBtn} onPress={onDelete}>
          <Text style={ss.deleteBtnText}>✕</Text>
        </TouchableOpacity>
        <Svg width="100%" height="100%" pointerEvents="none">
          {sticker.drawings.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
      </View>
    </View>
  );
}

const ss = StyleSheet.create({
  sticker: { flex: 1, borderRadius: 12, borderWidth: 2, overflow: 'hidden' },
  stickerBg: { backgroundColor: COLORS.canvasBg, borderColor: COLORS.highlight },
  stickerNoBg: { backgroundColor: 'transparent', borderColor: 'transparent' },
  deleteBtn: { position: 'absolute', top: 4, right: 4, zIndex: 10, width: 24, height: 24, backgroundColor: COLORS.error + 'cc', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: COLORS.white, fontSize: 10, fontWeight: '700' },
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
    try { setStickers(await getDayStickers(date) || []); } catch (e) { console.log('stickers error', e); setStickers([]); }
    try { setCalendarEvents(await getEventsForDate(date)); } catch (e) { console.log('events error', e); setCalendarEvents([]); }
    try { const c = await getCustomEvents(date); setCustomEvents(c || []); } catch (e) { console.log('custom events error', e); setCustomEvents([]); }
    setLoading(false);
  };

  const persistStickers = async (newStickers: DrawingSticker[]) => {
    setStickers(newStickers);
    try { await saveDayStickers(date, newStickers); } catch (e) { console.log('save stickers error', e); }
  };

  const handleSaveSticker = async (drawingPaths: DrawingPath[], hasBg: boolean = true) => {
    if (drawingPaths.length === 0) { setShowModal(false); return; }
    const newSticker: DrawingSticker = {
      id: generateId(),
      drawings: drawingPaths,
      positionX: 16,
      positionY: stickers.length * 160 + 10,
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
    const a = trimmed.match(/^(all\s*day|allday)\s*[-:]?\s*(.+)/i);
    if (a) return { time: null, title: a[2].trim(), allDay: true };
    const t = trimmed.match(/^(\d{1,2})[:.]?(\d{2})?\s*[-:]?\s*(.+)/);
    if (t) {
      const hour = t[1].padStart(2, '0'), minute = (t[2] || '00').padStart(2, '0'), title = t[3].trim();
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
    let start, end;
    if (parsed.allDay) {
      start = new Date(eventDate); start.setHours(0,0,0,0); end = new Date(eventDate); end.setHours(23,59,59,999);
    } else if (parsed.time) {
      const [h,m] = parsed.time.split(':').map(Number);
      start = new Date(eventDate); start.setHours(h,m,0,0); end = new Date(start); end.setHours(h+1,m,0,0);
    } else return;
    try {
      await saveCustomEvent(date, { id: `custom_${Date.now()}_${Math.random().toString(36).substr(2,9)}`, title: parsed.title, startDate: start.toISOString(), endDate: end.toISOString(), allDay: parsed.allDay, calendarSource: 'local', color: COLORS.highlight });
      setCustomEvents(await getCustomEvents(date)); setQuickAddText(''); setShowQuickAdd(false);
    } catch (e) { console.log('save event error', e); }
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
    <SafeAreaView style={s.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={dayData.year}
        onYearPress={() => navigation.navigate('YearlyView', { year: dayData.year })}
        monthName={dayData.monthName}
        onMonthPress={() => navigation.navigate('MonthlyView', { year: dayData.year, month: dayData.month })}
        weekNumber={dayData.weekNumber}
        onWeekPress={() => navigation.navigate('WeeklyView', { year: dayData.year, weekNumber: dayData.weekNumber, startDate: format(weekStart, 'yyyy-MM-dd') })}
        title={`${dayData.dayName.slice(0,3)} ${dayData.dayOfMonth}`}
      />

      <View style={s.dayNav}>
        <TouchableOpacity style={s.pad} onPress={() => navigation.replace('DailyView', { date: getPrevDate(date) })}>
          <Text style={s.navText}>← Forrige</Text>
        </TouchableOpacity>
        <View style={s.dayNavCenter}>
          <Text style={[s.dayNameBig, dayData.isToday && s.todayColor]}>{dayData.dayName}</Text>
          <Text style={s.dayDateBig}>{dayData.monthName} {dayData.dayOfMonth}, {dayData.year}</Text>
          {dayData.isToday && <View style={s.todayBadge}><Text style={s.todayBadgeText}>I DAG</Text></View>}
        </View>
        <TouchableOpacity style={s.pad} onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}>
          <Text style={s.navText}>Neste →</Text>
        </TouchableOpacity>
      </View>

      <View style={s.quickActions}>
        <NavigationButton title="✅ Gjøremål" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notater" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Kalender" variant="small" onPress={openExternalCalendar} />
      </View>

      {/* Action buttons: Add event + Draw sticker */}
      <View style={s.actionRow}>
        <TouchableOpacity style={s.addBtn} onPress={() => setShowQuickAdd(true)} activeOpacity={0.7}>
          <Text style={s.addBtnText}>➕ Legg til hendelse</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.drawBtn} onPress={() => setShowModal(true)} activeOpacity={0.7}>
          <Text style={s.drawBtnIcon}>✏️</Text>
          <Text style={s.drawBtnLabel}>Tegn</Text>
        </TouchableOpacity>
      </View>

      {/* Quick add form */}
      {showQuickAdd && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
          <View style={s.quickAddForm}>
            <View style={s.quickAddHeader}>
              <Text style={s.quickAddLabel}>➕ Ny hendelse</Text>
              <TouchableOpacity onPress={() => { setQuickAddText(''); setShowQuickAdd(false); }}>
                <Text style={s.quickAddClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={s.quickAddHint}>F.eks. "9:00 Møte" eller "Hel dag - Ferie"</Text>
            <TextInput style={s.quickAddInput} value={quickAddText} onChangeText={setQuickAddText} placeholder="Skriv tid + hendelse..." placeholderTextColor={COLORS.textSecondary} autoFocus returnKeyType="done" onSubmitEditing={handleQuickAdd} />
            <TouchableOpacity style={s.quickAddSubmit} onPress={handleQuickAdd} activeOpacity={0.7}><Text style={s.quickAddSubmitText}>✓ Legg til</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Schedule */}
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} nestedScrollEnabled>
        {allDayEvents.map((e) => (
          <View key={e.id} style={[s.allDayEvent, { borderLeftColor: e.color ?? COLORS.accent }]}>
            <Text style={s.allDayBadge}>HEL DAG</Text>
            <Text style={s.allDayTitle}>{e.title}</Text>
            {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text style={s.del}>🗑️</Text></TouchableOpacity>}
          </View>
        ))}
        {hours.map((hour) => {
          const evts = eventsAtHour(hour);
          return (
            <View key={hour} style={s.hourRow}>
              <View style={s.hourLabel}><Text style={s.hourLabelText}>{hour}</Text></View>
              <View style={s.hourContent}>
                {evts.map((e) => (
                  <View key={e.id} style={[s.eventCard, { borderLeftColor: e.color ?? COLORS.accent }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.eventTime}>{format(new Date(e.startDate), 'HH:mm')} - {format(new Date(e.endDate), 'HH:mm')}</Text>
                      <Text style={s.eventTitle}>{e.title}</Text>
                      {isCustomEvent(e) ? <Text style={s.customBadge}>📝 Lokal</Text> : <Text style={s.eventSource}>{e.calendarSource}</Text>}
                    </View>
                    {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text style={s.del}>🗑️</Text></TouchableOpacity>}
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        {allEvents.length === 0 && !loading && (
          <View style={s.emptyState}>
            <Text style={s.emptyIcon}>📅</Text>
            <Text style={s.emptyTitle}>Ingen hendelser i dag</Text>
            <Text style={s.emptyHint}>Trykk "Legg til hendelse" for å legge til noe</Text>
          </View>
        )}

        {/* Existing stickers shown inside scroll */}
        {stickers.length > 0 && (
          <View style={s.stickerSection}>
            <Text style={s.stickerSectionTitle}>✏️ Klistrelapper ({stickers.length})</Text>
            {stickers.map((sticker) => (
              <View key={sticker.id} style={s.stickerWrapper}>
                <DrawingStickerView sticker={sticker} onUpdate={handleUpdateSticker} onDelete={() => handleDeleteSticker(sticker.id)} />
                <TouchableOpacity style={s.deleteStickerBtn} onPress={() => handleDeleteSticker(sticker.id)}>
                  <Text style={s.deleteStickerBtnText}>🗑️ Slett</Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={s.stickerHint}>Dra klistrelappene for å flytte dem</Text>
          </View>
        )}
      </ScrollView>

      {/* Modal for tegning */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <MiniCanvas onSave={handleSaveSticker} onCancel={() => setShowModal(false)} />
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  pad: { padding: 8 },
  navText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  dayNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.cardBg },
  dayNavCenter: { alignItems: 'center' },
  dayNameBig: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  todayColor: { color: COLORS.highlight },
  dayDateBig: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  todayBadge: { backgroundColor: COLORS.todayBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  todayBadgeText: { color: COLORS.highlight, fontSize: 10, fontWeight: '800' },
  quickActions: { flexDirection: 'row', justifyContent: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder },
  actionRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, gap: 8 },
  addBtn: { flex: 1, backgroundColor: COLORS.highlight, padding: 12, borderRadius: 12, alignItems: 'center' },
  addBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  drawBtn: { backgroundColor: COLORS.accent, padding: 10, borderRadius: 12, alignItems: 'center', justifyContent: 'center', width: 64 },
  drawBtnIcon: { fontSize: 20 },
  drawBtnLabel: { color: COLORS.white, fontSize: 10, fontWeight: '700', marginTop: 2 },
  quickAddForm: { marginHorizontal: 12, marginBottom: 8, backgroundColor: COLORS.cardBg, padding: 14, borderRadius: 12, borderWidth: 2, borderColor: COLORS.highlight },
  quickAddHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quickAddLabel: { color: COLORS.highlight, fontSize: 15, fontWeight: '700' },
  quickAddClose: { color: COLORS.textSecondary, fontSize: 18, fontWeight: '700', padding: 4 },
  quickAddHint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 8 },
  quickAddInput: { backgroundColor: COLORS.background, borderRadius: 8, padding: 12, color: COLORS.text, fontSize: 15, marginBottom: 10, borderWidth: 1, borderColor: COLORS.cardBorder },
  quickAddSubmit: { backgroundColor: COLORS.success, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  quickAddSubmitText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 100 },
  allDayEvent: { backgroundColor: COLORS.cardBg, padding: 10, borderRadius: 8, marginBottom: 8, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  allDayBadge: { color: COLORS.highlight, fontSize: 10, fontWeight: '800', backgroundColor: COLORS.todayBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  allDayTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', flex: 1 },
  hourRow: { flexDirection: 'row', minHeight: 44, borderBottomWidth: 0.5, borderBottomColor: COLORS.cardBorder },
  hourLabel: { width: 56, paddingTop: 8, paddingRight: 8, alignItems: 'flex-end' },
  hourLabelText: { color: COLORS.textSecondary, fontSize: 12 },
  hourContent: { flex: 1, paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: COLORS.cardBorder, paddingLeft: 8 },
  eventCard: { backgroundColor: COLORS.cardBg, padding: 10, borderRadius: 6, marginBottom: 4, borderLeftWidth: 3, flexDirection: 'row', alignItems: 'center' },
  eventTime: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '600' },
  eventTitle: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  eventSource: { color: COLORS.textSecondary, fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  customBadge: { color: COLORS.highlight, fontSize: 10, fontWeight: '700', marginTop: 2 },
  del: { fontSize: 16, padding: 4 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  emptyHint: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  stickerSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: COLORS.cardBorder, paddingTop: 16 },
  stickerSectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 12 },
  stickerWrapper: { height: 170, marginBottom: 8, position: 'relative' },
  deleteStickerBtn: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingVertical: 4 },
  deleteStickerBtnText: { color: COLORS.error, fontSize: 11, fontWeight: '600' },
  stickerHint: { color: COLORS.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic' },
});
