// FILE: digital-planner/src/components/DayCell.tsx

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

interface DayCellProps {
  day: number;
  dateString: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  onPress: (dateString: string) => void;
  hasEvents?: boolean;
  hasDrawings?: boolean;
}

export default function DayCell({
  day,
  dateString,
  isCurrentMonth,
  isToday,
  isWeekend,
  onPress,
  hasEvents,
  hasDrawings,
}: DayCellProps) {
  return (
    <TouchableOpacity
      style={[
        styles.cell,
        !isCurrentMonth && styles.otherMonth,
        isWeekend && !isToday && styles.weekend,
        isToday && styles.today,
      ]}
      onPress={() => onPress(dateString)}
      activeOpacity={0.6}
    >
      <Text
        style={[
          styles.dayNumber,
          !isCurrentMonth && styles.otherMonthText,
          isToday && styles.todayText,
        ]}
      >
        {day}
      </Text>
      <View style={styles.indicators}>
        {hasEvents && <View style={[styles.dot, styles.eventDot]} />}
        {hasDrawings && <View style={[styles.dot, styles.drawingDot]} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minHeight: 52,
    padding: 4,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
  },
  otherMonth: {
    backgroundColor: COLORS.background,
    opacity: 0.4,
  },
  today: {
    backgroundColor: COLORS.todayBg,
    borderColor: COLORS.highlight,
    borderWidth: 1.5,
  },
  weekend: {
    backgroundColor: COLORS.weekendBg,
  },
  dayNumber: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  otherMonthText: {
    color: COLORS.textSecondary,
  },
  todayText: {
    color: COLORS.highlight,
    fontWeight: '800',
    fontSize: 14,
  },
  indicators: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  eventDot: {
    backgroundColor: COLORS.highlight,
  },
  drawingDot: {
    backgroundColor: COLORS.accent,
  },
});