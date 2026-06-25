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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, startOfWeek } from 'date-fns';
import Svg, { Path } from 'react-native-svg';
import { RootStackParamList, DrawingPath, DrawingSticker, Point, CalendarEvent } from '../types';
import { COLORS, PEN_COLORS, PEN_COLORS_LIGHT, PEN_SIZES } from '../utils/constants';
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

// ─── Mini Canvas Component (for drawing inside modal) ───
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
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.5} ${pts[0].y + 0.5}`;
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  return (
    <View className="flex-1 bg-background/95">
      {/* Top bar */}
      <View className="flex-row justify-between items-center px-4 py-3 bg-primary border-b border-card-border">
        <Text className="text-text-primary text-lg font-bold">✏️ Tegn</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity className="bg-card px-4 py-2 rounded-lg border border-card-border" onPress={() => { pathsRef.current = []; setPaths([]); }}>
            <Text className="text-text-secondary">Tøm</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-accent px-4 py-2 rounded-lg" onPress={onCancel}>
            <Text className="text-text-primary font-semibold">Avbryt</Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-highlight px-4 py-2 rounded-lg" onPress={() => onSave(paths, hasBg)}>
            <Text className="text-white font-bold">✔ Lagre</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Background toggle + toolbar */}
      <View className="flex-row items-center justify-between px-3 py-2 bg-secondary border-b border-card-border">
        <View className="flex-row items-center gap-2">
          <Text className="text-text-secondary text-xs font-bold">Farge:</Text>
          {PEN_COLORS.map((c) => (
            <TouchableOpacity key={c} className="w-6 h-6 rounded-full border-2" style={{ backgroundColor: c, borderColor: color === c ? '#fff' : 'transparent' }} onPress={() => setColor(c)} />
          ))}
          <View className="w-px h-6 bg-card-border mx-1" />
          <Text className="text-text-secondary text-xs font-bold">Str:</Text>
          {PEN_SIZES.map((s) => (
            <TouchableOpacity key={s} className={`w-[30px] h-[30px] rounded-full bg-card items-center justify-center border-2 ${size === s ? 'border-highlight' : 'border-transparent'}`} onPress={() => setSize(s)}>
              <View className="rounded-full bg-text-primary" style={{ width: s * 2, height: s * 2 }} />
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity className={`px-3 py-1.5 rounded-lg border ${hasBg ? 'bg-accent border-highlight' : 'bg-card border-card-border'}`} onPress={() => setHasBg(!hasBg)}>
          <Text className={`text-xs font-bold ${hasBg ? 'text-white' : 'text-text-secondary'}`}>▣ Bakgrunn</Text>
        </TouchableOpacity>
      </View>



      {/* Canvas */}
      <View className="flex-1 m-3 bg-canvas-bg rounded-xl overflow-hidden border border-card-border" {...pan.panHandlers} collapsable={false}>
        <Svg width="100%" height="100%" pointerEvents="none">
          {paths.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          {currentPoints.length > 0 && <Path d={ptsToPath(currentPoints)} stroke={color} strokeWidth={size} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        </Svg>
      </View>
    </View>
  );
}

// ─── Sticker Component (draggable on schedule) ───
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

  const ptsToPath = (pts: Point[]): string => {
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  return (
    <View
      style={{ position: 'absolute', left: pos.x, top: pos.y, width: 150, height: 150, zIndex: 50 }}
      {...pan.panHandlers}
    >
      <View className={`flex-1 rounded-xl border-2 overflow-hidden shadow-lg ${sticker.hasBackground ? 'bg-canvas-bg border-highlight' : 'border-transparent bg-transparent'}`}>
        <TouchableOpacity className="absolute top-1 right-1 z-10 w-6 h-6 bg-error/80 rounded-full items-center justify-center" onPress={onDelete}>
          <Text className="text-white text-xs font-bold">✕</Text>
        </TouchableOpacity>
        <Svg width="100%" height="100%" pointerEvents="none">
          {sticker.drawings.map((p) => <Path key={p.id} d={ptsToPath(p.points)} stroke={p.color} strokeWidth={p.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
        </Svg>
      </View>
    </View>
  );
}

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

  // Quick add event
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
    if (!text) { Alert.alert('Tomt felt', 'Skriv en beskrivelse av hendelsen.'); return; }
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
          <Text className="text-accent text-sm font-semibold">← Forrige</Text>
        </TouchableOpacity>
        <View className="items-center">
          <Text className={`text-xl font-extrabold ${dayData.isToday ? 'text-highlight' : 'text-text-primary'}`}>{dayData.dayName}</Text>
          <Text className="text-text-secondary text-sm mt-0.5">{dayData.monthName} {dayData.dayOfMonth}, {dayData.year}</Text>
          {dayData.isToday && <View className="bg-accent rounded px-2 py-0.5 mt-1"><Text className="text-highlight text-xs font-extrabold">I DAG</Text></View>}
        </View>
        <TouchableOpacity className="p-2" onPress={() => navigation.replace('DailyView', { date: getNextDate(date) })}>
          <Text className="text-accent text-sm font-semibold">Neste →</Text>
        </TouchableOpacity>
      </View>

      {/* Quick actions */}
      <View className="flex-row justify-center gap-2.5 py-2 px-3 bg-primary border-b border-card-border">
        <NavigationButton title="✅ Gjøremål" variant="small" onPress={() => navigation.navigate('TodoList')} />
        <NavigationButton title="📝 Notater" variant="small" onPress={() => navigation.navigate('NotesJournal')} />
        <NavigationButton title="📅 Kalender" variant="small" onPress={openExternalCalendar} />
      </View>

      {/* Quick add row + drawing button */}
      <View className="flex-row px-3 pt-2 pb-1 gap-2">
        <TouchableOpacity className="flex-1 bg-highlight p-3 rounded-xl items-center" onPress={() => setShowQuickAdd(true)} activeOpacity={0.7}>
          <Text className="text-white text-sm font-bold">➕ Legg til hendelse</Text>
        </TouchableOpacity>
        <TouchableOpacity className="bg-accent p-3 rounded-xl items-center justify-center" onPress={() => setShowModal(true)} activeOpacity={0.7}>
          <Text className="text-white text-lg">✏️</Text>
        </TouchableOpacity>
      </View>

      {/* Quick add form */}
      {showQuickAdd && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={120}>
          <View className="mx-3 mb-2 bg-card p-3.5 rounded-xl border-2 border-highlight">
            <View className="flex-row justify-between items-center mb-1.5">
              <Text className="text-highlight text-base font-bold">➕ Ny hendelse</Text>
              <TouchableOpacity onPress={() => { setQuickAddText(''); setShowQuickAdd(false); }}>
                <Text className="text-text-secondary text-lg font-bold p-1">✕</Text>
              </TouchableOpacity>
            </View>
            <Text className="text-text-secondary text-xs mb-2">F.eks. "9:00 Møte" eller "Hel dag - Ferie"</Text>
            <TextInput
              className="bg-background rounded-lg p-3 text-text-primary text-base mb-2.5 border border-card-border"
              value={quickAddText} onChangeText={setQuickAddText}
              placeholder="Skriv tid + hendelse..." placeholderTextColor={COLORS.textSecondary}
              autoFocus returnKeyType="done" onSubmitEditing={handleQuickAdd}
            />
            <TouchableOpacity className="bg-success rounded-lg py-3 items-center" onPress={handleQuickAdd} activeOpacity={0.7}>
              <Text className="text-white font-bold text-sm">✓ Legg til</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* Main scrollable schedule */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 12, paddingBottom: 100 }}
        nestedScrollEnabled
      >
        {/* All day events */}
        {allDayEvents.map((e) => (
          <View key={e.id} className="bg-card p-2.5 rounded-lg mb-2 flex-row items-center gap-2 border-l-4" style={{ borderLeftColor: e.color ?? COLORS.accent }}>
            <Text className="text-highlight text-xs font-extrabold bg-accent px-1.5 py-0.5 rounded">HEL DAG</Text>
            <Text className="text-text-primary text-sm font-semibold flex-1">{e.title}</Text>
            {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text className="text-base p-1">🗑️</Text></TouchableOpacity>}
          </View>
        ))}

        {/* Hourly schedule */}
        {hours.map((hour) => {
          const evts = eventsAtHour(hour);
          return (
            <View key={hour} className="flex-row min-h-[44px] border-b border-card-border">
              <View className="w-14 pt-2 pr-2 items-end"><Text className="text-text-secondary text-xs">{hour}</Text></View>
              <View className="flex-1 py-1 pl-2 border-l border-card-border">
                {evts.map((e) => (
                  <View key={e.id} className="bg-card p-2.5 rounded-md mb-1 flex-row items-center border-l-[3px]" style={{ borderLeftColor: e.color ?? COLORS.accent }}>
                    <View className="flex-1">
                      <Text className="text-text-secondary text-xs font-semibold">{format(new Date(e.startDate), 'HH:mm')} - {format(new Date(e.endDate), 'HH:mm')}</Text>
                      <Text className="text-text-primary text-sm font-semibold mt-0.5">{e.title}</Text>
                      {isCustomEvent(e) ? <Text className="text-highlight text-xs font-bold mt-0.5">📝 Lokal</Text> : <Text className="text-text-secondary text-[10px] uppercase mt-0.5">{e.calendarSource}</Text>}
                    </View>
                    {isCustomEvent(e) && <TouchableOpacity onPress={() => deleteCustomEvt(e.id, e.title)}><Text className="text-base p-1">🗑️</Text></TouchableOpacity>}
                  </View>
                ))}
              </View>
            </View>
          );
        })}

        {allEvents.length === 0 && !loading && (
          <View className="items-center py-16">
            <Text className="text-5xl mb-3.5">📅</Text>
            <Text className="text-text-primary text-base font-semibold">Ingen hendelser i dag</Text>
            <Text className="text-text-secondary text-sm mt-2">Trykk "Legg til hendelse" for å legge til noe</Text>
          </View>
        )}

        {/* Drawing stickers pinned inside the scroll */}
        {stickers.map((sticker) => (
          <View key={sticker.id} className="mb-3" style={{ zIndex: 50 }}>
            <DrawingStickerView sticker={sticker} onUpdate={handleUpdateSticker} onDelete={() => handleDeleteSticker(sticker.id)} />
          </View>
        ))}

        {/* Sticker counter */}
        {stickers.length > 0 && (
          <View className="items-center mt-4 mb-2">
            <Text className="text-text-secondary text-xs">{stickers.length} tegning{stickers.length > 1 ? 'er' : ''} — dra for å flytte</Text>
          </View>
        )}
      </ScrollView>

      {/* Drawing Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <MiniCanvas onSave={handleSaveSticker} onCancel={() => setShowModal(false)} />
      </Modal>
    </SafeAreaView>
  );
}
