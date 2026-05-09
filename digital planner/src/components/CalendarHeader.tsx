// FILE: digital-planner/src/components/CalendarHeader.tsx

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../utils/constants';

interface CalendarHeaderProps {
  onHomePress: () => void;
  onYearPress?: () => void;
  onMonthPress?: () => void;
  onWeekPress?: () => void;
  year?: number;
  monthName?: string;
  weekNumber?: number;
  title?: string;
}

export default function CalendarHeader({
  onHomePress,
  onYearPress,
  onMonthPress,
  onWeekPress,
  year,
  monthName,
  weekNumber,
  title,
}: CalendarHeaderProps) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.homeButton}
        onPress={onHomePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.homeIcon}>🏠</Text>
      </TouchableOpacity>

      <View style={styles.breadcrumbs}>
        {year && (
          <TouchableOpacity
            onPress={onYearPress}
            disabled={!onYearPress}
            hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
          >
            <Text
              style={[
                styles.breadcrumbText,
                onYearPress && styles.breadcrumbLink,
              ]}
            >
              {year}
            </Text>
          </TouchableOpacity>
        )}

        {monthName && (
          <>
            <Text style={styles.separator}>›</Text>
            <TouchableOpacity
              onPress={onMonthPress}
              disabled={!onMonthPress}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
              <Text
                style={[
                  styles.breadcrumbText,
                  onMonthPress && styles.breadcrumbLink,
                ]}
              >
                {monthName}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {weekNumber && (
          <>
            <Text style={styles.separator}>›</Text>
            <TouchableOpacity
              onPress={onWeekPress}
              disabled={!onWeekPress}
              hitSlop={{ top: 10, bottom: 10, left: 5, right: 5 }}
            >
              <Text
                style={[
                  styles.breadcrumbText,
                  onWeekPress && styles.breadcrumbLink,
                ]}
              >
                W{weekNumber}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {title && (
          <>
            {(year || monthName || weekNumber) && (
              <Text style={styles.separator}>›</Text>
            )}
            <Text style={styles.titleText} numberOfLines={1}>
              {title}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? 12 : 12,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    minHeight: 56,
  },
  homeButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: COLORS.secondary,
    borderRadius: 10,
  },
  homeIcon: {
    fontSize: 20,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
  },
  breadcrumbText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  breadcrumbLink: {
    color: COLORS.text,
    textDecorationLine: 'underline',
  },
  titleText: {
    color: COLORS.highlight,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  separator: {
    color: COLORS.textSecondary,
    marginHorizontal: 6,
    fontSize: 16,
  },
});