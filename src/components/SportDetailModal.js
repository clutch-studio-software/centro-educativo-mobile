import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, formatCurrencyARS } from '../theme/colors';
import {
  canCancelServiceToday,
  calculateMonthlyProportional,
  checkScheduleConflict,
  formatDateDisplay,
} from '../utils/subscriptionRules';
import { isStudentEnrolledInDiscipline } from '../services/servicesMobileService';
import { getSportMonthlyPrice } from '../services/billingMobileService';

const resolveSportIcon = (name = '') => {
  const n = String(name).toLowerCase();
  if (n.includes('fútbol') || n.includes('futbol')) return 'football-outline';
  if (n.includes('básquet') || n.includes('basquet')) return 'basketball-outline';
  if (n.includes('vóley') || n.includes('voley') || n.includes('voleibol')) return 'tennisball-outline';
  if (n.includes('natación') || n.includes('natacion')) return 'water-outline';
  if (n.includes('marcial') || n.includes('taekwondo') || n.includes('karate')) return 'shield-outline';
  if (n.includes('ajedrez')) return 'extension-puzzle-outline';
  if (n.includes('danza') || n.includes('baile')) return 'musical-notes-outline';
  if (n.includes('atletismo') || n.includes('running')) return 'fitness-outline';
  return 'trophy-outline';
};

const resolveCancellationPolicyHint = ({ isScheduledCancel, bajaProgramada, canCancelNow }) => {
  if (isScheduledCancel) {
    return `Baja programada para el ${formatDateDisplay(bajaProgramada)}`;
  }
  if (canCancelNow) {
    return 'Baja inmediata disponible hoy (mismo día de alta)';
  }
  return 'Baja diferida al 1º del próximo mes';
};

const resolveWithdrawButtonText = ({ isScheduledCancel, bajaProgramada, canCancelNow }) => {
  if (isScheduledCancel) {
    return `Baja ya solicitada (${formatDateDisplay(bajaProgramada)})`;
  }
  if (canCancelNow) {
    return 'Cancelar Inscripción Hoy (Inmediata)';
  }
  return 'Solicitar Baja para el Próximo Mes';
};

const resolveSportEnrollButtonText = ({ isFull, conflict, reachedMaxSports }) => {
  if (isFull) return 'Cupo Completo';
  if (conflict) return 'Bloqueado por Superposición Horaria';
  if (reachedMaxSports) return 'Máximo 2 Deportes Activos';
  return 'Inscribirme en esta disciplina';
};

const resolveOccupancy = (disc, student, isEnrolled) => {
  const inscriptos = Array.isArray(disc?.inscriptos) ? disc.inscriptos : [];
  const studentId = String(student?.id || '').trim();
  const inRoster =
    Boolean(studentId) &&
    inscriptos.some((ins) => String(ins?.id || ins?.studentId || '').trim() === studentId);
  const baseOccupied = Math.max(Number(disc?.cupoOcupado) || 0, inscriptos.length);
  return isEnrolled && !inRoster ? baseOccupied + 1 : baseOccupied;
};

const SportModalAlerts = ({ conflict, isEnrolled, reachedMaxSports }) => (
  <>
    {conflict && !isEnrolled && (
      <View style={styles.alertBoxConflict}>
        <Ionicons name="alert-circle" size={18} color={COLORS.rose} />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertConflictTitle}>Superposición de Horario</Text>
          <Text style={styles.alertConflictDesc}>
            {conflict.overlapLabel}. No es posible inscribirse debido a que colisiona con otra disciplina activa.
          </Text>
        </View>
      </View>
    )}

    {reachedMaxSports && (
      <View style={styles.alertBoxWarning}>
        <Ionicons name="information-circle" size={18} color={COLORS.amber} />
        <View style={{ flex: 1 }}>
          <Text style={styles.alertWarningTitle}>Límite de Deportes Alcanzado</Text>
          <Text style={styles.alertWarningDesc}>
            Cada estudiante puede tener un máximo de 2 disciplinas activas en simultáneo. Para inscribirse a esta debe dar de baja una previa.
          </Text>
        </View>
      </View>
    )}
  </>
);

const SportModalFooter = ({
  isStudentRole,
  isEnrolled,
  isScheduledCancel,
  isBusy,
  disabledEnroll,
  withdrawText,
  enrollText,
  onWithdraw,
  onEnroll,
  discipline,
}) => {
  if (isStudentRole) {
    return (
      <View style={styles.footerActionWrap}>
        <View style={styles.readOnlyNotice}>
          <Ionicons name="lock-closed-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.readOnlyNoticeText}>
            Solo el padre o tutor responsable puede gestionar altas y bajas de actividades extracurriculares.
          </Text>
        </View>
      </View>
    );
  }

  if (isEnrolled) {
    return (
      <View style={styles.footerActionWrap}>
        <TouchableOpacity
          style={[styles.btnWithdraw, isScheduledCancel && { opacity: 0.6 }]}
          onPress={() => onWithdraw(discipline)}
          disabled={isBusy || isScheduledCancel}
          activeOpacity={0.8}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={COLORS.rose} />
          ) : (
            <>
              <Ionicons name="close-circle-outline" size={18} color={COLORS.rose} />
              <Text style={styles.btnWithdrawText}>{withdrawText}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.footerActionWrap}>
      <TouchableOpacity
        style={[styles.btnEnroll, disabledEnroll && styles.btnEnrollDisabled]}
        onPress={() => onEnroll(discipline)}
        disabled={isBusy || disabledEnroll}
        activeOpacity={0.8}
      >
        {isBusy ? (
          <ActivityIndicator size="small" color={COLORS.white} />
        ) : (
          <>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
            <Text style={styles.btnEnrollText}>{enrollText}</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const SportDetailModal = ({
  visible,
  discipline,
  student,
  enrolledDisciplines = [],
  tariffsConfig,
  isStudentRole = false,
  isBusy = false,
  onClose,
  onEnroll,
  onWithdraw,
}) => {
  if (!discipline) return null;

  const isEnrolled = isStudentEnrolledInDiscipline(student, discipline);
  const subInfo = student?.deportesSuscripciones?.[discipline.id] || {};
  const startDate = subInfo.fechaInicio || student?.deporteFechaInicio;
  const canCancelNow = canCancelServiceToday(startDate);
  const isScheduledCancel = Boolean(subInfo.bajaSolicitada);

  const monthlyRate = getSportMonthlyPrice(discipline, tariffsConfig);
  const propInfo = calculateMonthlyProportional({
    startDate: isEnrolled ? startDate : new Date(),
    monthlyRate,
  });

  const conflict = !isEnrolled
    ? checkScheduleConflict(enrolledDisciplines, discipline)
    : null;
  const cupoMax = Number(discipline.cupoMax) || 25;
  const cupoOcupado = resolveOccupancy(discipline, student, isEnrolled);
  const isFull = cupoOcupado >= cupoMax && !isEnrolled;
  const reachedMaxSports = enrolledDisciplines.length >= 2 && !isEnrolled;

  const cancellationHint = resolveCancellationPolicyHint({
    isScheduledCancel,
    bajaProgramada: subInfo.bajaProgramada,
    canCancelNow,
  });

  const withdrawText = resolveWithdrawButtonText({
    isScheduledCancel,
    bajaProgramada: subInfo.bajaProgramada,
    canCancelNow,
  });

  const enrollText = resolveSportEnrollButtonText({
    isFull,
    conflict,
    reachedMaxSports,
  });

  const sportIconName = resolveSportIcon(discipline.nombre);
  const diasTexto = Array.isArray(discipline.dias)
    ? discipline.dias.join(', ')
    : String(discipline.dias || 'Días a confirmar');
  const profNombre = discipline.profesor?.nombre || 'Docente asignado';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          {/* Cabecera Principal */}
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name={sportIconName} size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={styles.disciplineTitle}>{discipline.nombre}</Text>
                {isEnrolled && (
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>INSCRIPTO</Text>
                  </View>
                )}
              </View>
              <Text style={styles.disciplineSub}>
                Disciplina extracurricular institucional
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Tarjeta de Arancel y Proporcional */}
          <View style={styles.pricingBanner}>
            <View>
              <Text style={styles.pricingLabel}>ARANCEL MENSUAL</Text>
              <Text style={styles.pricingValue}>
                {formatCurrencyARS(monthlyRate)}
                <Text style={styles.pricingPeriod}> / mes</Text>
              </Text>
            </View>
            <View style={styles.propCol}>
              <Text style={styles.propLabel}>1º MES PROPORCIONAL</Text>
              <Text style={styles.propValue}>{propInfo.formattedProportional}</Text>
            </View>
          </View>

          {/* Scroll con Información Detallada */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Días y Horarios */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.metaIcon}>
                  <Ionicons name="time-outline" size={18} color={COLORS.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaTitle}>Días y Horarios</Text>
                  <Text style={styles.metaDesc}>
                    {discipline.horario || 'A definir.'}
                  </Text>
                </View>
              </View>

              <View style={styles.innerDivider} />

              <View style={styles.infoRow}>
                <View style={styles.metaIcon}>
                  <Ionicons name="location-outline" size={18} color={COLORS.indigo} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaTitle}>Instalación / Lugar</Text>
                  <Text style={styles.metaDesc}>
                    {discipline.lugar || 'Campo de Deportes Escolar'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Docente y Nivel */}
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <View style={styles.metaIcon}>
                  <Ionicons name="person-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaTitle}>Profesor a Cargo</Text>
                  <Text style={styles.metaDesc}>{profNombre}</Text>
                </View>
              </View>

              <View style={styles.innerDivider} />

              <View style={styles.infoRow}>
                <View style={styles.metaIcon}>
                  <Ionicons name="school-outline" size={18} color={COLORS.emerald} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaTitle}>Niveles Educativos</Text>
                  <Text style={styles.metaDesc}>
                    {discipline.niveles || 'Todos los niveles habilitados'}
                  </Text>
                </View>
              </View>

              <View style={styles.innerDivider} />

              <View style={styles.infoRow}>
                <View style={styles.metaIcon}>
                  <Ionicons name="people-outline" size={18} color={COLORS.amber} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.metaTitle}>Disponibilidad de Plazas</Text>
                  <Text style={styles.metaDesc}>
                    {cupoOcupado} de {cupoMax} vacantes ocupadas
                  </Text>
                </View>
              </View>
            </View>

            {/* Alertas */}
            <SportModalAlerts
              conflict={conflict}
              isEnrolled={isEnrolled}
              reachedMaxSports={reachedMaxSports}
            />

            {/* Estado de Suscripción si está inscripto */}
            {isEnrolled && (
              <View style={styles.enrolledStatusCard}>
                <View style={styles.enrolledStatusRow}>
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.emerald} />
                  <Text style={styles.enrolledStatusTitle}>Estado de Inscripción</Text>
                </View>
                <Text style={styles.enrolledStatusDetail}>
                  Fecha de alta: {formatDateDisplay(startDate)}
                </Text>
                <Text style={styles.enrolledPolicyDetail}>
                  Normativa: {cancellationHint}
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Pie de Acción: Botón Inscribirse o Darse de baja */}
          <SportModalFooter
            isStudentRole={isStudentRole}
            isEnrolled={isEnrolled}
            isScheduledCancel={isScheduledCancel}
            isBusy={isBusy}
            disabledEnroll={Boolean(conflict) || isFull || reachedMaxSports}
            withdrawText={withdrawText}
            enrollText={enrollText}
            onWithdraw={onWithdraw}
            onEnroll={onEnroll}
            discipline={discipline}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    paddingTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  disciplineTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  activePill: {
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  disciplineSub: {
    fontSize: 11.5,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pricingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pricingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  pricingValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.emerald,
    marginTop: 1,
  },
  pricingPeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  propCol: {
    alignItems: 'flex-end',
  },
  propLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  propValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  scrollArea: {
    marginTop: 10,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metaIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  metaDesc: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 1,
  },
  innerDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 10,
  },
  alertBoxConflict: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderWidth: 1,
    borderColor: COLORS.roseBorder,
    borderRadius: 10,
    padding: 10,
  },
  alertConflictTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.rose,
  },
  alertConflictDesc: {
    fontSize: 11,
    color: COLORS.rose,
    marginTop: 2,
    lineHeight: 15,
  },
  alertBoxWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.amberSoft,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    borderRadius: 10,
    padding: 10,
  },
  alertWarningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.amber,
  },
  alertWarningDesc: {
    fontSize: 11,
    color: '#92400E',
    marginTop: 2,
    lineHeight: 15,
  },
  enrolledStatusCard: {
    backgroundColor: COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    borderRadius: 12,
    padding: 12,
    gap: 3,
  },
  enrolledStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  enrolledStatusTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#065F46',
  },
  enrolledStatusDetail: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
  },
  enrolledPolicyDetail: {
    fontSize: 11,
    color: '#047857',
    marginTop: 2,
  },
  footerActionWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  btnEnroll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  btnEnrollDisabled: {
    backgroundColor: COLORS.textMuted,
  },
  btnEnrollText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.white,
  },
  btnWithdraw: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderWidth: 1,
    borderColor: COLORS.roseBorder,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  btnWithdrawText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.rose,
  },
  readOnlyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.surfaceAlt,
    padding: 10,
    borderRadius: 10,
  },
  readOnlyNoticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 15,
  },
});

export default SportDetailModal;
