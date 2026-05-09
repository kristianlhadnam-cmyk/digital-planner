// FILE: digital-planner/src/screens/YearlyViewScreen.tsx

import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { COLORS, DAYS_SHORT } from '../utils/constants';
import { getYearData, formatDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'YearlyView'>;
  route: RouteProp<RootStackParamList, 'YearlyView'>;
};

export default function YearlyViewScreen({ navigation, route }: Props) {
  const { year } = route.params;
  const yearData = useMemo(() => getYearData(year), [year]);

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={year}
        title={`${year} — Year Overview`}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Year nav */}
        <View style={styles.yearNav}>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('YearlyView', { year: year - 1 })
            }
          >
            <Text style={styles.yearNavText}>← {year - 1}</Text>
          </TouchableOpacity>
          <Text style={styles.yearLabel}>{year}</Text>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('YearlyView', { year: year + 1 })
            }
          >
            <Text style={styles.yearNavText}>{year + 1} →</Text>
          </TouchableOpacity>
        </View>

        {/* Months */}
        {yearData.months.map((monthData) => (
          <View key={monthData.month} style={styles.monthBlock}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('MonthlyView', {
                  year,
                  month: monthData.month,
                })
              }
            >
              <Text style={styles.monthName}>{monthData.name}</Text>
            </TouchableOpacity>

            {/* Day headers */}
            <View style={styles.headerRow}>
              <View style={styles.wkHeaderCell}>
                <Text style={styles.headerText}>Wk</Text>
              </View>
              {DAYS_SHORT.map((d) => (
                <View key={d} style={styles.dayHeaderCell}>
                  <Text style={styles.headerText}>{d}</Text>
                </View>
              ))}
            </View>

            {/* Week rows */}
            {monthData.weeks.map((week) => (
              <View
                key={`${monthData.month}-w${week.weekNumber}`}
                style={styles.weekRow}
              >
                <TouchableOpacity
                  style={styles.wkCell}
                  onPress={() =>
                    navigation.navigate('WeeklyView', {
                      year,
                      weekNumber: week.weekNumber,
                      startDate: formatDate(week.startDate),
                    })
                  }
                >
                  <Text style={styles.wkText}>{week.weekNumber}</Text>
                </TouchableOpacity>

                {week.days.map((day, idx) => (
                  <TouchableOpacity
                    key={`${day.dateString}-${idx}`}
                    style={[
                      styles.dayCell,
                      !day.isCurrentMonth && styles.otherMonth,
                      day.isToday && styles.todayCell,
                      day.isWeekend && !day.isToday && styles.weekendCell,
                    ]}
                    onPress={() =>
                      navigation.navigate('DailyView', {
                        date: day.dateString,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.dayText,
                        !day.isCurrentMonth && styles.otherMonthText,
                        day.isToday && styles.todayText,
                      ]}
                    >
                      {day.dayOfMonth}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 12, paddingBottom: 40 },

  yearNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  yearNavText: { color: COLORS.accent, fontSize: 16, fontWeight: '600' },
  yearLabel: { fontSize: 30, fontWeight: '800', color: COLORS.text },

  monthBlock: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  monthName: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.highlight,
    marginBottom: 10,
    textDecorationLine: 'underline',
  },

  headerRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  wkHeaderCell: {
    width: 32,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  headerText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },

  weekRow: { flexDirection: 'row' },

  wkCell: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 6,
  },
  wkText: { color: COLORS.highlight, fontSize: 10, fontWeight: '700' },

  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 4,
    margin: 1,
  },
  otherMonth: { opacity: 0.25 },
  todayCell: {
    backgroundColor: COLORS.todayBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.highlight,
  },
  weekendCell: { backgroundColor: COLORS.weekendBg },

  dayText: { color: COLORS.text, fontSize: 12, fontWeight: '500' },
  otherMonthText: { color: COLORS.textSecondary },
  todayText: { color: COLORS.highlight, fontWeight: '800' },
});