// FILE: digital-planner/src/screens/MonthlyViewScreen.tsx

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
import { COLORS, MONTHS, DAYS_SHORT } from '../utils/constants';
import { getMonthWeeks, formatDate } from '../utils/dateUtils';
import CalendarHeader from '../components/CalendarHeader';
import WeekRow from '../components/WeekRow';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MonthlyView'>;
  route: RouteProp<RootStackParamList, 'MonthlyView'>;
};

export default function MonthlyViewScreen({ navigation, route }: Props) {
  const { year, month } = route.params;
  const monthName = MONTHS[month];
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month]);

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  return (
    <SafeAreaView style={styles.safe}>
      <CalendarHeader
        onHomePress={() => navigation.navigate('Home')}
        year={year}
        onYearPress={() => navigation.navigate('YearlyView', { year })}
        monthName={monthName}
        title={monthName}
      />

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Month nav */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('MonthlyView', {
                year: prevYear,
                month: prevMonth,
              })
            }
          >
            <Text style={styles.navText}>← {MONTHS[prevMonth]}</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>
            {monthName} {year}
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.replace('MonthlyView', {
                year: nextYear,
                month: nextMonth,
              })
            }
          >
            <Text style={styles.navText}>{MONTHS[nextMonth]} →</Text>
          </TouchableOpacity>
        </View>

        {/* Calendar grid */}
        <View style={styles.grid}>
          {/* Headers */}
          <View style={styles.headerRow}>
            <View style={styles.wkHeader}>
              <Text style={styles.headerText}>Wk</Text>
            </View>
            {DAYS_SHORT.map((d) => (
              <View key={d} style={styles.dayHeader}>
                <Text style={styles.headerText}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Weeks */}
          {weeks.map((week) => (
            <WeekRow
              key={`${month}-w${week.weekNumber}`}
              weekNumber={week.weekNumber}
              days={week.days}
              onWeekPress={(wn, startDate) =>
                navigation.navigate('WeeklyView', {
                  year,
                  weekNumber: wn,
                  startDate: startDate || formatDate(week.startDate),
                })
              }
              onDayPress={(dateString) =>
                navigation.navigate('DailyView', { date: dateString })
              }
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 12, paddingBottom: 40 },

  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navText: { color: COLORS.accent, fontSize: 13, fontWeight: '600' },
  monthTitle: { fontSize: 22, fontWeight: '800', color: COLORS.text },

  grid: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.secondary,
    paddingVertical: 10,
  },
  wkHeader: { width: 36, alignItems: 'center' },
  dayHeader: { flex: 1, alignItems: 'center' },
  headerText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});