import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Animated,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.84, 330);

const buildStudentOptions = (students = [], showAllOption = false) => {
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
    });
  });

  return options;
};

const DrawerStudentDropdown = ({
  students = [],
  selectedStudentId,
  onSelectStudent,
  showAllOption = false,
  onAfterSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!Array.isArray(students) || students.length === 0) {
    return null;
  }

  const options = buildStudentOptions(students, showAllOption);
  const hasMultiple = options.length > 1;
  const activeOption =
    options.find((opt) => String(opt.id) === String(selectedStudentId)) || options[0];

  const handleChoose = (id) => {
    onSelectStudent?.(id);
    setIsOpen(false);
    onAfterSelect?.();
  };

  return (
    <View style={styles.studentSection}>
      <View style={styles.sectionLabelRow}>
        <Ionicons name="people-outline" size={14} color={COLORS.accent} />
        <Text style={styles.sectionLabelText}>
          {students.length > 1
            ? `ALUMNO EN GESTIÓN (${students.length})`
            : 'ALUMNO EN GESTIÓN'}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          isOpen && styles.dropdownTriggerOpen,
        ]}
        onPress={() => hasMultiple && setIsOpen((prev) => !prev)}
        activeOpacity={hasMultiple ? 0.75 : 1}
      >
        <View style={styles.triggerLeft}>
          <View
            style={[
              styles.studentAvatar,
              activeOption?.isAll ? styles.studentAvatarAll : styles.studentAvatarSingle,
            ]}
          >
            {activeOption?.isAll ? (
              <Ionicons name="layers-outline" size={17} color={COLORS.accent} />
            ) : (
              <Text style={styles.studentAvatarText}>{activeOption?.initials}</Text>
            )}
          </View>
          <View style={styles.triggerTextCol}>
            <Text style={styles.triggerName} numberOfLines={1}>
              {activeOption?.name}
            </Text>
            <Text style={styles.triggerMeta} numberOfLines={1}>
              {activeOption?.meta}
            </Text>
          </View>
        </View>

        {hasMultiple && (
          <View style={styles.chevronWrap}>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={COLORS.textSecondary}
            />
          </View>
        )}
      </TouchableOpacity>

      {isOpen && hasMultiple && (
        <View style={styles.dropdownList}>
          {options.map((opt, idx) => {
            const isSelected = String(opt.id) === String(activeOption?.id);
            const isLast = idx === options.length - 1;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.dropdownOption,
                  isSelected && styles.dropdownOptionSelected,
                  isLast && styles.dropdownOptionLast,
                ]}
                onPress={() => handleChoose(opt.id)}
                activeOpacity={0.7}
              >
                <View style={styles.optionLeft}>
                  <View
                    style={[
                      styles.optionAvatar,
                      opt.isAll ? styles.studentAvatarAll : styles.studentAvatarSingle,
                      isSelected && styles.optionAvatarSelected,
                    ]}
                  >
                    {opt.isAll ? (
                      <Ionicons
                        name="layers-outline"
                        size={14}
                        color={isSelected ? COLORS.white : COLORS.accent}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.optionAvatarText,
                          isSelected && styles.optionAvatarTextSelected,
                        ]}
                      >
                        {opt.initials}
                      </Text>
                    )}
                  </View>
                  <View style={styles.triggerTextCol}>
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
                  <Ionicons name="checkmark-circle" size={19} color={COLORS.accent} />
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

const HeaderBurgerMenuModal = ({
  visible,
  user,
  isStudentRole = false,
  students = [],
  selectedStudentId,
  onSelectStudent,
  showAllOption = false,
  onClose,
  onOpenProfile,
  onOpenChangePassword,
  onLogout,
}) => {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(-DRAWER_WIDTH));
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-DRAWER_WIDTH);
      fadeAnim.setValue(0);
    }
  }, [visible, slideAnim, fadeAnim]);

  const handleAnimatedClose = (callback) => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 190,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose?.();
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  const fullName =
    user?.nombreCompleto ||
    `${user?.nombre || ''} ${user?.apellido || ''}`.trim() ||
    user?.email ||
    'Usuario';
  const roleLabel = isStudentRole ? 'Estudiante' : 'Padre / Tutor';
  const subIdentifier = isStudentRole
    ? user?.legajo || user?.studentID_login || user?.email
    : user?.email;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => handleAnimatedClose()}
    >
      <View style={styles.modalRoot}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable style={styles.backdropPressable} onPress={() => handleAnimatedClose()} />
        </Animated.View>

        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              transform: [{ translateX: slideAnim }],
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          {/* Cabecera Institucional del Drawer */}
          <View
            style={[
              styles.drawerHeader,
              { paddingTop: Math.max(insets.top, 18) + 8 },
            ]}
          >
            <View style={styles.headerTopRow}>
              <View style={styles.brandBadge}>
                <Ionicons name="school" size={16} color={COLORS.accent} />
                <Text style={styles.brandBadgeText}>Educar para Transformar</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => handleAnimatedClose()}
                accessibilityLabel="Cerrar menú"
              >
                <Ionicons name="close" size={20} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <View style={styles.userRow}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={20} color={COLORS.accent} />
              </View>
              <View style={styles.userTextCol}>
                <Text style={styles.userName} numberOfLines={1}>
                  {fullName}
                </Text>
                <Text style={styles.userSub} numberOfLines={1}>
                  {subIdentifier}
                </Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{roleLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Contenido scrolleable del Drawer */}
          <ScrollView
            style={styles.drawerBody}
            contentContainerStyle={styles.drawerBodyContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Selector Dropdown de Alumno en Gestión (Solo Tutores) */}
            {!isStudentRole && students.length > 0 && (
              <>
                <DrawerStudentDropdown
                  students={students}
                  selectedStudentId={selectedStudentId}
                  onSelectStudent={onSelectStudent}
                  showAllOption={showAllOption}
                  onAfterSelect={() => handleAnimatedClose()}
                />
                <View style={styles.divider} />
              </>
            )}

            <View style={styles.sectionLabelRow}>
              <Ionicons name="settings-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.sectionLabelText}>MI CUENTA Y SEGURIDAD</Text>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAnimatedClose(onOpenProfile)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: COLORS.indigoSoft }]}>
                <Ionicons name="person-circle-outline" size={20} color={COLORS.indigo} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Mi Perfil</Text>
                <Text style={styles.menuItemSub}>
                  {isStudentRole
                    ? 'Consultar datos personales y legajo'
                    : 'Editar correo, dirección y teléfono'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleAnimatedClose(onOpenChangePassword)}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconWrap, { backgroundColor: COLORS.accentSoft }]}>
                <Ionicons name="key-outline" size={19} color={COLORS.accent} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.menuItemTitle}>Cambiar Contraseña</Text>
                <Text style={styles.menuItemSub}>
                  Actualizar clave verificando la actual
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          </ScrollView>

          {/* Pie del Drawer: Cerrar Sesión */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={() => handleAnimatedClose(onLogout)}
              activeOpacity={0.75}
            >
              <View style={styles.logoutIconWrap}>
                <Ionicons name="log-out-outline" size={19} color={COLORS.rose} />
              </View>
              <View style={styles.menuTextCol}>
                <Text style={styles.logoutTitle}>Cerrar Sesión</Text>
                <Text style={styles.logoutSub}>Salir de su cuenta en este dispositivo</Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  backdropPressable: {
    flex: 1,
  },
  drawerContainer: {
    height: '100%',
    backgroundColor: COLORS.surface,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 14,
  },
  drawerHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(234, 88, 12, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.4)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FDBA74',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(234, 88, 12, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(234, 88, 12, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTextCol: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  userSub: {
    fontSize: 11.5,
    color: '#94A3B8',
    marginTop: 1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E2E8F0',
  },
  drawerBody: {
    flex: 1,
  },
  drawerBodyContent: {
    padding: 16,
  },
  studentSection: {
    marginBottom: 4,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionLabelText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownTriggerOpen: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarSingle: {
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
  },
  studentAvatarAll: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  studentAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.accent,
  },
  triggerTextCol: {
    flex: 1,
  },
  triggerName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.text,
  },
  triggerMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  chevronWrap: {
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownList: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: COLORS.accent,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownOptionSelected: {
    backgroundColor: COLORS.accentSoft,
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  optionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionAvatarSelected: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  optionAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.accent,
  },
  optionAvatarTextSelected: {
    color: COLORS.white,
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
    fontSize: 10.5,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  unselectedRadio: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: COLORS.borderStrong,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 4,
  },
  menuIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextCol: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.text,
  },
  menuItemSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.surface,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.roseSoft,
    borderWidth: 1,
    borderColor: COLORS.roseBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  logoutIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.rose,
  },
  logoutSub: {
    fontSize: 10.5,
    color: '#9F1239',
    marginTop: 1,
  },
});

export default HeaderBurgerMenuModal;
