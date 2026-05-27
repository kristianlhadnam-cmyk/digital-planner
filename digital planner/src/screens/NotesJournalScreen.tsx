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

  const load = async () => {
    try {
      const data = await getNotes();
      setNotes(data || []);
    } catch (e) {
      console.log('Load error:', e);
      setNotes([]);
    }
  };

  // FIXED: Synchronous flow with better error handling
  const handleCreatePress = () => {
    const titleToUse = newTitle.trim();
    
    if (!titleToUse) {
      Alert.alert('Title Required', 'Please enter a title first.');
      return;
    }

    const noteType = tab;
    
    // Reset form immediately
    setNewTitle('');
    setShowForm(false);

    // Create and navigate in async function
    createAndNavigate(titleToUse, noteType);
  };

  const createAndNavigate = async (title: string, noteType: 'note' | 'journal') => {
    try {
      const note = await createNote(title, noteType);
      
      if (note && note.id) {
        // Reload list to show new note
        await load();
        
        // Navigate to editor
        navigation.navigate('NoteEditor', { 
          noteId: note.id, 
          type: noteType 
        });
      } else {
        Alert.alert('Error', 'Could not create note. Please try again.');
      }
    } catch (e) {
      console.log('Create note error:', e);
      Alert.alert('Error', 'Could not create note: ' + String(e));
    }
  };

  const handleOpenNote = (noteId: string, noteType: 'note' | 'journal') => {
    navigation.navigate('NoteEditor', {
      noteId: noteId,
      type: noteType,
    });
  };

  const handleDelete = (id: string, title: string) =>
    Alert.alert('Delete', `Delete "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(id);
            await load();
          } catch (e) {
            console.log('Delete error:', e);
          }
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
        <TouchableOpacity
          style={[styles.tab, tab === 'note' && styles.activeTab]}
          onPress={() => setTab('note')}
        >
          <Text style={[styles.tabText, tab === 'note' && styles.activeTabText]}>
            📝 Notes
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'journal' && styles.activeTab]}
          onPress={() => setTab('journal')}
        >
          <Text style={[styles.tabText, tab === 'journal' && styles.activeTabText]}>
            📓 Journal
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Create form */}
        {showForm ? (
          <View style={styles.form}>
            <Text style={styles.formLabel}>
              New {tab === 'note' ? 'Note' : 'Journal Entry'}
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Enter title..."
              placeholderTextColor={COLORS.textSecondary}
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
              returnKeyType="done"
            />
            <View style={styles.formBtns}>
              <TouchableOpacity
                style={styles.btnCreate}
                onPress={handleCreatePress}
                activeOpacity={0.7}
              >
                <Text style={styles.btnCreateText}>✓ Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => {
                  setNewTitle('');
                  setShowForm(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.btnCancelText}>✕ Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.addBtn} 
            onPress={() => setShowForm(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnText}>
              + New {tab === 'note' ? 'Note' : 'Journal Entry'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Notes list */}
        {filtered.map((note) => (
          <View key={note.id} style={styles.noteCard}>
            <TouchableOpacity
              style={styles.noteContent}
              onPress={() => handleOpenNote(note.id, note.type)}
              activeOpacity={0.7}
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
                  <Text style={styles.drawTag}>
                    ✏️ {note.drawings.length} drawings
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(note.id, note.title)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.7}
            >
              <Text style={styles.trashIcon}>🗑️</Text>
            </TouchableOpacity>
          </View>
        ))}

        {filtered.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{tab === 'note' ? '📝' : '📓'}</Text>
            <Text style={styles.emptyText}>
              No {tab === 'note' ? 'notes' : 'journal entries'} yet
            </Text>
            <Text style={styles.emptySubtext}>
              Tap the button above to create one
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
    borderWidth: 2,
    borderColor: COLORS.highlight,
  },
  formLabel: {
    color: COLORS.highlight,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  formBtns: { 
    flexDirection: 'row', 
    gap: 10,
  },
  btnCreate: {
    backgroundColor: COLORS.success,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnCreateText: { 
    color: COLORS.white, 
    fontWeight: '700',
    fontSize: 15,
  },
  btnCancel: {
    backgroundColor: COLORS.secondary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  btnCancelText: { 
    color: COLORS.textSecondary, 
    fontWeight: '600',
    fontSize: 15,
  },

  noteCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    overflow: 'hidden',
  },
  noteContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
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
  deleteBtn: { padding: 14 },
  trashIcon: { fontSize: 18 },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
});
