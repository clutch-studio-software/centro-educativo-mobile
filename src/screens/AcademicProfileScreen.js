import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import {
  acknowledgeStudentRecord,
  justifyStudentAbsence,
  isStudentEnrolledInDiscipline,
} from '../services/servicesMobileService';
import { pickAllowedDocument, formatFileSize } from '../services/storageMobileService';
import { matchTransportRoute, formatDateDisplay } from '../utils/subscriptionRules';

const AcademicProfileScreen = ({
  user,
  student,
  subjects = [],
  allDisciplines = [],
  routes = [],
  isStudentRole = false,
  onStudentUpdated,
  onFeedback,
}) => {
  const [subTab, setSubTab] = useState('academic'); // 'academic' | 'attendance' | 'supervision'
  const [processingId, setProcessingId] = useState(null);

  // Estado para modal de justificación de inasistencia
  const [justifyingAbsence, setJustifyingAbsence] = useState(null);
  const [motivoJust, setMotivoJust] = useState('Consulta / Reposo Médico');
  const [detalleJust, setDetalleJust] = useState('');
  const [certCode, setCertCode] = useState('');
  const [certFile, setCertFile] = useState(null);
  const [submittingJust, setSubmittingJust] = useState(false);

  const studentSports = useMemo(() => {
    if (!student) return [];
    return allDisciplines.filter((d) => isStudentEnrolledInDiscipline(student, d));
  }, [student, allDisciplines]);

  const studentRoute = useMemo(() => {
    if (!student) return null;
    const servicios = Array.isArray(student.servicios) ? student.servicios : [];
    const hasTransport =
      Boolean(student.recorridoTransporte) ||
      servicios.some((s) => String(s).toLowerCase().includes('transporte'));
    if (!hasTransport) return null;
    return matchTransportRoute(student.recorridoTransporte, routes);
  }, [student, routes]);

  const isDiningActive = useMemo(() => {
    if (!student) return false;
    const servicios = Array.isArray(student.servicios) ? student.servicios : [];
    return (
      Boolean(student.comedor) ||
      servicios.some((s) => String(s).toLowerCase().includes('comedor'))
    );
  }, [student]);

  const attendanceSummary = useMemo(() => {
    const raw = student?.asistencias || {};
    const historial = Array.isArray(raw.historial)
      ? raw.historial
      : Array.isArray(raw.detalle)
        ? raw.detalle
        : [];
    const presentes = Number(raw.presentes) || 0;
    const faltasInjustificadas = Number(raw.faltasInjustificadas) || 0;
    const faltasJustificadas = Number(raw.faltasJustificadas) || 0;
    const tardanzas = Number(raw.tardanzas) || 0;
    const porcentaje =
      typeof raw.porcentajeAsistencia === 'number'
        ? raw.porcentajeAsistencia
        : typeof raw.porcentaje === 'number'
          ? raw.porcentaje
          : 100;

    return {
      presentes,
      faltasInjustificadas,
      faltasJustificadas,
      tardanzas,
      porcentaje,
      historial: historial.filter((h) => h.estado !== 'presente'),
    };
  }, [student]);

  const healthEntries = useMemo(() => {
    if (!student) return [];
    return Array.isArray(student.entradasEnfermeria) ? student.entradasEnfermeria : [];
  }, [student]);

  const preceptoriaEntries = useMemo(() => {
    if (!student) return [];
    return Array.isArray(student.entradasPreceptoria) ? student.entradasPreceptoria : [];
  }, [student]);

  if (!student) {
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="school-outline" size={38} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>No hay un alumno seleccionado.</Text>
      </View>
    );
  }

  const handleAcknowledge = async (recordType, recordId) => {
    if (isStudentRole) return;
    setProcessingId(`${recordType}-${recordId}`);
    try {
      const updated = await acknowledgeStudentRecord({
        student,
        recordType,
        recordId,
        tutorUser: user,
      });
      onStudentUpdated?.(updated);
      onFeedback?.({
        type: 'success',
        message: 'Constancia de "Visto del Tutor" registrada en el legajo del alumno.',
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setProcessingId(null);
    }
  };

  const handlePickCertificate = async () => {
    try {
      const asset = await pickAllowedDocument();
      if (asset) setCertFile(asset);
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    }
  };

  const handleSubmitJustification = async () => {
    if (!justifyingAbsence) return;
    setSubmittingJust(true);
    try {
      const updated = await justifyStudentAbsence({
        student,
        absenceId: justifyingAbsence.id || justifyingAbsence.fecha,
        motivo: motivoJust,
        detalle: detalleJust,
        certificadoCodigo: certCode,
        fileAsset: certFile,
        tutorUser: user,
      });
      onStudentUpdated?.(updated);
      setJustifyingAbsence(null);
      setDetalleJust('');
      setCertCode('');
      setCertFile(null);
      onFeedback?.({
        type: 'success',
        message: 'Justificación de inasistencia enviada a Preceptoría con éxito.',
      });
    } catch (err) {
      onFeedback?.({ type: 'error', message: err.message });
    } finally {
      setSubmittingJust(false);
    }
  };

  const fullName =
    student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim();

  return (
    <View style={styles.container}>
      {/* Sub-pestañas */}
      <View style={styles.subTabsBar}>
        <TouchableOpacity
          style={[styles.subTab, subTab === 'academic' && styles.subTabActive]}
          onPress={() => setSubTab('academic')}
        >
          <Ionicons
            name="book-outline"
            size={15}
            color={subTab === 'academic' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              subTab === 'academic' && styles.subTabTextActive,
            ]}
          >
            Materias
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, subTab === 'attendance' && styles.subTabActive]}
          onPress={() => setSubTab('attendance')}
        >
          <Ionicons
            name="calendar-outline"
            size={15}
            color={subTab === 'attendance' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              subTab === 'attendance' && styles.subTabTextActive,
            ]}
          >
            Asistencias
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTab, subTab === 'supervision' && styles.subTabActive]}
          onPress={() => setSubTab('supervision')}
        >
          <Ionicons
            name="medkit-outline"
            size={15}
            color={subTab === 'supervision' ? COLORS.white : COLORS.textSecondary}
          />
          <Text
            style={[
              styles.subTabText,
              subTab === 'supervision' && styles.subTabTextActive,
            ]}
          >
            Legajo
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Ficha Institucional del Alumno */}
        <View style={styles.studentHeaderCard}>
          <View style={styles.studentHeaderTop}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>
                {fullName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{fullName}</Text>
              <Text style={styles.studentMeta}>
                Legajo: {student.legajo || student.studentID_login || student.id} · DNI:{' '}
                {student.dni || 'S/D'}
              </Text>
              <Text style={styles.studentCourseBadge}>
                Nivel {String(student.nivel || 'Primario').toUpperCase()} ·{' '}
                {student.curso || 'Curso asignado'} — División “{student.division || 'A'}”
              </Text>
            </View>
          </View>

          <View style={styles.servicesSummaryRow}>
            <View style={styles.miniServicePill}>
              <Ionicons name="bus" size={13} color={COLORS.cyan} />
              <Text style={styles.miniServiceText}>
                {studentRoute ? studentRoute.id : 'Sin Transporte'}
              </Text>
            </View>
            <View style={styles.miniServicePill}>
              <Ionicons name="restaurant" size={13} color={COLORS.accent} />
              <Text style={styles.miniServiceText}>
                Comedor: {isDiningActive ? 'Activo' : 'No inscripto'}
              </Text>
            </View>
          </View>
        </View>

        {/* SUB-TAB 1: PROFESORES POR MATERIA Y DEPORTES EN QUE PARTICIPA */}
        {subTab === 'academic' && (
          <View style={styles.sectionWrap}>
            <View style={styles.cardBlock}>
              <View style={styles.blockHeader}>
                <Ionicons name="library-outline" size={17} color={COLORS.indigo} />
                <Text style={styles.blockTitle}>
                  Materias que Cursa y Profesores a Cargo ({subjects.length})
                </Text>
              </View>

              {subjects.map((sub) => (
                <View key={sub.id || sub.nombre} style={styles.subjectRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.subjectName}>{sub.nombre}</Text>
                    <Text style={styles.subjectTeacher}>
                      {sub.profesor?.nombre || 'Docente Titular'}
                    </Text>
                  </View>
                  <View style={styles.hoursBadge}>
                    <Text style={styles.hoursBadgeText}>
                      {sub.cargaHoraria || '4 hs/sem'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.cardBlock}>
              <View style={styles.blockHeader}>
                <Ionicons name="trophy-outline" size={17} color={COLORS.emerald} />
                <Text style={styles.blockTitle}>
                  Deportes Extracurriculares en que Participa ({studentSports.length})
                </Text>
              </View>

              {studentSports.length === 0 ? (
                <Text style={styles.emptyNote}>
                  El alumno no registra deportes extracurriculares activos en este momento.
                </Text>
              ) : (
                studentSports.map((sp) => (
                  <View key={sp.id} style={styles.subjectRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.subjectName}>
                        {sp.emoji || '🏅'} {sp.nombre}
                      </Text>
                      <Text style={styles.subjectTeacher}>
                        Horario: {sp.horario} · Profesor: {sp.profesor?.nombre || 'Docente'}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* SUB-TAB 2: ASISTENCIAS E INASISTENCIAS */}
        {subTab === 'attendance' && (
          <View style={styles.sectionWrap}>
            <View style={styles.attendanceStatsGrid}>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: COLORS.emerald }]}>
                  {attendanceSummary.porcentaje}%
                </Text>
                <Text style={styles.statLbl}>Asistencia</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: COLORS.primary }]}>
                  {attendanceSummary.presentes}
                </Text>
                <Text style={styles.statLbl}>Presentes</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: COLORS.rose }]}>
                  {attendanceSummary.faltasInjustificadas}
                </Text>
                <Text style={styles.statLbl}>Injustif.</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: COLORS.amber }]}>
                  {attendanceSummary.faltasJustificadas}
                </Text>
                <Text style={styles.statLbl}>Justif.</Text>
              </View>
            </View>

            {attendanceSummary.historial.length === 0 ? (
              <View style={styles.cardBlock}>
                <Text style={styles.emptyNote}>
                  No se registran inasistencias ni tardanzas en el legajo del alumno.
                </Text>
              </View>
            ) : (
              attendanceSummary.historial.map((att) => {
                const recordId = att.id || att.fecha;
                const isUnjustified =
                  !att.justificada &&
                  (att.estado === 'injustificada' ||
                    String(att.tipo || '').toLowerCase().includes('injustificada'));

                return (
                  <View key={recordId} style={styles.recordCard}>
                    <View style={styles.recordTopRow}>
                      <Text style={styles.recordTitle}>
                        {att.tipo || 'Inasistencia'} — {formatDateDisplay(att.fecha)}
                      </Text>
                      <Text
                        style={[
                          styles.recordStatusTag,
                          { color: isUnjustified ? COLORS.rose : COLORS.amber },
                        ]}
                      >
                        {att.justificada ? 'En revisión / Justificada' : 'Injustificada'}
                      </Text>
                    </View>
                    <Text style={styles.recordBodyText}>
                      Motivo: {att.motivo || 'Ausencia registrada en curso'}
                    </Text>

                    {att.justificacion?.comprobanteUrl ? (
                      <TouchableOpacity
                        style={styles.certLinkBtn}
                        onPress={() => Linking.openURL(att.justificacion.comprobanteUrl)}
                      >
                        <Ionicons name="document-text-outline" size={14} color={COLORS.indigo} />
                        <Text style={styles.certLinkText}>
                          Ver certificado médico adjunto ({att.justificacion.comprobanteNombre})
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {!isStudentRole && (
                      <View style={styles.recordActionsRow}>
                        {!att.vistoPorTutor ? (
                          <TouchableOpacity
                            style={styles.vistoBtn}
                            onPress={() => handleAcknowledge('attendance', recordId)}
                            disabled={processingId === `attendance-${recordId}`}
                          >
                            <Ionicons name="eye-outline" size={14} color={COLORS.emerald} />
                            <Text style={styles.vistoBtnText}>Dar Visto del Tutor</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.vistoConfirmed}>
                            ✓ Visto por tutor ({formatDateDisplay(att.fechaVisto)})
                          </Text>
                        )}

                        {isUnjustified && (
                          <TouchableOpacity
                            style={styles.justifyBtn}
                            onPress={() => setJustifyingAbsence(att)}
                          >
                            <Ionicons name="medkit-outline" size={14} color={COLORS.white} />
                            <Text style={styles.justifyBtnText}>Justificar Falta</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* SUB-TAB 3: GABINETE DE ENFERMERÍA Y PRECEPTORÍA */}
        {subTab === 'supervision' && (
          <View style={styles.sectionWrap}>
            <View style={styles.cardBlock}>
              <View style={styles.blockHeader}>
                <Ionicons name="medkit" size={17} color={COLORS.rose} />
                <Text style={styles.blockTitle}>
                  Gabinete de Enfermería ({healthEntries.length})
                </Text>
              </View>

              {healthEntries.length === 0 ? (
                <Text style={styles.emptyNote}>
                  El alumno no registra atenciones en el Gabinete de Enfermería.
                </Text>
              ) : (
                healthEntries.map((enf) => {
                  const eid = enf.id || enf.fecha;
                  return (
                    <View key={eid} style={styles.recordCardInner}>
                      <Text style={styles.recordTitle}>
                        {enf.sintoma || enf.motivo || 'Atención de Enfermería'} ({enf.fecha})
                      </Text>
                      <Text style={styles.recordBodyText}>
                        Atención: {enf.atencion || enf.observaciones || 'Control en gabinete'}
                      </Text>
                      {!isStudentRole && !enf.vistoPorTutor ? (
                        <TouchableOpacity
                          style={[styles.vistoBtn, { marginTop: 6 }]}
                          onPress={() => handleAcknowledge('health', eid)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.emerald} />
                          <Text style={styles.vistoBtnText}>Confirmar Visto del Tutor</Text>
                        </TouchableOpacity>
                      ) : enf.vistoPorTutor ? (
                        <Text style={styles.vistoConfirmed}>✓ Notificación vista por el tutor</Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.cardBlock}>
              <View style={styles.blockHeader}>
                <Ionicons name="shield-checkmark" size={17} color={COLORS.amber} />
                <Text style={styles.blockTitle}>
                  Seguimiento de Preceptoría ({preceptoriaEntries.length})
                </Text>
              </View>

              {preceptoriaEntries.length === 0 ? (
                <Text style={styles.emptyNote}>
                  El alumno no registra actas ni observaciones en Preceptoría.
                </Text>
              ) : (
                preceptoriaEntries.map((prec) => {
                  const pid = prec.id || prec.fecha;
                  return (
                    <View key={pid} style={styles.recordCardInner}>
                      <Text style={styles.recordTitle}>
                        {prec.tipo || prec.titulo || 'Nota de Preceptoría'} ({prec.fecha})
                      </Text>
                      <Text style={styles.recordBodyText}>
                        {prec.motivo || prec.descripcion || ''}
                      </Text>
                      {!isStudentRole && !prec.vistoPorTutor ? (
                        <TouchableOpacity
                          style={[styles.vistoBtn, { marginTop: 6 }]}
                          onPress={() => handleAcknowledge('preceptoria', pid)}
                        >
                          <Ionicons name="checkmark-circle-outline" size={14} color={COLORS.emerald} />
                          <Text style={styles.vistoBtnText}>Confirmar Visto del Tutor</Text>
                        </TouchableOpacity>
                      ) : prec.vistoPorTutor ? (
                        <Text style={styles.vistoConfirmed}>✓ Notificación vista por el tutor</Text>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Modal para Justificar Inasistencia subiendo Certificado a Firebase Storage */}
      <Modal
        visible={Boolean(justifyingAbsence)}
        transparent
        animationType="slide"
        onRequestClose={() => setJustifyingAbsence(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Justificar Inasistencia Escolar</Text>
            <Text style={styles.modalSub}>
              Fecha: {formatDateDisplay(justifyingAbsence?.fecha)} · Subida a Storage (justifications/)
            </Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Motivo de la Inasistencia</Text>
              <TextInput
                style={styles.modalInput}
                value={motivoJust}
                onChangeText={setMotivoJust}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Detalle / Observación Médica</Text>
              <TextInput
                style={styles.modalInput}
                value={detalleJust}
                onChangeText={setDetalleJust}
                placeholder="Ej: Reposo pediátrico por 48 hs"
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Nº de Certificado (opcional)</Text>
              <TextInput
                style={styles.modalInput}
                value={certCode}
                onChangeText={setCertCode}
                placeholder="Ej: CERT-8812"
              />
            </View>

            <TouchableOpacity style={styles.certPickBtn} onPress={handlePickCertificate}>
              <Ionicons name="cloud-upload-outline" size={18} color={COLORS.indigo} />
              <Text style={styles.certPickText}>
                {certFile
                  ? `${certFile.name} (${formatFileSize(certFile.size)})`
                  : 'Adjuntar Certificado Médico (PDF/PNG/JPG máx. 2 MB)'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setJustifyingAbsence(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmitJustification}
                disabled={submittingJust}
              >
                {submittingJust ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalSubmitText}>Enviar Justificación</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    backgroundColor: COLORS.indigo,
    borderColor: COLORS.indigo,
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
  studentHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  studentHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  studentMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  studentCourseBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.accent,
    marginTop: 3,
  },
  servicesSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  miniServicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  miniServiceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  sectionWrap: {
    gap: 12,
  },
  cardBlock: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
    gap: 8,
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  subjectTeacher: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  hoursBadge: {
    backgroundColor: COLORS.indigoSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  hoursBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.indigo,
  },
  emptyNote: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  attendanceStatsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '900',
  },
  statLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  recordCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  recordCardInner: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
    gap: 4,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recordTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  recordStatusTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  recordBodyText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  certLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  certLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.indigo,
    textDecorationLine: 'underline',
  },
  recordActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  vistoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  vistoBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  vistoConfirmed: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  justifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.indigo,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  justifyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  modalField: {
    gap: 4,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: COLORS.text,
  },
  certPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.indigoSoft,
    borderWidth: 1,
    borderColor: COLORS.indigoBorder,
    padding: 11,
    borderRadius: 8,
  },
  certPickText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.indigo,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  modalCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: COLORS.indigo,
  },
  modalSubmitText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default AcademicProfileScreen;
