import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const HeaderBurgerMenuModal = ({
  visible,
  user,
  isStudentRole = false,
  onClose,
  onOpenProfile,
  onOpenChangePassword,
  onLogout,
}) => {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.menuCard} onPress={() => {}}>
          <View style={styles.userSection}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
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
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => {
              onClose?.();
              onOpenProfile?.();
            }}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: COLORS.indigoSoft }]}>
              <Ionicons name="person-circle-outline" size={19} color={COLORS.indigo} />
            </View>
            <View style={{ flex: 1 }}>
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
            onPress={() => {
              onClose?.();
              onOpenChangePassword?.();
            }}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: COLORS.accentSoft }]}>
              <Ionicons name="key-outline" size={18} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuItemTitle}>Cambiar Contraseña</Text>
              <Text style={styles.menuItemSub}>
                Actualizar clave de acceso verificando la actual
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={[styles.menuItem, styles.logoutItem]}
            onPress={() => {
              onClose?.();
              onLogout?.();
            }}
          >
            <View style={[styles.menuIconWrap, { backgroundColor: COLORS.roseSoft }]}>
              <Ionicons name="log-out-outline" size={18} color={COLORS.rose} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuItemTitle, { color: COLORS.rose }]}>
                Cerrar Sesión
              </Text>
              <Text style={styles.menuItemSub}>
                Salir de su cuenta en este dispositivo
              </Text>
            </View>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 62,
    paddingHorizontal: 14,
  },
  menuCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 6,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  userSub: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  logoutItem: {
    marginTop: 2,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default HeaderBurgerMenuModal;
