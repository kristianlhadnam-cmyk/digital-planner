// FILE: digital-planner/src/screens/NoteEditorScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
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
  const isJournal = type === 'journal';

  useEffect(() => {
    if (noteId) loadNote();
  }, [noteId]);

  const loadNote = async () => {
    if (!noteId) return;
    const data = await getNote(noteId);
    if (data) {
      setNote(data);
      setTitle(data.title);
      setText(data.textContent);
      setDrawings(data.drawings ?? []);
    }
  };

  const save = useCallback(async () => {
    if (!noteId) return;
    setSaving(true);
    await updateNote(noteId, { title, textContent: text, drawings });
    setSaving(false);
  }, [noteId, title, text, drawings]);

  // Auto-save 1 s after typing stops
  useEffect(() => {
    const t = setTimeout(() => { if (noteId) save(); }, 1000);
    return () => clearTimeout(t);
  }, [title, text]);

  const handleDrawChange = useCallback(
    async (d: DrawingPath[]) => {
      setDrawings(d);
      if (noteId) await updateNote(noteId, { drawings: d });
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
      Alert.alert('✅ Attached', `${fileName} has been attached.`);
    } catch {
      Alert.alert('Error', 'Could not attach PDF.');
    }
  };

  const handleRemovePdf = () =>
    Alert.alert('Remove PDF?', 'This removes the attached PDF.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          if (noteId) {
            await updateNote(noteId, { pdfUri: undefined, pdfName: undefined });
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

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title={isJournal ? 'Journal Entry' : 'Note'}
      />

      {/* Title */}
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
            {saving
              ? 'Saving…'
              : `Saved ${format(new Date(note.updatedAt), 'HH:mm')}`}
          </Text>
        )}
      </View>

      {/* Section tabs */}
      <View style={styles.tabs}>
        {SECTIONS.map((s) => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, section === s.key && styles.activeTab]}
            onPress={() => setSection(s.key)}
          >
            <Text
              style={[
                styles.tabText,
                section === s.key && styles.activeTabText,
              ]}
            >
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
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* ── TEXT ── */}
          {section === 'text' && (
            <TextInput
              style={styles.textArea}
              multiline
              value={text}
              onChangeText={setText}
              placeholder={
                isJournal
                  ? 'How was your day?\nWhat are you grateful for?\nWhat did you learn?'
                  : 'Write your notes here…'
              }
              placeholderTextColor="#aaa"
              textAlignVertical="top"
            />
          )}

          {/* ── DRAW ── */}
          {section === 'draw' && (
            <View>
              <Text style={styles.sectionHint}>
                ✏️ Write or sketch below
              </Text>
              <HandwritingCanvas
                initialDrawings={drawings}
                onDrawingsChange={handleDrawChange}
                height={520}
                showLines
                lineSpacing={32}
              />
            </View>
          )}

          {/* ── PDF ── */}
          {section === 'pdf' && (
            <View>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={handleAttachPdf}
              >
                <Text style={styles.attachIcon}>📎</Text>
                <Text style={styles.attachTitle}>Attach PDF</Text>
                <Text style={styles.attachSub}>
                  Meeting agendas, case files, documents…
                </Text>
              </TouchableOpacity>

              {note?.pdfUri ? (
                <View style={styles.attachedCard}>
                  <Text style={styles.attachedIcon}>📄</Text>
                  <View style={styles.attachedInfo}>
                    <Text style={styles.attachedName}>{note.pdfName}</Text>
                    <Text style={styles.attachedOk}>Attached ✓</Text>
                  </View>
                  <TouchableOpacity onPress={handleRemovePdf}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.pdfEmpty}>
                  <Text style={styles.pdfEmptyIcon}>📁</Text>
                  <Text style={styles.pdfEmptyText}>No PDF attached yet</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save bar */}
      <TouchableOpacity
        style={styles.saveBar}
        onPress={async () => { await save(); navigation.goBack(); }}
      >
        <Text style={styles.saveBarText}>💾 Save & Go Back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const { height: H } = Dimensions.get('window');

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

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
    minHeight: H * 0.5,
  },

  sectionHint: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
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
  },
  attachedIcon: { fontSize: 30 },
  attachedInfo: { flex: 1 },
  attachedName: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  attachedOk: { color: COLORS.success, fontSize: 12, marginTop: 2 },
  removeBtn: { color: COLORS.error, fontSize: 18, fontWeight: '700', padding: 6 },

  pdfEmpty: { alignItems: 'center', paddingVertical: 40 },
  pdfEmptyIcon: { fontSize: 40, marginBottom: 10 },
  pdfEmptyText: { color: COLORS.textSecondary, fontSize: 15 },

  saveBar: {
    backgroundColor: COLORS.accent,
    paddingVertical: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
  },
  saveBarText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
});