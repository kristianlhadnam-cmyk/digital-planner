// FILE: digital-planner/src/screens/NotesJournalScreen.tsx

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { RootStackParamList, NoteEntry } from '../types';
import { COLORS } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import { getNotes, createNote, deleteNote } from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'NotesJournal'>;
};

export default function NotesJournalScreen({ navigation }: Props) {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [tab, setTab] = useState<'note' | 'journal'>('note');
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const load = async () => setNotes(await getNotes());

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    const note = await createNote(newTitle.trim(), tab);
    setNewTitle('');
    setShowForm(false);
    navigation.navigate('NoteEditor', { noteId: note.id, type: note.type });
  };

  const handleDelete = (id: string, title: string) =>
    Alert.alert('Delete', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteNote(id);
          await load();
        },
      },
    ]);

  const filtered = notes.filter((n) => n.type === tab);

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title="Notes & Journal"
      />

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['note', 'journal'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.activeTab]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[styles.tabText, tab === t && styles.activeTabText]}
            >
              {t === 'note' ? '📝 Notes' : '📓 Journal'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Create button / form */}
        {showForm ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder={
                tab === 'note' ? 'Note title...' : 'Journal entry title...'
              }
              placeholderTextColor={COLORS.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              onSubmitEditing={handleCreate}
              autoFocus
            />
            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.btnCreate} onPress={handleCreate}>
                <Text style={styles.btnCreateText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => { setShowForm(false); setNewTitle(''); }}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.addBtnText}>
              + New {tab === 'note' ? 'Note' : 'Journal Entry'}
            </Text>
          </TouchableOpacity>
        )}

        {/* List */}
        {filtered.map((note) => (
          <TouchableOpacity
            key={note.id}
            style={styles.noteCard}
            onPress={() =>
              navigation.navigate('NoteEditor', {
                noteId: note.id,
                type: note.type,
              })
            }
            activeOpacity={0.75}
          >
            <Text style={styles.noteIcon}>
              {note.pdfUri ? '📎' : tab === 'note' ? '📝' : '📓'}
            </Text>
            <View style={styles.noteInfo}>
              <Text style={styles.noteTitle}>{note.title}</Text>
              <Text style={styles.noteDate}>
                {format(new Date(note.updatedAt), 'MMM d, yyyy · HH:mm')}
              </Text>
              {note.textContent ? (
                <Text style={styles.notePreview} numberOfLines={2}>
                  {note.textContent}
                </Text>
              ) : null}
              {note.pdfName ? (
                <Text style={styles.pdfTag}>📄 {note.pdfName}</Text>
              ) : null}
              {(note.drawings?.length ?? 0) > 0 ? (
                <Text style={styles.drawTag}>✏️ Has handwriting</Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(note.id, note.title)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.trashIcon}>🗑️</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {filtered.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              {tab === 'note' ? '📝' : '📓'}
            </Text>
            <Text style={styles.emptyText}>
              No {tab === 'note' ? 'notes' : 'journal entries'} yet
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },

  tabs: { flexDirection: 'row', backgroundColor: COLORS.secondary },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: { borderBottomColor: COLORS.highlight },
  tabText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '600' },
  activeTabText: { color: COLORS.text },

  scroll: { padding: 16, paddingBottom: 40 },

  addBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },

  form: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.highlight,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  formBtns: { flexDirection: 'row', gap: 10 },
  btnCreate: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnCreateText: { color: COLORS.white, fontWeight: '700' },
  btnCancel: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  btnCancelText: { color: COLORS.textSecondary, fontWeight: '600' },

  noteCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    gap: 12,
  },
  noteIcon: { fontSize: 26, marginTop: 2 },
  noteInfo: { flex: 1 },
  noteTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  noteDate: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  notePreview: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  pdfTag: { color: COLORS.warning, fontSize: 11, fontWeight: '600', marginTop: 4 },
  drawTag: { color: COLORS.accent, fontSize: 11, fontWeight: '600', marginTop: 2 },
  trashIcon: { fontSize: 18, padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
});