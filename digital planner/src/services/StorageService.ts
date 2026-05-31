import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DaySchedule,
  TodoList,
  TodoItem,
  NoteEntry,
  DrawingPath,
  CalendarEvent,
} from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import {
  syncNotesToCloud,
  syncTodosToCloud,
  syncDayDrawingsToCloud,
  syncCustomEventsToCloud,
  downloadAllFromCloud,
} from './CloudSyncService';
import { auth } from './firebase';

const generateId = (): string => {
  const timestamp = Date.now().toString(36);
  const random1 = Math.random().toString(36).substring(2, 11);
  const random2 = Math.random().toString(36).substring(2, 11);
  return `${timestamp}_${random1}_${random2}`;
};

const isLoggedIn = (): boolean => {
  return auth.currentUser !== null;
};

const CUSTOM_EVENTS_KEY = 'planner_custom_events_';

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
    if (isLoggedIn()) {
      await syncDayDrawingsToCloud(dateString, drawings);
    }
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
// CUSTOM EVENTS
// ─────────────────────────────────────────

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
    if (isLoggedIn()) {
      await syncCustomEventsToCloud(dateString, updated);
    }
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
    if (isLoggedIn()) {
      await syncCustomEventsToCloud(dateString, filtered);
    }
  } catch (error) {
    console.error('Error deleting custom event:', error);
  }
};

export const getCustomEventsForRange = async (
  startDateString: string,
  endDateString: string
): Promise<{ [date: string]: CalendarEvent[] }> => {
  try {
    const result: { [date: string]: CalendarEvent[] } = {};
    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const events = await getCustomEvents(dateStr);
      if (events.length > 0) {
        result[dateStr] = events;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  } catch (error) {
    console.error('Error getting custom events range:', error);
    return {};
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
    if (isLoggedIn()) {
      await syncTodosToCloud(lists);
    }
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
    if (isLoggedIn()) {
      await syncNotesToCloud(notes);
    }
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
// FULL SYNC FROM CLOUD
// ─────────────────────────────────────────

export const syncFromCloud = async (): Promise<{
  notesCount: number;
  todosCount: number;
  eventsCount: number;
  drawingsCount: number;
}> => {
  if (!isLoggedIn()) {
    console.log('Not logged in - cannot sync');
    return { notesCount: 0, todosCount: 0, eventsCount: 0, drawingsCount: 0 };
  }

  try {
    console.log('🔄 Downloading all data from cloud...');
    const cloudData = await downloadAllFromCloud();
    
    if (!cloudData) {
      console.log('No cloud data');
      return { notesCount: 0, todosCount: 0, eventsCount: 0, drawingsCount: 0 };
    }

    const { notes, todos, allEvents, allDrawings } = cloudData;

    // Save notes locally
    if (notes && notes.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
      console.log('💾 Saved', notes.length, 'notes locally');
    }

    // Save todos locally
    if (todos && todos.length > 0) {
      await AsyncStorage.setItem(
        STORAGE_KEYS.TODO_LISTS,
        JSON.stringify(todos)
      );
      console.log('💾 Saved', todos.length, 'todo lists locally');
    }

    // Save custom events locally
    let eventsCount = 0;
    if (allEvents) {
      for (const [dateStr, events] of Object.entries(allEvents)) {
        await AsyncStorage.setItem(
          `${CUSTOM_EVENTS_KEY}${dateStr}`,
          JSON.stringify(events)
        );
        eventsCount++;
      }
      console.log('💾 Saved events for', eventsCount, 'days locally');
    }

    // Save drawings locally
    let drawingsCount = 0;
    if (allDrawings) {
      for (const [dateStr, drawings] of Object.entries(allDrawings)) {
        await AsyncStorage.setItem(
          `${STORAGE_KEYS.DAY_DRAWINGS}${dateStr}`,
          JSON.stringify(drawings)
        );
        drawingsCount++;
      }
      console.log('💾 Saved drawings for', drawingsCount, 'days locally');
    }

    console.log('✅ Sync complete!');
    return {
      notesCount: notes?.length || 0,
      todosCount: todos?.length || 0,
      eventsCount,
      drawingsCount,
    };
  } catch (e) {
    console.log('❌ Sync from cloud error:', e);
    return { notesCount: 0, todosCount: 0, eventsCount: 0, drawingsCount: 0 };
  }
};
