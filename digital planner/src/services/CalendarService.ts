import * as Calendar from 'expo-calendar';
import { Platform, Linking } from 'react-native';
import { CalendarEvent } from '../types';

export const requestCalendarPermissions = async (): Promise<boolean> => {
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    console.log('Calendar permission status:', status);
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
    
    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );
    
    console.log(`Total calendars found: ${calendars.length}`);
    calendars.forEach((cal) => {
      console.log('Calendar:', {
        id: cal.id,
        title: cal.title,
        source: cal.source?.name || 'unknown',
        type: cal.source?.type || 'unknown',
      });
    });
    
    return calendars;
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

    // EXPAND search range to catch all-day events at timezone edges
    const startDate = new Date(dateString + 'T00:00:00');
    startDate.setHours(0, 0, 0, 0);
    const queryStart = new Date(startDate.getTime() - 12 * 60 * 60 * 1000);
    
    const endDate = new Date(dateString + 'T23:59:59');
    endDate.setHours(23, 59, 59, 999);
    const queryEnd = new Date(endDate.getTime() + 12 * 60 * 60 * 1000);

    const allCalendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    console.log(`📅 [${dateString}] Querying ${allCalendars.length} calendars`);

    if (allCalendars.length === 0) return [];

    const allCalendarIds = allCalendars.map((c) => c.id);
    
    const events = await Calendar.getEventsAsync(
      allCalendarIds,
      queryStart,
      queryEnd
    );

    console.log(`📅 [${dateString}] Raw events found: ${events.length}`);

    // Filter to only events that occur on this date
    const targetStart = startDate.getTime();
    const targetEnd = endDate.getTime();

    const filteredEvents = events.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      
      // Event overlaps with target day
      return (eventStart <= targetEnd && eventEnd >= targetStart);
    });

    console.log(`📅 [${dateString}] Events for this day: ${filteredEvents.length}`);
    
    filteredEvents.forEach((evt, i) => {
      const cal = allCalendars.find(c => c.id === evt.calendarId);
      console.log(`  ${i + 1}. "${evt.title}" | AllDay: ${evt.allDay} | Cal: ${cal?.title}`);
    });

    return filteredEvents.map((event) => {
      const calendar = allCalendars.find((c) => c.id === event.calendarId);
      
      // SMART DETECTION: Treat as all-day if:
      // 1. Already marked as all-day, OR
      // 2. Spans exactly 24 hours starting at midnight
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const isExactly24h = Math.abs(duration - 24 * 60 * 60 * 1000) < 60000;
      const startsAtMidnight = eventStart.getHours() === 0 && eventStart.getMinutes() === 0;
      
      // Also detect if it's an event with very early morning hours (timezone shift)
      // e.g., 02:00 to 02:00 next day in UTC+2
      const startsEarlyMorning = eventStart.getHours() <= 3 && eventStart.getMinutes() === 0;
      const treatAsAllDay = event.allDay || 
                            (isExactly24h && startsAtMidnight) ||
                            (isExactly24h && startsEarlyMorning);
      
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
        allDay: treatAsAllDay,
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
    startDate.setHours(0, 0, 0, 0);
    const queryStart = new Date(startDate.getTime() - 12 * 60 * 60 * 1000);
    
    const endDate = new Date(endDateStr + 'T23:59:59');
    endDate.setHours(23, 59, 59, 999);
    const queryEnd = new Date(endDate.getTime() + 12 * 60 * 60 * 1000);

    const allCalendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    if (allCalendars.length === 0) return [];

    const allCalendarIds = allCalendars.map((c) => c.id);
    
    const events = await Calendar.getEventsAsync(
      allCalendarIds,
      queryStart,
      queryEnd
    );

    const targetStart = startDate.getTime();
    const targetEnd = endDate.getTime();

    const filteredEvents = events.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      return (eventStart <= targetEnd && eventEnd >= targetStart);
    });

    return filteredEvents.map((event) => {
      const calendar = allCalendars.find((c) => c.id === event.calendarId);
      
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const isExactly24h = Math.abs(duration - 24 * 60 * 60 * 1000) < 60000;
      const startsAtMidnight = eventStart.getHours() === 0 && eventStart.getMinutes() === 0;
      const startsEarlyMorning = eventStart.getHours() <= 3 && eventStart.getMinutes() === 0;
      const treatAsAllDay = event.allDay || 
                            (isExactly24h && startsAtMidnight) ||
                            (isExactly24h && startsEarlyMorning);
      
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
        allDay: treatAsAllDay,
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

// Diagnostic function - shows what calendars and events the app sees
export const diagnoseCalendars = async (): Promise<string> => {
  try {
    const hasPermission = await requestCalendarPermissions();
    if (!hasPermission) {
      return '❌ NO PERMISSION\n\nGo to:\nPhone Settings → Apps → Digital Planner → Permissions → Calendar → Allow';
    }

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    if (calendars.length === 0) {
      return '⚠️ NO CALENDARS FOUND\n\nMake sure:\n• Google Calendar app installed\n• Signed in to Google account\n• Calendar sync enabled';
    }

    // Get today's events
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

    // Get tomorrow's events too
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    const tomorrowEvents = await Calendar.getEventsAsync(
      calendarIds,
      tomorrowStart,
      tomorrowEnd
    );

    let report = `📅 ${calendars.length} calendars\n`;
    report += `Today: ${todayEvents.length} events\n`;
    report += `Tomorrow: ${tomorrowEvents.length} events\n\n`;
    
    report += `═══ CALENDARS ═══\n\n`;
    
    // Group by source
    const grouped: { [key: string]: any[] } = {};
    calendars.forEach((cal) => {
      const key = cal.source?.name || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(cal);
    });

    Object.keys(grouped).forEach((source) => {
      report += `📧 ${source}\n`;
      grouped[source].forEach((cal) => {
        report += `   • "${cal.title}"\n`;
      });
      report += `\n`;
    });

    if (todayEvents.length > 0) {
      report += `\n═══ TODAY'S EVENTS ═══\n\n`;
      todayEvents.forEach((evt, i) => {
        const cal = calendars.find(c => c.id === evt.calendarId);
        const start = new Date(evt.startDate);
        report += `${i + 1}. "${evt.title}"\n`;
        report += `   📅 ${cal?.title}\n`;
        report += `   ⏰ ${evt.allDay ? 'All-day' : start.toLocaleTimeString()}\n\n`;
      });
    }

    if (tomorrowEvents.length > 0) {
      report += `\n═══ TOMORROW'S EVENTS ═══\n\n`;
      tomorrowEvents.forEach((evt, i) => {
        const cal = calendars.find(c => c.id === evt.calendarId);
        const start = new Date(evt.startDate);
        report += `${i + 1}. "${evt.title}"\n`;
        report += `   📅 ${cal?.title}\n`;
        report += `   ⏰ ${evt.allDay ? 'All-day' : start.toLocaleTimeString()}\n\n`;
      });
    }

    return report;
  } catch (error: any) {
    return '❌ Error: ' + String(error.message || error);
  }
};
