// FILE: digital-planner/src/services/CalendarService.ts

import * as Calendar from 'expo-calendar';
import { Platform, Linking } from 'react-native';
import { CalendarEvent } from '../types';

export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Error requesting calendar permissions:', error);
    return false;
  }
};

export const getCalendars = async () => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    return calendars;
  } catch (error) {
    console.error('Error getting calendars:', error);
    return [];
  }
};

export const getEventsForDate = async (
  dateString: string
): Promise<CalendarEvent[]> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];

    const startDate = new Date(dateString);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateString);
    endDate.setHours(23, 59, 59, 999);

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    const calendarIds = calendars.map((c) => c.id);
    if (calendarIds.length === 0) return [];

    const events = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate:
        event.startDate instanceof Date
          ? event.startDate.toISOString()
          : new Date(event.startDate).toISOString(),
      endDate:
        event.endDate instanceof Date
          ? event.endDate.toISOString()
          : new Date(event.endDate).toISOString(),
      allDay: event.allDay || false,
      calendarSource: detectCalendarSource(
        calendars.find((c) => c.id === event.calendarId)
      ),
      color: calendars.find((c) => c.id === event.calendarId)?.color,
    }));
  } catch (error) {
    console.error('Error getting events:', error);
    return [];
  }
};

export const getEventsForRange = async (
  startDateStr: string,
  endDateStr: string
): Promise<CalendarEvent[]> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];

    const startDate = new Date(startDateStr);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(endDateStr);
    endDate.setHours(23, 59, 59, 999);

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    const calendarIds = calendars.map((c) => c.id);
    if (calendarIds.length === 0) return [];

    const events = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );

    return events.map((event) => ({
      id: event.id,
      title: event.title,
      startDate:
        event.startDate instanceof Date
          ? event.startDate.toISOString()
          : new Date(event.startDate).toISOString(),
      endDate:
        event.endDate instanceof Date
          ? event.endDate.toISOString()
          : new Date(event.endDate).toISOString(),
      allDay: event.allDay || false,
      calendarSource: detectCalendarSource(
        calendars.find((c) => c.id === event.calendarId)
      ),
      color: calendars.find((c) => c.id === event.calendarId)?.color,
    }));
  } catch (error) {
    console.error('Error getting events for range:', error);
    return [];
  }
};

const detectCalendarSource = (
  calendar: any
): CalendarEvent['calendarSource'] => {
  if (!calendar) return 'local';
  const source = calendar.source;
  if (!source) return 'local';
  const sourceName = (source.name || '').toLowerCase();
  const sourceType = (source.type || '').toLowerCase();
  if (sourceName.includes('google') || sourceType.includes('google'))
    return 'google';
  if (
    sourceName.includes('outlook') ||
    sourceName.includes('exchange') ||
    sourceName.includes('microsoft')
  )
    return 'outlook';
  if (sourceName.includes('icloud') || sourceType === 'caldav') return 'apple';
  return 'local';
};

export const openExternalCalendar = async (): Promise<void> => {
  try {
    if (Platform.OS === 'ios') {
      await Linking.openURL('calshow://');
    } else {
      await Linking.openURL('content://com.android.calendar/time/');
    }
  } catch (error) {
    console.error('Error opening calendar:', error);
  }
};