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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { format } from 'date-fns';
import { RootStackParamList, NoteEntry, DrawingPath } from '../types';
import { COLORS } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import HandwritingCanvas from '../components/HandwritingCanvas';
import { getNote, updateNote } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NoteEditor'>;
  route: RouteProp<RootStackParamList, 'NoteEditor'>;
};

type Section = 'text' | 'draw' | 'pdf';

export default function NoteEditorScreen({ navigation, route }: Props) {
  const { noteId, type } = route.params;
  const [note, setNote] = useState<NoteEntry | null>(null);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [section, setSection] = useState<Section>('text');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);

  const isInitialLoad = useRef(true);
  const isJournal = type === 'journal';

  useEffect(() => {
    if (noteId) {
      loadNote();
    } else {
      setLoading(false);
    }
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
        setDrawings(data.drawings || []);
        setCanvasKey(prev => prev + 1);
      }
    } catch (e) {
      console.log('Load note error:', e);
    }

    setLoading(false);
    setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);
  };

  const save = useCallback(async () => {
    if (!noteId) return;
    setSaving(true);
    try {
      await updateNote(noteId, { title, textContent: text, drawings });
    } catch (e) {
      console.log('Save error:', e);
    }
    setSaving(false);
  }, [noteId, title, text, drawings]);

  useEffect(() => {
    if (isInitialLoad.current) return;
    if (!noteId) return;

    const timer = setTimeout(() => {
      save();
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, text]);

  const handleDrawChange = useCallback(
    async (newDrawings: DrawingPath[]) => {
      if (isInitialLoad.current) return;

      setDrawings(newDrawings);
      if (noteId) {
        try {
          await updateNote(noteId, { drawings: newDrawings });
        } catch (e) {
          console.log('Save drawings error:', e);
        }
      }
    },
    [noteId]
  );

  const handleAttachPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.length) return;

      const file = result.assets[0];
      const fileName = file.name ?? 'document.pdf';
      const dir = `${FileSystem.documentDirectory}pdfs/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const dest = `${dir}${Date.now()}_${fileName}`;
      await FileSystem.copyAsync({ from: file.uri, to: dest });

      if (noteId) {
        await updateNote(noteId, { pdfUri: dest, pdfName: fileName });
        await loadNote();
      }
      Alert.alert(
        '✅ Attached',
        `${fileName} has been attached.`,
        [
          { text: 'OK' },
          {
            text: 'Open Now',
            onPress: () => handleOpenPdf(dest, fileName),
          },
        ]
      );
    } catch (e) {
      console.log('PDF error:', e);
      Alert.alert('Error', 'Could not attach PDF.');
    }
  };

  const handleOpenPdf = (uri: string, name: string) => {
    if (!noteId) return;
    navigation.navigate('PdfViewer', {
      noteId,
      pdfUri: uri,
      pdfName: name,
    });
  };

  const handleRemovePdf = () =>
    Alert.alert('Remove PDF?', 'This removes the attached PDF and all annotations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (noteId) {
            await updateNote(noteId, { 
              pdfUri: undefined, 
              pdfName: undefined,
              pdfAnnotations: undefined,
            });
            await loadNote();
          }
        },
      },
    ]);

  const SECTIONS: { key: Section; label: string }[] = [
    { key: 'text', label: '📝 Text' },
    { key: 'draw', label: '✏️ Draw' },
    { key: 'pdf', label: '📄 PDF' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <CalendarHeader
          onHomePress={() => navigation.navigate('Home')}
          title={isJournal ? 'Journal Entry' : 'Note'}
        />
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
          <ScrollView contentContainerStyle={styles.scroll}>
            <TextInput
              style={styles.textArea}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={
                isJournal
                  ? 'How was your day?\nWhat are you grateful for?\nWhat did you learn?'
                  : 'Write your notes here...'
              }
              placeholderTextColor="#999"
              textAlignVertical="top"
            />
          </ScrollView>
        )}

        {section === 'draw' && (
          <View style={styles.drawSection}>
            <Text style={styles.sectionHint}>
              ✏️ Write or sketch below
            </Text>
            <HandwritingCanvas
              key={`note-canvas-${noteId}-${canvasKey}`}
              initialDrawings={drawings}
              onDrawingsChange={handleDrawChange}
              height={520}
              showLines
              lineSpacing={32}
            />
          </View>
        )}

        {section === 'pdf' && (
          <ScrollView contentContainerStyle={styles.scroll}>
            {note?.pdfUri ? (
              <>
                {/* PDF Already Attached - Show Open Button */}
                <TouchableOpacity
                  style={styles.openPdfBtn}
                  onPress={() => handleOpenPdf(note.pdfUri!, note.pdfName || 'PDF')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.openPdfIcon}>📂</Text>
                  <Text style={styles.openPdfTitle}>Open & Edit PDF</Text>
                  <Text style={styles.openPdfSub}>
                    View pages and add annotations
                  </Text>
                </TouchableOpacity>

                <View style={styles.attachedCard}>
                  <Text style={styles.attachedIcon}>📄</Text>
                  <View style={styles.attachedInfo}>
                    <Text style={styles.attachedName}>{note.pdfName}</Text>
                    <Text style={styles.attachedOk}>Attached ✓</Text>
                    {(note.pdfAnnotations?.length ?? 0) > 0 && (
                      <Text style={styles.annotationInfo}>
                        ✏️ Annotations on {note.pdfAnnotations!.length} page(s)
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={handleRemovePdf}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity 
                  style={styles.changeBtn} 
                  onPress={handleAttachPdf}
                >
                  <Text style={styles.changeBtnText}>
                    🔄 Replace with different PDF
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* No PDF - Show Attach Button */}
                <TouchableOpacity style={styles.attachBtn} onPress={handleAttachPdf}>
                  <Text style={styles.attachIcon}>📎</Text>
                  <Text style={styles.attachTitle}>Attach PDF</Text>
                  <Text style={styles.attachSub}>
                    Meeting agendas, case files, documents...
                  </Text>
                </TouchableOpacity>

                <View style={styles.pdfEmpty}>
                  <Text style={styles.pdfEmptyIcon}>📁</Text>
                  <Text style={styles.pdfEmptyText}>No PDF attached yet</Text>
                  <Text style={styles.pdfEmptyHint}>
                    Tap "Attach PDF" above to add one.{'\n'}
                    Then you can view and annotate it!
                  </Text>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      <TouchableOpacity
        style={styles.saveBar}
        onPress={async () => {
          await save();
          navigation.goBack();
        }}
      >
        <Text style={styles.saveBarText}>💾 Save & Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 10,
  },

  titleBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    paddingVertical: 4,
  },
  savedLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.secondary },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: COLORS.highlight },
  tabText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: COLORS.text },

  scroll: { padding: 16, paddingBottom: 100 },

  textArea: {
    backgroundColor: COLORS.canvasBg,
    borderRadius: 12,
    padding: 16,
    color: '#1a1a1a',
    fontSize: 16,
    lineHeight: 26,
    minHeight: 400,
  },

  drawSection: {
    flex: 1,
    padding: 16,
  },
  sectionHint: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },

  // PDF section
  openPdfBtn: {
    backgroundColor: COLORS.highlight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  openPdfIcon: { fontSize: 48, marginBottom: 8 },
  openPdfTitle: { 
    color: COLORS.white, 
    fontSize: 18, 
    fontWeight: '800' 
  },
  openPdfSub: { 
    color: COLORS.white, 
    fontSize: 13, 
    marginTop: 4,
    opacity: 0.9,
  },

  attachBtn: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.accent,
    borderStyle: 'dashed',
    marginBottom: 16,
  },
  attachIcon: { fontSize: 40, marginBottom: 8 },
  attachTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  attachSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },

  attachedCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success,
    gap: 12,
    marginBottom: 12,
  },
  attachedIcon: { fontSize: 30 },
  attachedInfo: { flex: 1 },
  attachedName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  attachedOk: { color: COLORS.success, fontSize: 12, marginTop: 2 },
  annotationInfo: { 
    color: COLORS.highlight, 
    fontSize: 11, 
    marginTop: 4,
    fontWeight: '600',
  },
  removeBtn: { color: COLORS.error, fontSize: 18, fontWeight: '700', padding: 6 },

  changeBtn: {
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  changeBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },

  pdfEmpty: { alignItems: 'center', paddingVertical: 40 },
  pdfEmptyIcon: { fontSize: 40, marginBottom: 10 },
  pdfEmptyText: { 
    color: COLORS.text, 
    fontSize: 16, 
    fontWeight: '600',
    marginBottom: 8,
  },
  pdfEmptyHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },

  saveBar: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  saveBarText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});
