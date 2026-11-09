import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEKDAYS_SHORT = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];

const padTwoDigits = (num) => String(num).padStart(2, '0');

export const parseIsoDateParts = (isoStr) => {
  const parts = String(isoStr || '2026-11-01').split('-');
  const year = Number(parts[0]) || 2026;
  const month = Math.min(12, Math.max(1, Number(parts[1]) || 11));
  const day = Math.min(31, Math.max(1, Number(parts[2]) || 1));
  return { year, month, day };
};

export const buildIsoDate = (year, month, day) =>
  `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}`;

export const formatIsoToDisplay = (isoStr) => {
  const { year, month, day } = parseIsoDateParts(isoStr);
  return `${padTwoDigits(day)}/${padTwoDigits(month)}/${year}`;
};

const buildCalendarWeeks = (year, month) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOffset = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const flatCells = [];

  for (let i = 0; i < firstDayOffset; i += 1) {
    flatCells.push({ key: `empty-start-${i}`, day: null, isoDate: null });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const isoDate = buildIsoDate(year, month, day);
    flatCells.push({ key: isoDate, day, isoDate });
  }

  while (flatCells.length % 7 !== 0) {
    flatCells.push({
      key: `empty-end-${flatCells.length}`,
      day: null,
      isoDate: null,
    });
  }

  const weeks = [];
  for (let idx = 0; idx < flatCells.length; idx += 7) {
    weeks.push(flatCells.slice(idx, idx + 7));
  }
  return weeks;
};

const resolveDefaultHint = (mode, activeField, hintText) => {
  if (hintText) return hintText;
  if (mode === 'range') {
    return activeField === 'from'
      ? 'Seleccione la fecha Desde'
      : 'Seleccione la fecha Hasta';
  }
  return 'Seleccione la fecha en el calendario';
};

const resolveTargetIsoDate = (mode, activeField, draftFrom, draftTo, selectedDate) => {
  if (mode === 'range') {
    return activeField === 'from' ? draftFrom : draftTo;
  }
  return selectedDate;
};

const InlineCalendarPicker = ({
  mode = 'single',
  selectedDate,
  activeField = 'from',
  draftFrom,
  draftTo,
  hintText,
  onSelectDate,
}) => {
  const targetIso = resolveTargetIsoDate(
    mode,
    activeField,
    draftFrom,
    draftTo,
    selectedDate
  );
  const initialParts = parseIsoDateParts(targetIso);
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const resolvedHint = resolveDefaultHint(mode, activeField, hintText);

  return (
    <View style={styles.calendarCard}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.calendarNavBtn}
          onPress={handlePrevMonth}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={16} color={COLORS.primary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={styles.calendarMonthTitle}>
            {MONTH_NAMES_ES[viewMonth - 1]} {viewYear}
          </Text>
          <Text style={styles.calendarEditingHint}>{resolvedHint}</Text>
        </View>

        <TouchableOpacity
          style={styles.calendarNavBtn}
          onPress={handleNextMonth}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.calendarWeekdaysRow}>
        {WEEKDAYS_SHORT.map((dayName) => (
          <Text key={dayName} style={styles.calendarWeekdayText}>
            {dayName}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {weeks.map((week, wIdx) => (
          <View key={`week-${wIdx}`} style={styles.calendarWeekRow}>
            {week.map((cell) => {
              if (!cell.day) {
                return <View key={cell.key} style={styles.calendarDayCell} />;
              }

              const isEndpoint =
                mode === 'range'
                  ? cell.isoDate === draftFrom || cell.isoDate === draftTo
                  : cell.isoDate === selectedDate;
              const isInRange =
                mode === 'range' &&
                cell.isoDate > draftFrom &&
                cell.isoDate < draftTo;

              return (
                <TouchableOpacity
                  key={cell.key}
                  style={[
                    styles.calendarDayCell,
                    isInRange && styles.calendarDayCellInRange,
                    isEndpoint && styles.calendarDayCellEndpoint,
                  ]}
                  onPress={() => onSelectDate(cell.isoDate)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.calendarDayText,
                      isInRange && styles.calendarDayTextInRange,
                      isEndpoint && styles.calendarDayTextEndpoint,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  calendarCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNavBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  calendarEditingHint: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.emerald,
    marginTop: 1,
  },
  calendarWeekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  calendarWeekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
  },
  calendarGrid: {
    gap: 4,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calendarDayCell: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 1,
  },
  calendarDayCellInRange: {
    backgroundColor: COLORS.emeraldSoft,
  },
  calendarDayCellEndpoint: {
    backgroundColor: COLORS.emerald,
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  calendarDayTextInRange: {
    color: '#065F46',
    fontWeight: '800',
  },
  calendarDayTextEndpoint: {
    color: COLORS.white,
    fontWeight: '900',
  },
});

export default InlineCalendarPicker;
