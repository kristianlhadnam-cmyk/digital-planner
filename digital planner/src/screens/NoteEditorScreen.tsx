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
  ActivityIndicator,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Svg, { Path } from 'react-native-svg';
import { format } from 'date-fns';
import { RootStackParamList, NoteEntry, DrawingPath, Point } from '../types';
import { COLORS, PEN_COLORS, PEN_SIZES } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import { getNote, updateNote } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NoteEditor'>;
  route: RouteProp<RootStackParamList, 'NoteEditor'>;
};

type Section = 'text' | 'pdf';

const generateId = (): string => {
  return `path_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

export default function NoteEditorScreen({ navigation, route }: Props) {
  const { noteId, type } = route.params;
  const [note, setNote] = useState<NoteEntry | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [section, setSection] = useState<Section>('text');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Draw state
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [selectedColor, setSelectedColor] = useState(PEN_COLORS[0]);
  const [selectedSize, setSelectedSize] = useState(PEN_SIZES[1]);
  const [isEraser, setIsEraser] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);

  const isInitialLoad = useRef(true);
  const isJournal = type === 'journal';

  const drawingsRef = useRef<DrawingPath[]>([]);
  const currentPointsRef = useRef<Point[]>([]);
  const colorRef = useRef(selectedColor);
  const sizeRef = useRef(selectedSize);
  const eraserRef = useRef(isEraser);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { sizeRef.current = selectedSize; }, [selectedSize]);
  useEffect(() => { eraserRef.current = isEraser; }, [isEraser]);

  useEffect(() => {
    if (noteId) loadNote();
    else setLoading(false);
  }, [noteId]);

  const loadNote = async () => {
    if (!noteId) return;
    setLoading(true);
    isInitialLoad.current = true;
    try {
      const data = await getNote(noteId);
      if (data) {
        setNote(data);
        setTitle(data.title || '');
        setText(data.textContent || '');
        drawingsRef.current = data.drawings || [];
        setDrawings(data.drawings || []);
      }
    } catch (e) { console.log('Load note error:', e); }
    setLoading(false);
    setTimeout(() => { isInitialLoad.current = false; }, 500);
  };

  const save = useCallback(async () => {
    if (!noteId) return;
    setSaving(true);
    try { await updateNote(noteId, { title, textContent: text, drawings }); } catch {}
    setSaving(false);
  }, [noteId, title, text, drawings]);

  useEffect(() => {
    if (isInitialLoad.current || !noteId) return;
    const timer = setTimeout(() => { save(); }, 1000);
    return () => clearTimeout(timer);
  }, [title, text]);

  const persistDrawings = useCallback(async (newDrawings: DrawingPath[]) => {
    if (isInitialLoad.current) return;
    drawingsRef.current = newDrawings;
    setDrawings(newDrawings);
    if (noteId) {
      try { await updateNote(noteId, { drawings: newDrawings }); } catch {}
    }
  }, [noteId]);

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
          if (filtered.length !== drawingsRef.current.length) persistDrawings(filtered);
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
        if (last) { const dx = x - last.x, dy = y - last.y; if (dx * dx + dy * dy < 2) return; }
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
    if (points.length === 1) return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.5} ${points[0].y + 0.5}`;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  };

  const clearDrawings = () => persistDrawings([]);
  const undoLast = () => persistDrawings(drawingsRef.current.slice(0, -1));

  // PDF handlers
  const handleAttachPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      const fileName = file.name ?? 'document.pdf';
      const dir = `${FileSystem.documentDirectory}pdfs/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}${Date.now()}_${fileName}`;
      await FileSystem.copyAsync({ from: file.uri, to: dest });
      if (noteId) { await updateNote(noteId, { pdfUri: dest, pdfName: fileName }); await loadNote(); }
      Alert.alert('✅ Attached', `${fileName} has been attached.`, [
        { text: 'OK' },
        { text: 'Open Now', onPress: () => handleOpenPdf(dest, fileName) },
      ]);
    } catch { Alert.alert('Error', 'Could not attach PDF.'); }
  };

  const handleOpenPdf = (uri: string, name: string) => {
    if (!noteId) return;
    navigation.navigate('PdfViewer', { noteId, pdfUri: uri, pdfName: name });
  };

  const handleRemovePdf = () =>
    Alert.alert('Remove PDF?', 'This removes the attached PDF and all annotations.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (noteId) { await updateNote(noteId, { pdfUri: undefined, pdfName: undefined, pdfAnnotations: undefined }); await loadNote(); }
      }},
    ]);

  const SECTIONS: { key: Section; label: string }[] = [
    { key: 'text', label: '📝 Text' },
    { key: 'pdf', label: '📄 PDF' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <CalendarHeader onHomePress={() => navigation.navigate('Home')} title={isJournal ? 'Journal Entry' : 'Note'} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.highlight} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title={isJournal ? 'Journal Entry' : 'Note'}
      />

      <View style={styles.titleBar}>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder={isJournal ? 'Entry title...' : 'Note title...'}
          placeholderTextColor={COLORS.textSecondary}
        />
        {note && (
          <Text style={styles.savedLabel}>
            {saving ? 'Saving...' : `Saved ${format(new Date(note.updatedAt), 'HH:mm')}`}
          </Text>
        )}
      </View>

      <View style={styles.tabs}>
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, section === s.key && styles.activeTab]}
            onPress={() => setSection(s.key)}
          >
            <Text style={[styles.tabText, section === s.key && styles.activeTabText]}>
              {s.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={120}
      >
        {section === 'text' && (
          <>
            {/* Draw mode indicator */}
            {isDrawMode && (
              <View style={styles.drawModeIndicator}>
                <Text style={styles.drawModeIndicatorText}>✏️ Draw mode — writing area active</Text>
              </View>
            )}

            {/* Drawing toolbar when active */}
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

            <View style={styles.textContainer}>
              <ScrollView
                ref={scrollRef}
                contentContainerStyle={styles.scroll}
                scrollEnabled={!isDrawMode}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.textAreaWrapper}>
                  <TextInput
                    style={styles.textArea}
                    multiline
                    value={text}
                    onChangeText={setText}
                    placeholder={isJournal ? 'How was your day?\nWhat are you grateful for?\nWhat did you learn?' : 'Write your notes here...'}
                    placeholderTextColor="#999"
                    textAlignVertical="top"
                    editable={!isDrawMode}
                  />
                </View>
              </ScrollView>

              {/* Drawing overlay */}
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

              {/* Show existing drawings when not drawing */}
              {!isDrawMode && drawings.length > 0 && (
                <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
                  {drawings.map((path) => (
                    <Path key={path.id} d={pointsToPath(path.points)} stroke={path.color} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} />
                  ))}
                </Svg>
              )}
            </View>
          </>
        )}

        {section === 'pdf' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {note?.pdfUri ? (
              <>
                <TouchableOpacity style={styles.openPdfBtn} onPress={() => handleOpenPdf(note.pdfUri!, note.pdfName || 'PDF')} activeOpacity={0.7}>
                  <Text style={styles.openPdfIcon}>📂</Text>
                  <Text style={styles.openPdfTitle}>Open & Edit PDF</Text>
                  <Text style={styles.openPdfSub}>View pages and add annotations</Text>
                </TouchableOpacity>
                <View style={styles.attachedCard}>
                  <Text style={styles.attachedIcon}>📄</Text>
                  <View style={styles.attachedInfo}>
                    <Text style={styles.attachedName}>{note.pdfName}</Text>
                    <Text style={styles.attachedOk}>Attached ✓</Text>
                    {(note.pdfAnnotations?.length ?? 0) > 0 && (
                      <Text style={styles.annotationInfo}>✏️ Annotations on {note.pdfAnnotations!.length} page(s)</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={handleRemovePdf}><Text style={styles.removeBtn}>✕</Text></TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.changeBtn} onPress={handleAttachPdf}>
                  <Text style={styles.changeBtnText}>🔄 Replace with different PDF</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.attachBtn} onPress={handleAttachPdf}>
                  <Text style={styles.attachIcon}>📎</Text>
                  <Text style={styles.attachTitle}>Attach PDF</Text>
                  <Text style={styles.attachSub}>Meeting agendas, case files, documents...</Text>
                </TouchableOpacity>
                <View style={styles.pdfEmpty}>
                  <Text style={styles.pdfEmptyIcon}>📁</Text>
                  <Text style={styles.pdfEmptyText}>No PDF attached yet</Text>
                  <Text style={styles.pdfEmptyHint}>Tap "Attach PDF" above to add one.{'\n'}Then you can view and annotate it!</Text>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Floating draw toggle */}
      {section === 'text' && (
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
      )}

      <TouchableOpacity style={styles.saveBar} onPress={async () => { await save(); navigation.goBack(); }}>
        <Text style={styles.saveBarText}>💾 Save & Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.textSecondary, fontSize: 14, marginTop: 10 },

  titleBar: {
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.primary,
    borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder,
  },
  titleInput: { fontSize: 22, fontWeight: '700', color: COLORS.text, paddingVertical: 4 },
  savedLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 4 },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.secondary },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.highlight },
  tabText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: COLORS.text },

  textContainer: { flex: 1, position: 'relative' },
  scroll: { padding: 16, paddingBottom: 100 },
  textAreaWrapper: { minHeight: 400 },
  textArea: {
    backgroundColor: COLORS.canvasBg, borderRadius: 12, padding: 16,
    color: '#1a1a1a', fontSize: 16, lineHeight: 26, minHeight: 400,
  },

  // Drawing toolbar
  drawToolbar: { backgroundColor: COLORS.secondary, borderBottomWidth: 1, borderBottomColor: COLORS.cardBorder, padding: 10 },
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

  drawModeIndicator: { backgroundColor: 'rgba(233, 69, 96, 0.9)', paddingVertical: 6, alignItems: 'center' },
  drawModeIndicatorText: { color: COLORS.white, fontSize: 12, fontWeight: '600' },

  // Floating draw toggle
  drawToggle: {
    position: 'absolute', bottom: 60, right: 16,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8,
    zIndex: 100,
  },
  drawToggleActive: { backgroundColor: COLORS.success },
  drawToggleText: { fontSize: 20, color: COLORS.white, fontWeight: '700' },

  // PDF section
  openPdfBtn: { backgroundColor: COLORS.highlight, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 16 },
  openPdfIcon: { fontSize: 48, marginBottom: 8 },
  openPdfTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800' },
  openPdfSub: { color: COLORS.white, fontSize: 13, marginTop: 4, opacity: 0.9 },
  attachBtn: {
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 28, alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.accent, borderStyle: 'dashed', marginBottom: 16,
  },
  attachIcon: { fontSize: 40, marginBottom: 8 },
  attachTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  attachSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
  attachedCard: { backgroundColor: COLORS.cardBg, borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.success, gap: 12, marginBottom: 12 },
  attachedIcon: { fontSize: 30 },
  attachedInfo: { flex: 1 },
  attachedName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  attachedOk: { color: COLORS.success, fontSize: 12, marginTop: 2 },
  annotationInfo: { color: COLORS.highlight, fontSize: 11, marginTop: 4, fontWeight: '600' },
  removeBtn: { color: COLORS.error, fontSize: 18, fontWeight: '700', padding: 6 },
  changeBtn: { backgroundColor: COLORS.secondary, borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: COLORS.cardBorder },
  changeBtnText: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  pdfEmpty: { alignItems: 'center', paddingVertical: 40 },
  pdfEmptyIcon: { fontSize: 40, marginBottom: 10 },
  pdfEmptyText: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 8 },
  pdfEmptyHint: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  saveBar: { backgroundColor: COLORS.accent, paddingVertical: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: COLORS.cardBorder },
  saveBarText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
