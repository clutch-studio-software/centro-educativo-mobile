import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const ChildSelectorBar = ({
  students = [],
  selectedStudentId,
  onSelectStudent,
  showAllOption = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!Array.isArray(students) || students.length === 0) {
    return null;
  }

  const hasMultiple = (showAllOption && students.length > 1) || students.length > 1;

  // Construir opciones disponibles
  const options = [];
  if (showAllOption && students.length > 1) {
    options.push({
      id: 'all',
      name: 'Grupo Familiar',
      meta: `${students.length} hijos consolidados`,
      isAll: true,
    });
  }

  students.forEach((st) => {
    const fullName =
      st.nombreCompleto || `${st.nombre || ''} ${st.apellido || ''}`.trim() || 'Alumno';
    const initials = fullName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

    options.push({
      id: st.id,
      name: fullName,
      meta: `${st.curso || 'Curso'} ${st.division || 'A'} · ${st.legajo || st.studentID_login || ''}`,
      initials: initials || 'AL',
      student: st,
    });
  });

  // Opción activa actual
  const activeOption =
    options.find((opt) => String(opt.id) === String(selectedStudentId)) || options[0];

  const handleSelect = (id) => {
    onSelectStudent(id);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Ionicons name="people-outline" size={14} color={COLORS.accent} />
          <Text style={styles.labelText}>
            {hasMultiple
              ? `ALUMNO EN GESTIÓN (${students.length} HIJOS VINCULADOS)`
              : 'ALUMNO VINCULADO'}
          </Text>
        </View>
      </View>

      {/* Botón Principal del Dropdown */}
      <TouchableOpacity
        style={[
          styles.selectorTrigger,
          isOpen && styles.selectorTriggerOpen,
          !hasMultiple && styles.selectorTriggerStatic,
        ]}
        onPress={() => hasMultiple && setIsOpen(!isOpen)}
        activeOpacity={hasMultiple ? 0.75 : 1}
      >
        <View style={styles.triggerLeft}>
          <View
            style={[
              styles.avatar,
              activeOption?.isAll ? styles.avatarAll : styles.avatarStudent,
            ]}
          >
            {activeOption?.isAll ? (
              <Ionicons name="layers-outline" size={17} color={COLORS.accent} />
            ) : (
              <Text style={styles.avatarText}>{activeOption?.initials}</Text>
            )}
          </View>
          <View style={styles.triggerInfo}>
            <Text style={styles.triggerName} numberOfLines={1}>
              {activeOption?.name}
            </Text>
            <Text style={styles.triggerMeta} numberOfLines={1}>
              {activeOption?.meta}
            </Text>
          </View>
        </View>

        {hasMultiple && (
          <View style={styles.chevronBox}>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.textSecondary}
            />
          </View>
        )}
      </TouchableOpacity>

      {/* Menú Desplegable con las opciones */}
      {isOpen && hasMultiple && (
        <View style={styles.dropdownMenu}>
          {options.map((opt, index) => {
            const isSelected = String(opt.id) === String(activeOption?.id);
            const isLast = index === options.length - 1;

            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionItem,
                  isSelected && styles.optionItemSelected,
                  isLast && styles.optionItemLast,
                ]}
                onPress={() => handleSelect(opt.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.avatarSmall,
                      opt.isAll ? styles.avatarAll : styles.avatarStudent,
                      isSelected && styles.avatarSmallSelected,
                    ]}
                  >
                    {opt.isAll ? (
                      <Ionicons
                        name="layers-outline"
                        size={15}
                        color={isSelected ? COLORS.white : COLORS.accent}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.avatarSmallText,
                          isSelected && styles.avatarSmallTextSelected,
                        ]}
                      >
                        {opt.initials}
                      </Text>
                    )}
                  </View>
                  <View style={styles.optionTextCol}>
                    <Text
                      style={[
                        styles.optionName,
                        isSelected && styles.optionNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {opt.name}
                    </Text>
                    <Text style={styles.optionMeta} numberOfLines={1}>
                      {opt.meta}
                    </Text>
                  </View>
                </View>

                {isSelected ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={COLORS.accent}
                  />
                ) : (
                  <View style={styles.unselectedRadio} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  labelText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  helperText: {
    fontSize: 11,
    color: COLORS.accent,
    fontWeight: '600',
  },
  selectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  selectorTriggerOpen: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  selectorTriggerStatic: {
    backgroundColor: COLORS.surfaceAlt,
    borderColor: COLORS.border,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStudent: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  avatarAll: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
  },
  triggerInfo: {
    flex: 1,
  },
  triggerName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  triggerMeta: {
    fontSize: 11.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  chevronBox: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownMenu: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.accent,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optionItemSelected: {
    backgroundColor: COLORS.accentSoft,
  },
  optionItemLast: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  avatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSmallSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  avatarSmallText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accent,
  },
  avatarSmallTextSelected: {
    color: COLORS.white,
  },
  optionTextCol: {
    flex: 1,
  },
  optionName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  optionNameSelected: {
    color: '#9A3412',
    fontWeight: '800',
  },
  optionMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  unselectedRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
  },
});

export default ChildSelectorBar;
