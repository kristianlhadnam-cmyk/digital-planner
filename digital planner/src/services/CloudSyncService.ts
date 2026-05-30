import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  NoteEntry,
  TodoList,
  DrawingPath,
  CalendarEvent,
} from '../types';

// Get current user ID
const getUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

// ─────────────────────────────────────────
// NOTES SYNC
// ─────────────────────────────────────────

export const syncNotesToCloud = async (notes: NoteEntry[]): Promise<void> => {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'notes');
    await setDoc(docRef, { notes, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.log('Sync notes error:', e);
  }
};

export const getNotesFromCloud = async (): Promise<NoteEntry[]> => {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'data', 'notes');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().notes || [];
    }
    return [];
  } catch (e) {
    console.log('Get notes error:', e);
    return [];
  }
};

// ─────────────────────────────────────────
// TODO LISTS SYNC
// ─────────────────────────────────────────

export const syncTodosToCloud = async (lists: TodoList[]): Promise<void> => {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    await setDoc(docRef, { lists, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.log('Sync todos error:', e);
  }
};

export const getTodosFromCloud = async (): Promise<TodoList[]> => {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().lists || [];
    }
    return [];
  } catch (e) {
    console.log('Get todos error:', e);
    return [];
  }
};

// ─────────────────────────────────────────
// DAY DRAWINGS SYNC
// ─────────────────────────────────────────

export const syncDayDrawingsToCloud = async (
  dateString: string,
  drawings: DrawingPath[]
): Promise<void> => {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'drawings', dateString);
    if (drawings.length > 0) {
      await setDoc(docRef, { drawings, updatedAt: new Date().toISOString() });
    } else {
      await deleteDoc(docRef);
    }
  } catch (e) {
    console.log('Sync drawings error:', e);
  }
};

export const getDayDrawingsFromCloud = async (
  dateString: string
): Promise<DrawingPath[]> => {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'drawings', dateString);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().drawings || [];
    }
    return [];
  } catch (e) {
    console.log('Get drawings error:', e);
    return [];
  }
};

// ─────────────────────────────────────────
// CUSTOM EVENTS SYNC
// ─────────────────────────────────────────

export const syncCustomEventsToCloud = async (
  dateString: string,
  events: CalendarEvent[]
): Promise<void> => {
  const userId = getUserId();
  if (!userId) return;

  try {
    const docRef = doc(db, 'users', userId, 'events', dateString);
    if (events.length > 0) {
      await setDoc(docRef, { events, updatedAt: new Date().toISOString() });
    } else {
      await deleteDoc(docRef);
    }
  } catch (e) {
    console.log('Sync events error:', e);
  }
};

export const getCustomEventsFromCloud = async (
  dateString: string
): Promise<CalendarEvent[]> => {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'events', dateString);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().events || [];
    }
    return [];
  } catch (e) {
    console.log('Get events error:', e);
    return [];
  }
};

export const getAllCustomEventsFromCloud = async (): Promise<{
  [date: string]: CalendarEvent[];
}> => {
  const userId = getUserId();
  if (!userId) return {};

  try {
    const eventsCol = collection(db, 'users', userId, 'events');
    const snapshot = await getDocs(eventsCol);
    const result: { [date: string]: CalendarEvent[] } = {};
    snapshot.forEach((doc) => {
      result[doc.id] = doc.data().events || [];
    });
    return result;
  } catch (e) {
    console.log('Get all events error:', e);
    return {};
  }
};

// ─────────────────────────────────────────
// FULL SYNC (Download everything from cloud)
// ─────────────────────────────────────────

export const downloadAllFromCloud = async () => {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const [notes, todos, allEvents] = await Promise.all([
      getNotesFromCloud(),
      getTodosFromCloud(),
      getAllCustomEventsFromCloud(),
    ]);

    return { notes, todos, allEvents };
  } catch (e) {
    console.log('Download all error:', e);
    return null;
  }
};
