// FILE: digital-planner/src/screens/HomeScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, getISOWeek, startOfWeek } from 'date-fns';
import { RootStackParamList } from '../types';
import { COLORS, MONTHS_SHORT } from '../utils/constants';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Home'>;
};

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }: Props) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const today = new Date();
  const year = today.getFullYear();
  const dateString = format(today, 'yyyy-MM-dd');
  const weekNumber = getISOWeek(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStartString = format(weekStart, 'yyyy-MM-dd');

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HEADER ── */}
        <View style={styles.header}>
          <Text style={styles.appTitle}>📓 Digital Planner</Text>
          <Text style={styles.timeText}>
            {format(currentTime, 'HH:mm')}
          </Text>
          <Text style={styles.dayNameText}>
            {format(today, 'EEEE')}
          </Text>
          <Text style={styles.fullDateText}>
            {format(today, 'MMMM d, yyyy')}
          </Text>
        </View>

        {/* ── TODAY CARD ── */}
        <TouchableOpacity
          style={styles.todayCard}
          onPress={() => navigation.navigate('DailyView', { date: dateString })}
          activeOpacity={0.85}
        >
          <View style={styles.todayLeft}>
            <Text style={styles.todayIcon}>📅</Text>
            <View>
              <Text style={styles.todayTitle}>Today's Schedule</Text>
              <Text style={styles.todaySubtitle}>
                Tap to view, write & plan
              </Text>
            </View>
          </View>
          <Text style={styles.arrowText}>→</Text>
        </TouchableOpacity>

        {/* ── MAIN GRID ── */}
        <View style={styles.grid}>

          {/* Yearly */}
          <TouchableOpacity
            style={[styles.card, styles.cardYear]}
            onPress={() => navigation.navigate('YearlyView', { year })}
            activeOpacity={0.85}
          >
            <Text style={styles.cardIcon}>📆</Text>
            <Text style={styles.cardYear}>{year}</Text>
            <Text style={styles.cardTitle}>Yearly View</Text>
            <Text style={styles.cardSub}>
              All months, weeks & dates
            </Text>
          </TouchableOpacity>

          {/* Monthly + Weekly */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.card, styles.cardHalf, styles.cardMonth]}
              onPress={() =>
                navigation.navigate('MonthlyView', {
                  year,
                  month: today.getMonth(),
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>🗓️</Text>
              <Text style={styles.cardTitle}>
                {format(today, 'MMMM')}
              </Text>
              <Text style={styles.cardSub}>Monthly View</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardHalf, styles.cardWeek]}
              onPress={() =>
                navigation.navigate('WeeklyView', {
                  year,
                  weekNumber,
                  startDate: weekStartString,
                })
              }
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>📋</Text>
              <Text style={styles.cardTitle}>Week {weekNumber}</Text>
              <Text style={styles.cardSub}>Weekly View</Text>
            </TouchableOpacity>
          </View>

          {/* Todo + Notes */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.card, styles.cardHalf, styles.cardTodo]}
              onPress={() => navigation.navigate('TodoList')}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>✅</Text>
              <Text style={styles.cardTitle}>To-Do Lists</Text>
              <Text style={styles.cardSub}>Tasks & Reminders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardHalf, styles.cardNotes]}
              onPress={() => navigation.navigate('NotesJournal')}
              activeOpacity={0.85}
            >
              <Text style={styles.cardIcon}>📝</Text>
              <Text style={styles.cardTitle}>Notes</Text>
              <Text style={styles.cardSub}>Notes & Journal</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── QUICK MONTHS ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Month Access</Text>
          <View style={styles.monthGrid}>
            {MONTHS_SHORT.map((m, i) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.monthChip,
                  i === today.getMonth() && styles.monthChipActive,
                ]}
                onPress={() =>
                  navigation.navigate('MonthlyView', { year, month: i })
                }
              >
                <Text
                  style={[
                    styles.monthChipText,
                    i === today.getMonth() && styles.monthChipTextActive,
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 24, paddingTop: 8 },
  appTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 12,
  },
  timeText: {
    fontSize: 52,
    fontWeight: '200',
    color: COLORS.text,
    letterSpacing: 3,
  },
  dayNameText: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.highlight,
    marginTop: 4,
  },
  fullDateText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  todayCard: {
    backgroundColor: COLORS.todayBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: COLORS.highlight,
  },
  todayLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  todayIcon: { fontSize: 32, marginRight: 14 },
  todayTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  todaySubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  arrowText: { fontSize: 22, color: COLORS.highlight, fontWeight: '700' },

  grid: { marginBottom: 24, gap: 12 },
  row: { flexDirection: 'row', gap: 12 },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardHalf: { flex: 1 },
  cardYear: { borderLeftWidth: 4, borderLeftColor: COLORS.accent },
  cardMonth: { borderLeftWidth: 4, borderLeftColor: '#4ecca3' },
  cardWeek: { borderLeftWidth: 4, borderLeftColor: '#ffc107' },
  cardTodo: { borderLeftWidth: 4, borderLeftColor: COLORS.highlight },
  cardNotes: { borderLeftWidth: 4, borderLeftColor: '#9b59b6' },

  cardIcon: { fontSize: 26, marginBottom: 6 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardSub: { fontSize: 12, color: COLORS.textSecondary },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    minWidth: (width - 80) / 4,
    alignItems: 'center',
  },
  monthChipActive: {
    backgroundColor: COLORS.highlight,
    borderColor: COLORS.highlight,
  },
  monthChipText: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  monthChipTextActive: { color: COLORS.white, fontWeight: '800' },
});