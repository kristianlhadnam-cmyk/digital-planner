import * as Calendar from 'expo-calendar';
import { Platform, Linking } from 'react-native';
import { CalendarEvent } from '../types';

export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.error('Permission error:', error);
    return false;
  }
};

export const getCalendars = async () => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];
    return await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  } catch (error) {
    console.error('Get calendars error:', error);
    return [];
  }
};

export const getEventsForDate = async (
  dateString: string
): Promise<CalendarEvent[]> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) return [];

    // Set time range for the FULL day
    const startDate = new Date(dateString + 'T00:00:00');
    const endDate = new Date(dateString + 'T23:59:59');

    const allCalendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    console.log(`📅 [${dateString}] Querying ${allCalendars.length} calendars`);

    if (allCalendars.length === 0) return [];

    // Use ALL calendar IDs - no filtering
    const allCalendarIds = allCalendars.map((c) => c.id);
    
    const events = await Calendar.getEventsAsync(
      allCalendarIds,
      startDate,
      endDate
    );

    console.log(`📅 [${dateString}] Found ${events.length} raw events`);
    
    // Log every single event for debugging
    events.forEach((evt, i) => {
      const cal = allCalendars.find(c => c.id === evt.calendarId);
      console.log(`  ${i + 1}. "${evt.title}"`);
      console.log(`     Calendar: ${cal?.title || 'unknown'}`);
      console.log(`     Status: ${(evt as any).status || 'none'}`);
      console.log(`     Availability: ${(evt as any).availability || 'none'}`);
      console.log(`     AllDay: ${evt.allDay}`);
      console.log(`     Start: ${evt.startDate}`);
    });

    // Convert to our format - INCLUDE EVERYTHING
    return events.map((event) => {
      const calendar = allCalendars.find((c) => c.id === event.calendarId);
      return {
        id: event.id,
        title: event.title || '(No title)',
        startDate:
          event.startDate instanceof Date
            ? event.startDate.toISOString()
            : new Date(event.startDate).toISOString(),
        endDate:
          event.endDate instanceof Date
            ? event.endDate.toISOString()
            : new Date(event.endDate).toISOString(),
        allDay: event.allDay || false,
        calendarSource: detectCalendarSource(calendar),
        color: calendar?.color || '#0f3460',
      };
    });
  } catch (error) {
    console.error('Get events error:', error);
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

    const startDate = new Date(startDateStr + 'T00:00:00');
    const endDate = new Date(endDateStr + 'T23:59:59');

    const allCalendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    if (allCalendars.length === 0) return [];

    const allCalendarIds = allCalendars.map((c) => c.id);
    
    const events = await Calendar.getEventsAsync(
      allCalendarIds,
      startDate,
      endDate
    );

    return events.map((event) => {
      const calendar = allCalendars.find((c) => c.id === event.calendarId);
      return {
        id: event.id,
        title: event.title || '(No title)',
        startDate:
          event.startDate instanceof Date
            ? event.startDate.toISOString()
            : new Date(event.startDate).toISOString(),
        endDate:
          event.endDate instanceof Date
            ? event.endDate.toISOString()
            : new Date(event.endDate).toISOString(),
        allDay: event.allDay || false,
        calendarSource: detectCalendarSource(calendar),
        color: calendar?.color || '#0f3460',
      };
    });
  } catch (error) {
    console.error('Range events error:', error);
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
    console.error('Open calendar error:', error);
  }
};

export const diagnoseCalendars = async (): Promise<string> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return '❌ NO PERMISSION\n\nSettings → Apps → Digital Planner → Permissions → Calendar → Allow';
    }

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    if (calendars.length === 0) {
      return '⚠️ NO CALENDARS FOUND';
    }

    // Also get TODAY's events for context
    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    const calendarIds = calendars.map(c => c.id);
    const todayEvents = await Calendar.getEventsAsync(
      calendarIds,
      startDate,
      endDate
    );

    let report = `📅 ${calendars.length} CALENDARS, ${todayEvents.length} EVENTS TODAY\n\n`;
    
    report += `═══ CALENDARS ═══\n\n`;
    calendars.forEach((cal, i) => {
      report += `${i + 1}. "${cal.title}"\n`;
      report += `   📧 ${cal.source?.name || 'unknown'}\n`;
      report += `   🔧 ${cal.source?.type || 'unknown'}\n\n`;
    });

    if (todayEvents.length > 0) {
      report += `\n═══ TODAY'S EVENTS ═══\n\n`;
      todayEvents.forEach((evt, i) => {
        const cal = calendars.find(c => c.id === evt.calendarId);
        report += `${i + 1}. "${evt.title}"\n`;
        report += `   📅 ${cal?.title}\n`;
        if ((evt as any).status) report += `   ℹ️ Status: ${(evt as any).status}\n`;
        if ((evt as any).availability) report += `   👁️ Availability: ${(evt as any).availability}\n`;
        report += `\n`;
      });
    }

    return report;
  } catch (error: any) {
    return '❌ Error: ' + String(error.message || error);
  }
};
