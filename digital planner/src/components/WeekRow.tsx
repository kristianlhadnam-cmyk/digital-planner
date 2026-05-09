// FILE: digital-planner/src/components/WeekRow.tsx

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';
import DayCell from './DayCell';

interface DayInfo {
  date: Date;
  dateString: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

interface WeekRowProps {
  weekNumber: number;
  days: DayInfo[];
  onWeekPress: (weekNumber: number, startDate: string) => void;
  onDayPress: (dateString: string) => void;
}

export default function WeekRow({
  weekNumber,
  days,
  onWeekPress,
  onDayPress,
}: WeekRowProps) {
  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={styles.weekCell}
        onPress={() => onWeekPress(weekNumber, days[0]?.dateString)}
        hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      >
        <Text style={styles.weekText}>{weekNumber}</Text>
      </TouchableOpacity>
      {days.map((day, index) => (
        <DayCell
          key={`${day.dateString}-${index}`}
          day={day.dayOfMonth}
          dateString={day.dateString}
          isCurrentMonth={day.isCurrentMonth}
          isToday={day.isToday}
          isWeekend={day.isWeekend}
          onPress={onDayPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  weekCell: {
    width: 36,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.secondary,
    borderWidth: 0.5,
    borderColor: COLORS.cardBorder,
    minHeight: 52,
  },
  weekText: {
    color: COLORS.highlight,
    fontSize: 11,
    fontWeight: '800',
  },
});