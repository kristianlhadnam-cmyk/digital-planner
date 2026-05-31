import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import {
  NoteEntry,
  TodoList,
  DrawingPath,
  CalendarEvent,
} from '../types';

const getUserId = (): string | null => {
  return auth.currentUser?.uid || null;
};

// ─────────────────────────────────────────
// NOTES SYNC
// ─────────────────────────────────────────

export const syncNotesToCloud = async (notes: NoteEntry[]): Promise<void> => {
  const userId = getUserId();
  if (!userId) {
    console.log('No user logged in - skipping notes sync');
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'data', 'notes');
    await setDoc(docRef, { 
      notes, 
      updatedAt: new Date().toISOString(),
      deviceId: Date.now().toString(),
    });
    console.log('✅ Notes synced to cloud:', notes.length);
  } catch (e) {
    console.log('❌ Sync notes error:', e);
  }
};

export const getNotesFromCloud = async (): Promise<NoteEntry[]> => {
  const userId = getUserId();
  if (!userId) {
    console.log('No user logged in - skipping notes download');
    return [];
  }

  try {
    const docRef = doc(db, 'users', userId, 'data', 'notes');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Notes downloaded from cloud:', data.notes?.length || 0);
      return data.notes || [];
    }
    console.log('No notes in cloud yet');
    return [];
  } catch (e) {
    console.log('❌ Get notes error:', e);
    return [];
  }
};

// Listen for real-time notes changes
export const subscribeToNotes = (
  callback: (notes: NoteEntry[]) => void
): Unsubscribe | null => {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'notes');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback(data.notes || []);
      }
    });
  } catch (e) {
    console.log('Subscribe notes error:', e);
    return null;
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
    await setDoc(docRef, { 
      lists, 
      updatedAt: new Date().toISOString(),
      deviceId: Date.now().toString(),
    });
    console.log('✅ Todos synced to cloud:', lists.length);
  } catch (e) {
    console.log('❌ Sync todos error:', e);
  }
};

export const getTodosFromCloud = async (): Promise<TodoList[]> => {
  const userId = getUserId();
  if (!userId) return [];

  try {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Todos downloaded:', data.lists?.length || 0);
      return data.lists || [];
    }
    return [];
  } catch (e) {
    console.log('❌ Get todos error:', e);
    return [];
  }
};

// Listen for real-time todos changes
export const subscribeToTodos = (
  callback: (todos: TodoList[]) => void
): Unsubscribe | null => {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'data', 'todos');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback(data.lists || []);
      }
    });
  } catch (e) {
    console.log('Subscribe todos error:', e);
    return null;
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
      await setDoc(docRef, { 
        drawings, 
        updatedAt: new Date().toISOString() 
      });
      console.log('✅ Drawings synced for', dateString);
    } else {
      await deleteDoc(docRef);
    }
  } catch (e) {
    console.log('❌ Sync drawings error:', e);
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
    console.log('❌ Get drawings error:', e);
    return [];
  }
};

export const getAllDrawingsFromCloud = async (): Promise<{
  [date: string]: DrawingPath[];
}> => {
  const userId = getUserId();
  if (!userId) return {};

  try {
    const drawingsCol = collection(db, 'users', userId, 'drawings');
    const snapshot = await getDocs(drawingsCol);
    const result: { [date: string]: DrawingPath[] } = {};
    snapshot.forEach((doc) => {
      result[doc.id] = doc.data().drawings || [];
    });
    console.log('✅ All drawings downloaded:', Object.keys(result).length);
    return result;
  } catch (e) {
    console.log('❌ Get all drawings error:', e);
    return {};
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
      await setDoc(docRef, { 
        events, 
        updatedAt: new Date().toISOString() 
      });
      console.log('✅ Events synced for', dateString);
    } else {
      await deleteDoc(docRef);
    }
  } catch (e) {
    console.log('❌ Sync events error:', e);
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
    console.log('❌ Get events error:', e);
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
    console.log('✅ All events downloaded:', Object.keys(result).length);
    return result;
  } catch (e) {
    console.log('❌ Get all events error:', e);
    return {};
  }
};

// ─────────────────────────────────────────
// FULL DOWNLOAD FROM CLOUD
// ─────────────────────────────────────────

export const downloadAllFromCloud = async () => {
  const userId = getUserId();
  if (!userId) {
    console.log('Not logged in - skipping download');
    return null;
  }

  try {
    console.log('🔄 Starting full download from cloud...');
    
    const [notes, todos, allEvents, allDrawings] = await Promise.all([
      getNotesFromCloud(),
      getTodosFromCloud(),
      getAllCustomEventsFromCloud(),
      getAllDrawingsFromCloud(),
    ]);

    console.log('✅ Download complete!');
    return { notes, todos, allEvents, allDrawings };
  } catch (e) {
    console.log('❌ Download all error:', e);
    return null;
  }
};
