import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, formatCurrencyARS } from '../theme/colors';
import {
  TRANSPORT_ROUTES,
  SPRINTER_STANDARD_CAPACITY,
  canCancelServiceToday,
  calculateMonthlyProportional,
  getTransportRouteOccupancy,
  matchTransportRoute,
  formatDateDisplay,
} from '../utils/subscriptionRules';
import {
  enrollStudentInTransport,
  cancelStudentTransport,
  toggleStudentDining,
  updateStudentDiningObservations,
  enrollStudentInSport,
  withdrawStudentFromSport,
  isStudentEnrolledInDiscipline,
} from '../services/servicesMobileService';
import {
  resolveOfficialTariffs,
  getRouteMonthlyPrice,
  getSportMonthlyPrice,
} from '../services/billingMobileService';
import SportDetailModal from '../components/SportDetailModal';

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

const resolveRouteEnrollButtonText = ({ isCurrentRoute, estaLleno, routeId }) => {
  if (isCurrentRoute) return 'Recorrido Actualmente Activo';
  if (estaLleno) return 'Unidad Sprinter Completa (15/15)';
  return `Seleccionar ${routeId}`;
};

const resolveDiningPolicyHint = ({ bajaSolicitada, bajaProgramada, canCancelToday }) => {
  if (bajaSolicitada) {
    return `Baja programada para el ${formatDateDisplay(bajaProgramada)}`;
  }
  if (canCancelToday) {
    return 'Cancelación inmediata disponible hoy';
  }
  return 'Baja diferida al 1º del próximo mes';
};

const resolveDiningButtonText = ({ bajaSolicitada, bajaProgramada, canCancelToday }) => {
  if (bajaSolicitada) {
    return `Baja Programada (${formatDateDisplay(bajaProgramada)})`;
  }
  if (canCancelToday) {
    return 'Cancelar Comedor Hoy (Baja Inmediata)';
  }
  return 'Solicitar Baja para el Próximo Mes';
};

const SportCardItem = ({
  disc,
  student,
  tariffsConfig,
  onPress,
}) => {
  const isEnrolled = isStudentEnrolledInDiscipline(student, disc);
  const monthlyRate = getSportMonthlyPrice(disc, tariffsConfig);
  const iconName = resolveSportIcon(disc.nombre);

  return (
    <TouchableOpacity
      style={[styles.sportCompactCard, isEnrolled && styles.sportCompactCardEnrolled]}
      onPress={() => onPress(disc)}
      activeOpacity={0.75}
    >
      <View style={styles.sportCompactLeft}>
        <View style={[styles.sportCompactIcon, isEnrolled && styles.sportCompactIconEnrolled]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isEnrolled ? COLORS.emerald : COLORS.accent}
          />
        </View>

        <View style={styles.sportCompactInfo}>
          <View style={styles.titleWithBadge}>
            <Text style={styles.sportCompactTitle}>{disc.nombre}</Text>
            {isEnrolled && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>INSCRIPTO</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View style={styles.sportCompactRight}>
        <Text style={styles.sportCompactPrice}>
          {formatCurrencyARS(monthlyRate)}
          <Text style={styles.sportCompactPriceSub}> / mes</Text>
        </Text>
        <Ionicons name="chevron-forward" size={17} color={COLORS.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const TransportRouteCardItem = ({
  route,
  student,
  studentRoute,
  allStudents,
  routes,
  tariffsConfig,
  isStudentRole,
  isBusy,
  onEnrollRoute,
}) => {
  const occupancy = getTransportRouteOccupancy(
    route.id,
    allStudents,
    routes,
    SPRINTER_STANDARD_CAPACITY
  );
  const isCurrentRoute =
    studentRoute &&
    (studentRoute.id === route.id || studentRoute.code === route.code);
  const monthlyPrice = getRouteMonthlyPrice(route.id, tariffsConfig);
  const prop = calculateMonthlyProportional({
    startDate: isCurrentRoute ? student.transporteFechaInicio : new Date(),
    monthlyRate: monthlyPrice,
  });

  const buttonText = resolveRouteEnrollButtonText({
    isCurrentRoute,
    estaLleno: occupancy.estaLleno,
    routeId: route.id,
  });

  return (
    <View
      key={route.id}
      style={[
        styles.serviceCard,
        isCurrentRoute && styles.serviceCardEnrolled,
      ]}
    >
      <View style={styles.sportTopRow}>
        <View style={[styles.emojiBox, { backgroundColor: COLORS.cyanSoft }]}>
          <Ionicons name="bus" size={20} color={COLORS.cyan} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sportName}>{route.nombre}</Text>
          <Text style={styles.sportTeacher}>Zona: {route.zona}</Text>
          <Text style={styles.sportSchedule}>
            Ida: {route.horarioIda} · Regreso: {route.horarioRegreso}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceTag}>
            {formatCurrencyARS(monthlyPrice)}/mes
          </Text>
          <Text style={styles.propSmallTag}>
            Prop. hoy: {prop.formattedProportional}
          </Text>
        </View>
      </View>

      <View style={styles.occupancyBarWrap}>
        <View style={styles.occupancyLabels}>
          <Text style={styles.occupancyText}>
            Mercedes-Benz Sprinter
          </Text>
          <Text
            style={[
              styles.occupancyFreeText,
              { color: occupancy.estaLleno ? COLORS.rose : COLORS.emerald },
            ]}
          >
            {occupancy.estaLleno
              ? 'SIN VACANTES (15/15)'
              : `${occupancy.disponibles} plazas libres`}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${occupancy.porcentaje}%`,
                backgroundColor: occupancy.estaLleno
                  ? COLORS.rose
                  : COLORS.emerald,
              },
            ]}
          />
        </View>
      </View>

      {!isStudentRole && (
        <TouchableOpacity
          style={[
            styles.enrollBtn,
            (isCurrentRoute || occupancy.estaLleno) &&
              styles.enrollBtnDisabled,
          ]}
          onPress={() => onEnrollRoute(route)}
          disabled={isBusy || isCurrentRoute || occupancy.estaLleno}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Text style={styles.enrollBtnText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const DiningCardItem = ({
  student,
  isDiningActive,
  diningPrice,
  diningNotes,
  setDiningNotes,
  isStudentRole,
  processingKey,
  onSaveNotes,
  onToggleDining,
}) => {
  const policyHint = resolveDiningPolicyHint({
    bajaSolicitada: student.comedorBajaSolicitada,
    bajaProgramada: student.comedorBajaProgramada,
    canCancelToday: canCancelServiceToday(student.comedorFechaInicio),
  });

  const buttonText = resolveDiningButtonText({
    bajaSolicitada: student.comedorBajaSolicitada,
    bajaProgramada: student.comedorBajaProgramada,
    canCancelToday: canCancelServiceToday(student.comedorFechaInicio),
  });

  return (
    <View
      style={[
        styles.serviceCard,
        isDiningActive && styles.serviceCardEnrolled,
      ]}
    >
      <View style={styles.sportTopRow}>
        <View style={[styles.emojiBox, { backgroundColor: COLORS.accentSoft }]}>
          <Ionicons name="restaurant" size={20} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleWithBadge}>
            <Text style={styles.sportName}>
              Servicio de Comedor Escolar Mensual
            </Text>
            {isDiningActive && (
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>ACTIVO</Text>
              </View>
            )}
          </View>
          <Text style={styles.sportTeacher}>
            Almuerzo nutricional supervisado para jornada extendida
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.priceTag}>
            {formatCurrencyARS(diningPrice)}/mes
          </Text>
          <Text style={styles.propSmallTag}>
            Prop. mes:{' '}
            {
              calculateMonthlyProportional({
                startDate: isDiningActive
                  ? student.comedorFechaInicio
                  : new Date(),
                monthlyRate: diningPrice,
              }).formattedProportional
            }
          </Text>
        </View>
      </View>

      {isDiningActive && (
        <View style={styles.subscriptionStatusBox}>
          <Text style={styles.subscriptionStatusText}>
            Fecha de alta: {formatDateDisplay(student.comedorFechaInicio)} · {policyHint}
          </Text>
        </View>
      )}

      <View style={{ gap: 6, marginTop: 4 }}>
        <Text style={styles.smallInputLabel}>
          Observaciones Nutricionales / Restricciones Alimentarias (Celiaquía, Alergias, etc.)
        </Text>
        <TextInput
          style={styles.notesInput}
          value={diningNotes}
          onChangeText={setDiningNotes}
          editable={!isStudentRole}
          placeholder="Ej: Sin restricciones alimentarias / Menú apto celíaco"
        />
        {!isStudentRole && (
          <TouchableOpacity
            style={styles.saveNotesBtn}
            onPress={onSaveNotes}
            disabled={processingKey === 'save-dining-notes'}
          >
            <Ionicons name="save-outline" size={14} color={COLORS.indigo} />
            <Text style={styles.saveNotesBtnText}>
              Guardar Observaciones de Comedor
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {!isStudentRole && (
        <View style={styles.cardActionRow}>
          {isDiningActive ? (
            <TouchableOpacity
              style={[
                styles.withdrawBtn,
                student.comedorBajaSolicitada && { opacity: 0.55 },
              ]}
              onPress={() => onToggleDining(false)}
              disabled={
                processingKey === 'toggle-dining' ||
                Boolean(student.comedorBajaSolicitada)
              }
            >
              <Text style={styles.withdrawBtnText}>{buttonText}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.enrollBtn}
              onPress={() => onToggleDining(true)}
              disabled={processingKey === 'toggle-dining'}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={COLORS.white}
              />
              <Text style={styles.enrollBtnText}>
                Inscribir al Servicio de Comedor Escolar
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const ServicesScreen = ({
  student,
  allStudents = [],
  allDisciplines = [],
  routes = TRANSPORT_ROUTES,
  tariffsConfig,
  isStudentRole = false,
  onStudentUpdated,
  onFeedback,
}) => {
  const [activeServiceTab, setActiveServiceTab] = useState('sports'); // 'sports' | 'transport' | 'dining'
  const [processingKey, setProcessingKey] = useState(null);
  const [diningNotes, setDiningNotes] = useState(student?.observacionesComedor || '');
  const [selectedDisciplineForDetail, setSelectedDisciplineForDetail] = useState(null);

  const { diningPrice } = useMemo(
    () => resolveOfficialTariffs(tariffsConfig),
    [tariffsConfig]
  );

  // Deportes activos del alumno
  const enrolledDisciplines = useMemo(() => {
    if (!student) return [];
    return allDisciplines.filter((d) => isStudentEnrolledInDiscipline(student, d));
  }, [student, allDisciplines]);

  // Mantener la disciplina abierta sincronizada si cambian los datos del estudiante
  const activeDisciplineInModal = useMemo(() => {
    if (!selectedDisciplineForDetail) return null;
    return (
      allDisciplines.find((d) => String(d.id) === String(selectedDisciplineForDetail.id)) ||
      selectedDisciplineForDetail
    );
  }, [allDisciplines, selectedDisciplineForDetail]);

  // Estado de Transporte del alumno
  const studentRoute = useMemo(() => {
    if (!student) return null;
    const servicios = Array.isArray(student.servicios) ? student.servicios : [];
    const hasTransport =
      Boolean(student.recorridoTransporte) ||
      servicios.some((s) => String(s).toLowerCase().includes('transporte'));
    if (!hasTransport) return null;
    return (
      matchTransportRoute(student.recorridoTransporte, routes) || {
        id: student.recorridoTransporte || 'Recorrido 1',
        code: 'r1',
        nombre: student.recorridoTransporte || 'Recorrido 1 - Zona Norte',
        zona: 'Recorrido escolar asignado',
        horarioIda: '07:00 hs',
        horarioRegreso: '16:30 hs',
      }
    );
  }, [student, routes]);

  // Estado de Comedor del alumno
  const isDiningActive = useMemo(() => {
    if (!student) return false;
    const servicios = Array.isArray(student.servicios) ? student.servicios : [];
    return (
      Boolean(student.comedor) ||
      servicios.some((s) => String(s).toLowerCase().includes('comedor'))
    );
  }, [student]);

  if (!student) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="person-outline" size={38} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>Seleccione un alumno para gestionar sus servicios.</Text>
      </View>
    );
  }

  const handleEnrollSportAction = async (discipline) => {
    if (isStudentRole) return;
    setProcessingKey(`sport-${discipline.id}`);
    try {
      const updated = await enrollStudentInSport({
        student,
        discipline,
        allDisciplines,
      });
      onStudentUpdated?.(updated);
      const price = getSportMonthlyPrice(discipline, tariffsConfig);
      const prop = calculateMonthlyProportional({
        startDate: new Date(),
        monthlyRate: price,
      });
      onFeedback?.({
        type: 'success',
        message: `Inscripción a ${discipline.nombre} confirmada. Proporcional primer mes (${prop.activeDays}/${prop.daysInMonth} días): ${prop.formattedProportional}.`,
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleWithdrawSportAction = async (discipline) => {
    if (isStudentRole) return;
    setProcessingKey(`sport-${discipline.id}`);
    try {
      const res = await withdrawStudentFromSport({
        student,
        discipline,
      });
      onStudentUpdated?.(res.student);
      onFeedback?.({
        type: 'success',
        message: res.message,
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleEnrollRouteAction = async (route) => {
    if (isStudentRole) return;
    setProcessingKey(`route-${route.id}`);
    try {
      const updated = await enrollStudentInTransport({
        student,
        routeId: route.id,
        allStudents,
        routes,
      });
      onStudentUpdated?.(updated);
      const price = getRouteMonthlyPrice(route.id, tariffsConfig);
      const prop = calculateMonthlyProportional({
        startDate: new Date(),
        monthlyRate: price,
      });
      onFeedback?.({
        type: 'success',
        message: `Alta en ${route.nombre} confirmada. Proporcional primer mes (${prop.activeDays}/${prop.daysInMonth} días): ${prop.formattedProportional}.`,
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleCancelRouteAction = async () => {
    if (isStudentRole) return;
    setProcessingKey('cancel-route');
    try {
      const res = await cancelStudentTransport({ student });
      onStudentUpdated?.(res.student);
      onFeedback?.({ type: 'success', message: res.message });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleToggleDiningAction = async (nextActive) => {
    if (isStudentRole) return;
    setProcessingKey('toggle-dining');
    try {
      const res = await toggleStudentDining({
        student,
        active: nextActive,
        observacionesComedor: diningNotes || student.observacionesComedor,
      });
      onStudentUpdated?.(res.student);
      onFeedback?.({ type: 'success', message: res.message });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  const handleSaveDiningNotes = async () => {
    if (isStudentRole) return;
    setProcessingKey('save-dining-notes');
    try {
      const updated = await updateStudentDiningObservations({
        student,
        observacionesComedor: diningNotes,
      });
      onStudentUpdated?.(updated);
      onFeedback?.({
        type: 'success',
        message: 'Observaciones nutricionales de comedor actualizadas.',
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingKey(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sub-navegación de Servicios */}
      <View style={styles.subTabsBar}>
        <TouchableOpacity
          style={[
            styles.subTab,
            activeServiceTab === 'sports' && styles.subTabActive,
          ]}
          onPress={() => setActiveServiceTab('sports')}
        >
          <Ionicons
            name="football-outline"
            size={15}
            color={activeServiceTab === 'sports' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              activeServiceTab === 'sports' && styles.subTabTextActive,
            ]}
          >
            Deportes
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTab,
            activeServiceTab === 'transport' && styles.subTabActive,
          ]}
          onPress={() => setActiveServiceTab('transport')}
        >
          <Ionicons
            name="bus-outline"
            size={15}
            color={activeServiceTab === 'transport' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              activeServiceTab === 'transport' && styles.subTabTextActive,
            ]}
          >
            Transporte
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.subTab,
            activeServiceTab === 'dining' && styles.subTabActive,
          ]}
          onPress={() => setActiveServiceTab('dining')}
        >
          <Ionicons
            name="restaurant-outline"
            size={15}
            color={activeServiceTab === 'dining' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              activeServiceTab === 'dining' && styles.subTabTextActive,
            ]}
          >
            Comedor
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Regla Universal de Facturación Proporcional y Bajas */}
        <View style={styles.policyBanner}>
          <Ionicons name="information-circle" size={18} color={COLORS.indigo} />
          <Text style={styles.policyText}>
            <Text style={{ fontWeight: '800' }}>Normativa Institucional de Servicios:</Text> Al darse de alta se cobra solo el proporcional de los días restantes del primer mes. La baja inmediata sin cargo solo está disponible durante el mismo día del alta; a partir del día siguiente, la baja queda programada para el 1º del próximo mes.
          </Text>
        </View>

        {/* TAB 1: DEPORTES EXTRACURRICULARES (Cards Limpias con Detalle en Modal) */}
        {activeServiceTab === 'sports' && (
          <View style={styles.sectionWrap}>
            {allDisciplines.map((disc) => (
              <SportCardItem
                key={disc.id}
                disc={disc}
                student={student}
                tariffsConfig={tariffsConfig}
                onPress={setSelectedDisciplineForDetail}
              />
            ))}
          </View>
        )}

        {/* TAB 2: TRANSPORTE ESCOLAR (4 Recorridos - Mercedes-Benz Sprinter 15 Plazas) */}
        {activeServiceTab === 'transport' && (
          <View style={styles.sectionWrap}>
            {studentRoute && (
              <View style={styles.currentTransportBanner}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.currentTransportTag}>
                    RECORRIDO ACTUALMENTE ASIGNADO AL ALUMNO
                  </Text>
                  <Text style={styles.currentTransportTitle}>{studentRoute.nombre}</Text>
                  <Text style={styles.currentTransportMeta}>
                    Ida: {studentRoute.horarioIda} · Regreso: {studentRoute.horarioRegreso} · Alta:{' '}
                    {formatDateDisplay(student.transporteFechaInicio)}
                  </Text>
                  {student.transporteBajaSolicitada && (
                    <Text style={styles.scheduledCancelWarning}>
                      Baja programada solicitada para el{' '}
                      {formatDateDisplay(student.transporteBajaProgramada)}.
                    </Text>
                  )}
                </View>
                
                {!isStudentRole && !student.transporteBajaSolicitada && (
                  <TouchableOpacity
                    style={styles.cancelTransportBtn}
                    onPress={handleCancelRouteAction}
                    disabled={processingKey === 'cancel-route'}
                  >
                    <Text style={styles.cancelTransportBtnText}>
                      {canCancelServiceToday(student.transporteFechaInicio)
                        ? 'Dar de Baja Hoy'
                        : 'Baja Próximo Mes'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {routes.map((route) => (
              <TransportRouteCardItem
                key={route.id}
                route={route}
                student={student}
                studentRoute={studentRoute}
                allStudents={allStudents}
                routes={routes}
                tariffsConfig={tariffsConfig}
                isStudentRole={isStudentRole}
                isBusy={processingKey === `route-${route.id}`}
                onEnrollRoute={handleEnrollRouteAction}
              />
            ))}
          </View>
        )}

        {/* TAB 3: COMEDOR ESCOLAR */}
        {activeServiceTab === 'dining' && (
          <View style={styles.sectionWrap}>
            <DiningCardItem
              student={student}
              isDiningActive={isDiningActive}
              diningPrice={diningPrice}
              diningNotes={diningNotes}
              setDiningNotes={setDiningNotes}
              isStudentRole={isStudentRole}
              processingKey={processingKey}
              onSaveNotes={handleSaveDiningNotes}
              onToggleDining={handleToggleDiningAction}
            />
          </View>
        )}
      </ScrollView>

      {/* Modal Bottom Sheet de Detalle del Deporte */}
      <SportDetailModal
        visible={Boolean(activeDisciplineInModal)}
        discipline={activeDisciplineInModal}
        student={student}
        enrolledDisciplines={enrolledDisciplines}
        tariffsConfig={tariffsConfig}
        isStudentRole={isStudentRole}
        isBusy={Boolean(processingKey && processingKey.startsWith('sport-'))}
        onClose={() => setSelectedDisciplineForDetail(null)}
        onEnroll={handleEnrollSportAction}
        onWithdraw={handleWithdrawSportAction}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  sportCompactCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sportCompactCardEnrolled: {
    borderColor: COLORS.emerald,
    borderWidth: 1.5,
    backgroundColor: '#F0FDF4',
  },
  sportCompactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  sportCompactIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportCompactIconEnrolled: {
    backgroundColor: COLORS.emeraldSoft,
    borderColor: COLORS.emeraldBorder,
  },
  sportCompactInfo: {
    flex: 1,
    gap: 2,
  },
  sportCompactTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  sportCompactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sportCompactPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  sportCompactPriceSub: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  subTabsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  subTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  subTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  subTabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
    gap: 14,
  },
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.indigoSoft,
    borderColor: COLORS.indigoBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
  },
  policyText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.indigo,
    lineHeight: 16,
  },
  sectionWrap: {
    gap: 12,
  },
  serviceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  serviceCardEnrolled: {
    borderColor: COLORS.emerald,
    borderWidth: 1.5,
  },
  sportTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emojiBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  sportName: {
    fontSize: 14,
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
  sportTeacher: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  sportSchedule: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.emerald,
  },
  propSmallTag: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  subscriptionStatusBox: {
    backgroundColor: COLORS.emeraldSoft,
    padding: 8,
    borderRadius: 8,
  },
  subscriptionStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#065F46',
  },
  cardActionRow: {
    marginTop: 2,
  },
  enrollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.emerald,
    paddingVertical: 10,
    borderRadius: 8,
  },
  enrollBtnDisabled: {
    backgroundColor: COLORS.borderStrong,
  },
  enrollBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.roseSoft,
    borderWidth: 1,
    borderColor: COLORS.roseBorder,
    paddingVertical: 10,
    borderRadius: 8,
  },
  withdrawBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.rose,
  },
  currentTransportBanner: {
    flexDirection: 'col',
    alignItems: 'left',
    justifyContent: 'space-between',
    backgroundColor: COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    borderRadius: 12,
    padding: 13,
    gap: 10,
  },
  currentTransportTag: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.emerald,
    letterSpacing: 0.6,
  },
  currentTransportTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#064E3B',
    marginTop: 2,
  },
  currentTransportMeta: {
    fontSize: 11,
    color: '#065F46',
    marginTop: 2,
  },
  scheduledCancelWarning: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.amber,
    marginTop: 4,
  },
  cancelTransportBtn: {
    backgroundColor: COLORS.rose,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelTransportBtnText: {
    fontSize: 11,
    fontWeight: '800',
    paddingVertical: 3,
    borderRadius: 8,
    color: COLORS.white,
    textAlign: 'center'
  },
  occupancyBarWrap: {
    gap: 5,
  },
  occupancyLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  occupancyText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  occupancyFreeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  smallInputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  saveNotesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: COLORS.indigoSoft,
  },
  saveNotesBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.indigo,
  },
});

export default ServicesScreen;
