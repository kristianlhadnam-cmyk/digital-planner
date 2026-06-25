export interface DrawingPath {
  id: string;
  points: Point[];
  color: string;
  strokeWidth: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawingSticker {
  id: string;
  drawings: DrawingPath[];
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  hasBackground: boolean;
  createdAt: string;
}

export interface PdfAnnotation {
  pageNumber: number;
  drawings: DrawingPath[];
}

export interface DaySchedule {
  date: string;
  stickers: DrawingSticker[];
  events: CalendarEvent[];
  notes: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  allDay: boolean;
  calendarSource: 'local' | 'google' | 'outlook' | 'apple';
  color?: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  dueDate?: string;
  drawings?: DrawingPath[];
}

export interface TodoList {
  id: string;
  name: string;
  items: TodoItem[];
  createdAt: string;
}

export interface NoteEntry {
  id: string;
  title: string;
  type: 'note' | 'journal';
  createdAt: string;
  updatedAt: string;
  drawings: DrawingPath[];
  textContent: string;
  pdfUri?: string;
  pdfName?: string;
  pdfAnnotations?: PdfAnnotation[];
}

export type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  Home: undefined;
  YearlyView: { year: number };
  MonthlyView: { year: number; month: number };
  WeeklyView: { year: number; weekNumber: number; startDate: string };
  DailyView: { date: string };
  TodoList: undefined;
  NotesJournal: undefined;
  NoteEditor: { noteId?: string; type: 'note' | 'journal' };
  PdfViewer: { noteId: string; pdfUri: string; pdfName: string };
  Account: undefined;
};
