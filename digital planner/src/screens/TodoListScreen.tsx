// FILE: digital-planner/src/screens/TodoListScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, TodoList, TodoItem } from '../types';
import { COLORS } from '../utils/constants';
import CalendarHeader from '../components/CalendarHeader';
import {
  getTodoLists,
  createTodoList,
  addTodoItem,
  toggleTodoItem,
  deleteTodoItem,
  deleteTodoList,
} from '../services/StorageService';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TodoList'>;
};

export default function TodoListScreen({ navigation }: Props) {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [newListName, setNewListName] = useState('');
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    load();
  }, []);

  const load = async () => setLists(await getTodoLists());

  const handleCreate = async () => {
    if (!newListName.trim()) return;
    await createTodoList(newListName.trim());
    setNewListName('');
    setShowForm(false);
    await load();
  };

  const handleAddItem = async (listId: string) => {
    const text = newItemText[listId]?.trim();
    if (!text) return;
    await addTodoItem(listId, text);
    setNewItemText((p) => ({ ...p, [listId]: '' }));
    await load();
  };

  const handleToggle = async (listId: string, itemId: string) => {
    await toggleTodoItem(listId, itemId);
    await load();
  };

  const handleDeleteItem = async (listId: string, itemId: string) => {
    await deleteTodoItem(listId, itemId);
    await load();
  };

  const handleDeleteList = (listId: string, name: string) =>
    Alert.alert('Delete List', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTodoList(listId);
          await load();
        },
      },
    ]);

  const openExternal = () => {
    const url =
      Platform.OS === 'ios'
        ? 'x-apple-reminderkit://'
        : 'https://to-do.microsoft.com';
    Linking.openURL(url).catch(() => {});
  };

  const doneCount = (items: TodoItem[]) =>
    items.filter((i) => i.completed).length;

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        title="To-Do Lists & Reminders"
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* External link */}
        <TouchableOpacity style={styles.externalCard} onPress={openExternal}>
          <Text style={styles.externalIcon}>
            {Platform.OS === 'ios' ? '🍎' : '📋'}
          </Text>
          <View style={styles.externalInfo}>
            <Text style={styles.externalTitle}>
              {Platform.OS === 'ios' ? 'Apple Reminders' : 'Microsoft To-Do'}
            </Text>
            <Text style={styles.externalSub}>Open external app →</Text>
          </View>
        </TouchableOpacity>

        {/* Create new list */}
        {showForm ? (
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="List name..."
              placeholderTextColor={COLORS.textSecondary}
              value={newListName}
              onChangeText={setNewListName}
              onSubmitEditing={handleCreate}
              autoFocus
            />
            <View style={styles.formBtns}>
              <TouchableOpacity style={styles.btnCreate} onPress={handleCreate}>
                <Text style={styles.btnCreateText}>Create</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setShowForm(false)}
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.addListBtn}
            onPress={() => setShowForm(true)}
          >
            <Text style={styles.addListBtnText}>+ Create New List</Text>
          </TouchableOpacity>
        )}

        {/* Lists */}
        {lists.map((list) => (
          <View key={list.id} style={styles.listCard}>
            {/* Header */}
            <TouchableOpacity
              style={styles.listHeader}
              onPress={() =>
                setExpandedId(expandedId === list.id ? null : list.id)
              }
            >
              <View style={styles.listHeaderLeft}>
                <Text style={styles.listName}>{list.name}</Text>
                <Text style={styles.listCount}>
                  {doneCount(list.items)}/{list.items.length} done
                </Text>
              </View>
              <View style={styles.listHeaderRight}>
                <TouchableOpacity
                  onPress={() => handleDeleteList(list.id, list.name)}
                >
                  <Text style={styles.trashIcon}>🗑️</Text>
                </TouchableOpacity>
                <Text style={styles.chevron}>
                  {expandedId === list.id ? '▼' : '▶'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Progress */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      list.items.length > 0
                        ? `${(doneCount(list.items) / list.items.length) * 100}%`
                        : '0%',
                  },
                ]}
              />
            </View>

            {/* Expanded content */}
            {expandedId === list.id && (
              <View style={styles.listBody}>
                {list.items.map((item) => (
                  <View key={item.id} style={styles.todoRow}>
                    <TouchableOpacity
                      onPress={() => handleToggle(list.id, item.id)}
                    >
                      <Text style={styles.checkbox}>
                        {item.completed ? '☑️' : '⬜'}
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.todoText,
                        item.completed && styles.todoTextDone,
                      ]}
                    >
                      {item.text}
                    </Text>
                    <TouchableOpacity
                      onPress={() => handleDeleteItem(list.id, item.id)}
                    >
                      <Text style={styles.deleteItem}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add item */}
                <View style={styles.addItemRow}>
                  <TextInput
                    style={styles.addItemInput}
                    placeholder="Add task..."
                    placeholderTextColor={COLORS.textSecondary}
                    value={newItemText[list.id] ?? ''}
                    onChangeText={(t) =>
                      setNewItemText((p) => ({ ...p, [list.id]: t }))
                    }
                    onSubmitEditing={() => handleAddItem(list.id)}
                  />
                  <TouchableOpacity
                    style={styles.addItemBtn}
                    onPress={() => handleAddItem(list.id)}
                  >
                    <Text style={styles.addItemBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        ))}

        {lists.length === 0 && !showForm && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyText}>No lists yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },

  externalCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  externalIcon: { fontSize: 28, marginRight: 12 },
  externalInfo: { flex: 1 },
  externalTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  externalSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  addListBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  addListBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '700' },

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

  listCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  listHeaderLeft: { flex: 1 },
  listHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  listName: { color: COLORS.text, fontSize: 17, fontWeight: '700' },
  listCount: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  trashIcon: { fontSize: 16 },
  chevron: { color: COLORS.textSecondary, fontSize: 13 },

  progressBg: { height: 3, backgroundColor: COLORS.background, marginHorizontal: 16 },
  progressFill: { height: '100%', backgroundColor: COLORS.success, borderRadius: 2 },

  listBody: { padding: 16, paddingTop: 12 },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.cardBorder,
    gap: 10,
  },
  checkbox: { fontSize: 20 },
  todoText: { color: COLORS.text, fontSize: 15, flex: 1 },
  todoTextDone: {
    textDecorationLine: 'line-through',
    color: COLORS.textSecondary,
    opacity: 0.6,
  },
  deleteItem: { color: COLORS.error, fontSize: 14, fontWeight: '700', padding: 4 },

  addItemRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  addItemInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  addItemBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addItemBtnText: { color: COLORS.text, fontSize: 24, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 14 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: '600' },
});