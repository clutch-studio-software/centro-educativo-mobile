import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const resolveCategoryVisuals = (category) => {
  switch (category) {
    case 'nursing':
      return {
        icon: 'medkit-outline',
        color: COLORS.rose,
        bg: COLORS.roseSoft,
        tag: 'Enfermería',
      };
    case 'preceptoria':
      return {
        icon: 'clipboard-outline',
        color: COLORS.amber,
        bg: COLORS.amberSoft,
        tag: 'Preceptoría',
      };
    case 'attendance':
      return {
        icon: 'calendar-outline',
        color: COLORS.indigo,
        bg: COLORS.indigoSoft,
        tag: 'Asistencia',
      };
    case 'justification_approved':
      return {
        icon: 'checkmark-done-circle-outline',
        color: COLORS.emerald,
        bg: COLORS.emeraldSoft,
        tag: 'Justificación Aprobada',
      };
    case 'justification_rejected':
      return {
        icon: 'alert-circle-outline',
        color: COLORS.rose,
        bg: COLORS.roseSoft,
        tag: 'Justificación Observada',
      };
    case 'voucher_approved':
      return {
        icon: 'checkmark-circle-outline',
        color: COLORS.emerald,
        bg: COLORS.emeraldSoft,
        tag: 'Pago Conciliado',
      };
    case 'voucher_rejected':
      return {
        icon: 'warning-outline',
        color: COLORS.rose,
        bg: COLORS.roseSoft,
        tag: 'Comprobante Observado',
      };
    default:
      return {
        icon: 'notifications-outline',
        color: COLORS.primary,
        bg: COLORS.surfaceAlt,
        tag: 'Aviso Institucional',
      };
  }
};

const NotificationItemCard = ({ item, onPressItem }) => {
  const visuals = resolveCategoryVisuals(item.category);
  const isRead = Boolean(item.isRead || item.read);

  return (
    <TouchableOpacity
      style={[styles.notifCard, !isRead && styles.notifCardUnread]}
      onPress={() => onPressItem?.(item)}
      activeOpacity={0.78}
    >
      <View style={[styles.iconBox, { backgroundColor: visuals.bg }]}>
        <Ionicons name={visuals.icon} size={19} color={visuals.color} />
      </View>

      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.metaTopRow}>
          <View style={[styles.categoryTag, { backgroundColor: visuals.bg }]}>
            <Text style={[styles.categoryTagText, { color: visuals.color }]}>
              {visuals.tag}
            </Text>
          </View>
          <Text style={styles.dateText}>{item.dateLabel}</Text>
        </View>

        <Text style={[styles.notifTitle, !isRead && styles.notifTitleUnread]}>
          {item.title}
        </Text>
        <Text style={styles.notifBody}>{item.body}</Text>
      </View>

      {!isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
};

const NotificationsModal = ({
  visible,
  notifications = [],
  unreadCount = 0,
  onClose,
  onMarkAllAsRead,
  onSelectNotification,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellCircle}>
                <Ionicons name="notifications" size={19} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Centro de Notificaciones</Text>
                <Text style={styles.subtitle}>
                  {unreadCount > 0
                    ? `Tiene ${unreadCount} aviso(s) sin leer`
                    : 'Todos los avisos institucionales están al día'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {unreadCount > 0 && (
            <View style={styles.actionBar}>
              <TouchableOpacity
                style={styles.markAllBtn}
                onPress={onMarkAllAsRead}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={15}
                  color={COLORS.indigo}
                />
                <Text style={styles.markAllBtnText}>Marcar todas como leídas</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons
                  name="notifications-off-outline"
                  size={38}
                  color={COLORS.textMuted}
                />
                <Text style={styles.emptyTitle}>Sin notificaciones registradas</Text>
                <Text style={styles.emptySub}>
                  Aquí recibirá avisos inmediatos de asistencia, enfermería, preceptoría y estado de comprobantes.
                </Text>
              </View>
            ) : (
              notifications.map((item) => (
                <NotificationItemCard
                  key={item.id}
                  item={item}
                  onPressItem={onSelectNotification}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bellCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.indigoSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.indigo,
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    gap: 10,
    paddingBottom: 12,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 44,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    padding: 12,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  notifCardUnread: {
    backgroundColor: '#FFFBEB',
    borderColor: COLORS.accentBorder,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  metaTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  dateText: {
    fontSize: 10.5,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  notifTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  notifTitleUnread: {
    fontWeight: '800',
  },
  notifBody: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
    marginTop: 6,
  },
});

export default NotificationsModal;
