import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DaySchedule,
  TodoList,
  TodoItem,
  NoteEntry,
  DrawingPath,
  CalendarEvent,
} from '../types';

// Simple ID generator (works on all platforms — no library needed)
const generateId = (): string => {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${Math.random().toString(36).substr(2, 9)}`;
};

const STORAGE_KEYS = {
  SCHEDULES: 'planner_schedules',
  TODO_LISTS: 'planner_todo_lists',
  NOTES: 'planner_notes',
  DAY_DRAWINGS: 'planner_day_drawings_',
  SETTINGS: 'planner_settings',
};

// ─────────────────────────────────────────
// DAY DRAWINGS
// ─────────────────────────────────────────

export const getDayDrawings = async (
  dateString: string
): Promise<DrawingPath[]> => {
  try {
    const data = await AsyncStorage.getItem(
      `${STORAGE_KEYS.DAY_DRAWINGS}${dateString}`
    );
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting day drawings:', error);
    return [];
  }
};

export const saveDayDrawings = async (
  dateString: string,
  drawings: DrawingPath[]
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.DAY_DRAWINGS}${dateString}`,
      JSON.stringify(drawings)
    );
  } catch (error) {
    console.error('Error saving day drawings:', error);
  }
};

// ─────────────────────────────────────────
// DAY SCHEDULE
// ─────────────────────────────────────────

export const getDaySchedule = async (
  dateString: string
): Promise<DaySchedule | null> => {
  try {
    const data = await AsyncStorage.getItem(
      `${STORAGE_KEYS.SCHEDULES}_${dateString}`
    );
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting day schedule:', error);
    return null;
  }
};

export const saveDaySchedule = async (
  schedule: DaySchedule
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      `${STORAGE_KEYS.SCHEDULES}_${schedule.date}`,
      JSON.stringify(schedule)
    );
  } catch (error) {
    console.error('Error saving day schedule:', error);
  }
};

// ─────────────────────────────────────────
// TODO LISTS
// ─────────────────────────────────────────

export const getTodoLists = async (): Promise<TodoList[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.TODO_LISTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting todo lists:', error);
    return [];
  }
};

export const saveTodoLists = async (lists: TodoList[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.TODO_LISTS,
      JSON.stringify(lists)
    );
  } catch (error) {
    console.error('Error saving todo lists:', error);
  }
};

export const createTodoList = async (name: string): Promise<TodoList> => {
  const lists = await getTodoLists();
  const newList: TodoList = {
    id: generateId(),
    name,
    items: [],
    createdAt: new Date().toISOString(),
  };
  lists.push(newList);
  await saveTodoLists(lists);
  return newList;
};

export const addTodoItem = async (
  listId: string,
  text: string,
  dueDate?: string
): Promise<TodoItem> => {
  const lists = await getTodoLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) throw new Error('List not found');

  const newItem: TodoItem = {
    id: generateId(),
    text,
    completed: false,
    createdAt: new Date().toISOString(),
    dueDate,
  };

  lists[listIndex].items.push(newItem);
  await saveTodoLists(lists);
  return newItem;
};

export const toggleTodoItem = async (
  listId: string,
  itemId: string
): Promise<void> => {
  const lists = await getTodoLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return;

  const itemIndex = lists[listIndex].items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return;

  lists[listIndex].items[itemIndex].completed =
    !lists[listIndex].items[itemIndex].completed;
  await saveTodoLists(lists);
};

export const deleteTodoItem = async (
  listId: string,
  itemId: string
): Promise<void> => {
  const lists = await getTodoLists();
  const listIndex = lists.findIndex((l) => l.id === listId);
  if (listIndex === -1) return;

  lists[listIndex].items = lists[listIndex].items.filter(
    (i) => i.id !== itemId
  );
  await saveTodoLists(lists);
};

export const deleteTodoList = async (listId: string): Promise<void> => {
  const lists = await getTodoLists();
  const filtered = lists.filter((l) => l.id !== listId);
  await saveTodoLists(filtered);
};

// ─────────────────────────────────────────
// NOTES & JOURNAL
// ─────────────────────────────────────────

export const getNotes = async (): Promise<NoteEntry[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting notes:', error);
    return [];
  }
};

export const saveNotes = async (notes: NoteEntry[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
  } catch (error) {
    console.error('Error saving notes:', error);
  }
};

export const getNote = async (noteId: string): Promise<NoteEntry | null> => {
  const notes = await getNotes();
  return notes.find((n) => n.id === noteId) || null;
};

export const createNote = async (
  title: string,
  type: 'note' | 'journal'
): Promise<NoteEntry> => {
  const notes = await getNotes();
  const newNote: NoteEntry = {
    id: generateId(),
    title,
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    drawings: [],
    textContent: '',
  };
  notes.unshift(newNote);
  await saveNotes(notes);
  return newNote;
};

export const updateNote = async (
  noteId: string,
  updates: Partial<NoteEntry>
): Promise<void> => {
  const notes = await getNotes();
  const index = notes.findIndex((n) => n.id === noteId);
  if (index === -1) return;

  notes[index] = {
    ...notes[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveNotes(notes);
};

export const deleteNote = async (noteId: string): Promise<void> => {
  const notes = await getNotes();
  const filtered = notes.filter((n) => n.id !== noteId);
  await saveNotes(filtered);
};

// ─────────────────────────────────────────
// CUSTOM EVENTS (Quick-Add events)
// ─────────────────────────────────────────

const CUSTOM_EVENTS_KEY = 'planner_custom_events_';

export const getCustomEvents = async (
  dateString: string
): Promise<CalendarEvent[]> => {
  try {
    const data = await AsyncStorage.getItem(`${CUSTOM_EVENTS_KEY}${dateString}`);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting custom events:', error);
    return [];
  }
};

export const saveCustomEvent = async (
  dateString: string,
  event: CalendarEvent
): Promise<void> => {
  try {
    const existing = await getCustomEvents(dateString);
    const updated = [...existing, event];
    await AsyncStorage.setItem(
      `${CUSTOM_EVENTS_KEY}${dateString}`,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.error('Error saving custom event:', error);
  }
};

export const deleteCustomEvent = async (
  dateString: string,
  eventId: string
): Promise<void> => {
  try {
    const existing = await getCustomEvents(dateString);
    const filtered = existing.filter((e) => e.id !== eventId);
    await AsyncStorage.setItem(
      `${CUSTOM_EVENTS_KEY}${dateString}`,
      JSON.stringify(filtered)
    );
  } catch (error) {
    console.error('Error deleting custom event:', error);
  }
};
