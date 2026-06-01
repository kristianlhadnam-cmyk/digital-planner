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

    // The target day
    const targetDay = new Date(dateString + 'T00:00:00');
    targetDay.setHours(0, 0, 0, 0);
    const targetDayEnd = new Date(dateString + 'T23:59:59');
    targetDayEnd.setHours(23, 59, 59, 999);

    // EXPAND search range significantly to catch:
    // - Multi-day events that started days ago
    // - All-day events at timezone edges
    const queryStart = new Date(targetDay.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before
    const queryEnd = new Date(targetDayEnd.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days after

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

    console.log(`📅 [${dateString}] Raw events in 60-day range: ${events.length}`);

    // Filter to events that OVERLAP with the target day
    // This includes:
    // 1. Events that start on this day
    // 2. Events that end on this day
    // 3. Events that span across this day (started before, ends after)
    const filteredEvents = events.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      const dayStart = targetDay.getTime();
      const dayEnd = targetDayEnd.getTime();
      
      // Event overlaps with the target day if:
      // - Event ends after day starts AND event starts before day ends
      return eventEnd >= dayStart && eventStart <= dayEnd;
    });

    console.log(`📅 [${dateString}] Events overlapping this day: ${filteredEvents.length}`);
    
    filteredEvents.forEach((evt, i) => {
      const cal = allCalendars.find(c => c.id === evt.calendarId);
      const start = new Date(evt.startDate);
      const end = new Date(evt.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`  ${i + 1}. "${evt.title}" | Days: ${days} | Start: ${start.toLocaleString()} | End: ${end.toLocaleString()}`);
    });

    return filteredEvents.map((event) => {
      const calendar = allCalendars.find((c) => c.id === event.calendarId);
      
      const eventStart = new Date(event.startDate);
      const eventEnd = new Date(event.endDate);
      const duration = eventEnd.getTime() - eventStart.getTime();
      const isExactly24h = Math.abs(duration - 24 * 60 * 60 * 1000) < 60000;
      const startsAtMidnight = eventStart.getHours() === 0 && eventStart.getMinutes() === 0;
      const startsEarlyMorning = eventStart.getHours() <= 3 && eventStart.getMinutes() === 0;
      
      // Multi-day detection
      const eventDurationDays = duration / (1000 * 60 * 60 * 24);
      const isMultiDay = eventDurationDays > 1;
      
      // Determine if this should be treated as "all-day" for THIS specific day
      let treatAsAllDay = event.allDay || 
                          (isExactly24h && startsAtMidnight) ||
                          (isExactly24h && startsEarlyMorning);
      
      // For multi-day events, treat as all-day if this day is in the MIDDLE
      // (not the start day or end day, but a day in between)
      if (isMultiDay) {
        const targetDayStart = targetDay.getTime();
        const targetDayEndTime = targetDayEnd.getTime();
        const isStartDay = eventStart.getTime() >= targetDayStart && eventStart.getTime() <= targetDayEndTime;
        const isEndDay = eventEnd.getTime() >= targetDayStart && eventEnd.getTime() <= targetDayEndTime;
        
        if (!isStartDay && !isEndDay) {
          // This is a middle day of a multi-day event = all day
          treatAsAllDay = true;
        }
      }
      
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

    const rangeStart = new Date(startDateStr + 'T00:00:00');
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDateStr + 'T23:59:59');
    rangeEnd.setHours(23, 59, 59, 999);
    
    // Expand query to catch multi-day events
    const queryStart = new Date(rangeStart.getTime() - 30 * 24 * 60 * 60 * 1000);
    const queryEnd = new Date(rangeEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

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

    // Filter to events that overlap with the range
    const filteredEvents = events.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      const rStart = rangeStart.getTime();
      const rEnd = rangeEnd.getTime();
      
      return eventEnd >= rStart && eventStart <= rEnd;
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
      return '⚠️ NO CALENDARS FOUND';
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setHours(23, 59, 59, 999);
    
    // Search wider for diagnostic
    const queryStart = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const queryEnd = new Date(endDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    const calendarIds = calendars.map(c => c.id);
    const allEvents = await Calendar.getEventsAsync(
      calendarIds,
      queryStart,
      queryEnd
    );

    // Filter today's events (including multi-day)
    const todayEvents = allEvents.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      return eventEnd >= startDate.getTime() && eventStart <= endDate.getTime();
    });

    // Filter tomorrow's events
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStart = new Date(tomorrow);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    
    const tomorrowEvents = allEvents.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      return eventEnd >= tomorrowStart.getTime() && eventStart <= tomorrowEnd.getTime();
    });

    // Find multi-day events
    const multiDayEvents = allEvents.filter((event) => {
      const eventStart = new Date(event.startDate).getTime();
      const eventEnd = new Date(event.endDate).getTime();
      const days = (eventEnd - eventStart) / (1000 * 60 * 60 * 24);
      return days > 1;
    });

    let report = `📅 ${calendars.length} calendars\n`;
    report += `Today: ${todayEvents.length} events\n`;
    report += `Tomorrow: ${tomorrowEvents.length} events\n`;
    report += `Multi-day events (±30 days): ${multiDayEvents.length}\n\n`;
    
    report += `═══ CALENDARS ═══\n\n`;
    
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
        const end = new Date(evt.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        report += `${i + 1}. "${evt.title}"\n`;
        report += `   📅 ${cal?.title}\n`;
        if (days > 1) {
          report += `   📆 Multi-day (${days} days)\n`;
        } else {
          report += `   ⏰ ${evt.allDay ? 'All-day' : start.toLocaleTimeString()}\n`;
        }
        report += `\n`;
      });
    }

    if (multiDayEvents.length > 0) {
      report += `\n═══ MULTI-DAY EVENTS ═══\n\n`;
      multiDayEvents.slice(0, 10).forEach((evt, i) => {
        const cal = calendars.find(c => c.id === evt.calendarId);
        const start = new Date(evt.startDate);
        const end = new Date(evt.endDate);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        report += `${i + 1}. "${evt.title}"\n`;
        report += `   📅 ${cal?.title}\n`;
        report += `   📆 ${days} days\n`;
        report += `   ▶️ ${start.toLocaleDateString()}\n`;
        report += `   ⏹️ ${end.toLocaleDateString()}\n\n`;
      });
    }

    return report;
  } catch (error: any) {
    return '❌ Error: ' + String(error.message || error);
  }
};
