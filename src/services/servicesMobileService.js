import { doc, getDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  TRANSPORT_ROUTES,
  SPRINTER_STANDARD_CAPACITY,
  getTodayDateString,
  getNextMonthFirstDay,
  canCancelServiceToday,
  getTransportRouteOccupancy,
  checkScheduleConflict,
  matchTransportRoute,
} from '../utils/subscriptionRules';
import { uploadFileToFirebaseStorage } from './storageMobileService';

/**
 * Inscribe a un alumno en uno de los 4 recorridos oficiales de Transporte Escolar
 * validando el límite estricto de 15 plazas de la Mercedes-Benz Sprinter.
 * Respeta estrictamente allowedFields de firestore.rules.
 */
export const enrollStudentInTransport = async ({
  student,
  routeId,
  allStudents = [],
  routes = TRANSPORT_ROUTES,
  today = new Date(),
}) => {
  if (!student?.id || !routeId) {
    throw new Error('Seleccione un alumno y un recorrido válido de transporte.');
  }

  const matchedRoute = matchTransportRoute(routeId, routes);
  const canonicalRouteId = matchedRoute?.id || routeId;

  const occupancy = getTransportRouteOccupancy(
    canonicalRouteId,
    allStudents,
    routes,
    SPRINTER_STANDARD_CAPACITY
  );

  // Si el alumno no estaba ya en este recorrido y el recorrido está lleno (15/15), bloquear
  const currentStudentRoute = matchTransportRoute(student.recorridoTransporte, routes);
  const alreadyInThisRoute =
    currentStudentRoute && matchedRoute && currentStudentRoute.id === matchedRoute.id;

  if (occupancy.estaLleno && !alreadyInThisRoute) {
    throw new Error(
      `El ${canonicalRouteId} alcanzó su capacidad máxima de ${SPRINTER_STANDARD_CAPACITY} plazas (Mercedes-Benz Sprinter). Por favor seleccione otro recorrido.`
    );
  }

  const currentServicios = Array.isArray(student.servicios) ? [...student.servicios] : [];
  if (!currentServicios.some((s) => String(s).toLowerCase().includes('transporte'))) {
    currentServicios.push('Transporte Escolar');
  }

  const todayStr = getTodayDateString(today);
  const firestoreUpdates = {
    servicios: currentServicios,
    recorridoTransporte: canonicalRouteId,
    transporteFechaInicio: todayStr,
    transporteBajaSolicitada: false,
    transporteBajaProgramada: null,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

  return {
    ...student,
    ...firestoreUpdates,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Da de baja el servicio de transporte escolar:
 * - Si fue contratado hoy (transporteFechaInicio === hoy): baja inmediata sin cargo.
 * - Si fue contratado en días anteriores: programa la baja para el 1º del mes siguiente.
 */
export const cancelStudentTransport = async ({ student, today = new Date() }) => {
  if (!student?.id) {
    throw new Error('Alumno no válido para gestionar la baja de transporte.');
  }

  const isSameDay = canCancelServiceToday(student.transporteFechaInicio, today);

  if (isSameDay) {
    const currentServicios = (student.servicios || []).filter(
      (s) => !String(s).toLowerCase().includes('transporte')
    );
    const firestoreUpdates = {
      servicios: currentServicios,
      recorridoTransporte: null,
      transporteFechaInicio: null,
      transporteBajaSolicitada: false,
      transporteBajaProgramada: null,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

    return {
      student: { ...student, ...firestoreUpdates },
      immediate: true,
      message:
        'Baja inmediata aplicada con éxito (cancelación realizada dentro del mismo día de inscripción).',
    };
  }

  const nextMonth = getNextMonthFirstDay(today);
  const firestoreUpdates = {
    transporteBajaSolicitada: true,
    transporteBajaProgramada: nextMonth.iso,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

  return {
    student: { ...student, ...firestoreUpdates },
    immediate: false,
    effectiveDate: nextMonth.display,
    message: `Solicitud de baja registrada. Por normativa institucional (alta previa al día de hoy), el servicio continuará activo este mes con su proporcional y se dará de baja automáticamente el ${nextMonth.display}.`,
  };
};

/**
 * Activa o solicita la baja del Servicio de Comedor Escolar
 */
export const toggleStudentDining = async ({
  student,
  active,
  observacionesComedor,
  today = new Date(),
}) => {
  if (!student?.id) {
    throw new Error('Alumno no válido para gestionar el servicio de comedor.');
  }

  const todayStr = getTodayDateString(today);
  const nextMonth = getNextMonthFirstDay(today);

  if (active) {
    const currentServicios = Array.isArray(student.servicios) ? [...student.servicios] : [];
    if (!currentServicios.some((s) => String(s).toLowerCase().includes('comedor'))) {
      currentServicios.push('Comedor Escolar');
    }

    const firestoreUpdates = {
      comedor: true,
      servicios: currentServicios,
      comedorFechaInicio: todayStr,
      comedorBajaSolicitada: false,
      comedorBajaProgramada: null,
      observacionesComedor:
        observacionesComedor !== undefined
          ? observacionesComedor
          : student.observacionesComedor || 'Menú escolar general sin restricciones',
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

    return {
      student: { ...student, ...firestoreUpdates },
      immediate: true,
      message:
        'Inscripción al Comedor Escolar confirmada. Se facturará únicamente el proporcional por los días restantes de este mes.',
    };
  }

  // Solicitud de baja de comedor
  const isSameDay = canCancelServiceToday(student.comedorFechaInicio, today);

  if (isSameDay) {
    const currentServicios = (student.servicios || []).filter(
      (s) => !String(s).toLowerCase().includes('comedor')
    );

    const firestoreUpdates = {
      comedor: false,
      servicios: currentServicios,
      comedorFechaInicio: null,
      comedorBajaSolicitada: false,
      comedorBajaProgramada: null,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

    return {
      student: { ...student, ...firestoreUpdates },
      immediate: true,
      message:
        'Baja inmediata del Comedor Escolar aplicada con éxito (cancelación en el mismo día del alta).',
    };
  }

  const firestoreUpdates = {
    comedorBajaSolicitada: true,
    comedorBajaProgramada: nextMonth.iso,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'students', student.id), firestoreUpdates);

  return {
    student: { ...student, ...firestoreUpdates },
    immediate: false,
    effectiveDate: nextMonth.display,
    message: `Baja programada de Comedor registrada para el ${nextMonth.display}. Durante el resto del mes en curso el alumno mantiene su plaza activa.`,
  };
};

/**
 * Actualiza las observaciones nutricionales o alergias del comedor
 */
export const updateStudentDiningObservations = async ({ student, observacionesComedor }) => {
  if (!student?.id) throw new Error('Alumno no válido.');
  const cleanObs = String(observacionesComedor || '').trim();

  await updateDoc(doc(db, 'students', student.id), {
    observacionesComedor: cleanObs,
    updatedAt: serverTimestamp(),
  });

  return {
    ...student,
    observacionesComedor: cleanObs,
  };
};

/**
 * Determina si un alumno está inscripto en una disciplina deportiva (por su perfil o padrón)
 */
export const isStudentEnrolledInDiscipline = (student, discipline) => {
  if (!student || !discipline) return false;
  const studentId = String(student.id || '').trim();
  const studentDni = String(student.dni || '').replace(/\D/g, '');
  const discId = String(discipline.id || '').trim().toLowerCase();
  const discName = String(discipline.nombre || '').trim().toLowerCase();

  const studentDeportes = Array.isArray(student.deportes) ? student.deportes : [];
  const inStudentArray = studentDeportes.some((d) => {
    const val = String(typeof d === 'string' ? d : d.id || d.nombre || '').trim().toLowerCase();
    return val === discId || val === discName;
  });

  const inscriptos = Array.isArray(discipline.inscriptos) ? discipline.inscriptos : [];
  const inRoster = inscriptos.some((ins) => {
    const insId = String(ins?.id || ins?.studentId || '').trim();
    const insDni = String(ins?.dni || '').replace(/\D/g, '');
    return (studentId && insId === studentId) || (studentDni && insDni && insDni === studentDni);
  });

  return inStudentArray || inRoster;
};

/**
 * Inscribe a un alumno en una disciplina deportiva extracurricular:
 * - Valida que no esté ya inscripto (evita duplicados)
 * - Valida máximo 2 deportes simultáneos por alumno
 * - Valida que no exista superposición horaria con otro deporte ya inscripto
 * - Valida cupo disponible de la disciplina
 * - Sincroniza students/{studentId} y sportsActivities/{disciplineId}
 */
export const enrollStudentInSport = async ({
  student,
  discipline,
  allDisciplines = [],
  today = new Date(),
}) => {
  if (!student?.id || !discipline?.id) {
    throw new Error('Datos de alumno o disciplina deportiva incompletos.');
  }

  // 1. Verificar duplicado
  if (isStudentEnrolledInDiscipline(student, discipline)) {
    throw new Error(`El alumno ya se encuentra inscripto en ${discipline.nombre}.`);
  }

  // 2. Obtener disciplinas actualmente activas del alumno
  const enrolledDisciplines = allDisciplines.filter((d) =>
    isStudentEnrolledInDiscipline(student, d)
  );

  // 3. Validar límite máximo de 2 deportes simultáneos
  if (enrolledDisciplines.length >= 2) {
    const names = enrolledDisciplines.map((d) => d.nombre).join(' y ');
    throw new Error(
      `Límite alcanzado: Cada alumno puede inscribirse hasta en 2 deportes simultáneamente (actualmente inscripto en: ${names}).`
    );
  }

  // 4. Validar conflicto de horarios
  const conflict = checkScheduleConflict(enrolledDisciplines, discipline);
  if (conflict) {
    throw new Error(
      `Conflicto de horario detectado: ${conflict.overlapLabel}. Seleccione una actividad sin superposición horaria.`
    );
  }

  // 5. Validar cupo máximo de la disciplina
  const inscriptos = Array.isArray(discipline.inscriptos) ? [...discipline.inscriptos] : [];
  const cupoMax = Number(discipline.cupoMax) || 30;
  if (inscriptos.length >= cupoMax) {
    throw new Error(`La disciplina ${discipline.nombre} tiene el cupo completo (${cupoMax}/${cupoMax}).`);
  }

  const todayStr = getTodayDateString(today);

  // 6. Actualizar padrón en sportsActivities/{disciplineId}
  const studentRosterEntry = {
    id: student.id,
    nombre:
      student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim(),
    dni: student.dni || '',
    legajo: student.legajo || student.studentID_login || `#EST-${student.id.slice(0, 5)}`,
    curso: student.curso || 'Sin curso',
    nivel: student.nivel || 'Primario',
    fechaInscripcion: todayStr,
  };

  const nextInscriptos = [studentRosterEntry, ...inscriptos];
  const sportRef = doc(db, 'sportsActivities', discipline.id);
  await setDoc(
    sportRef,
    {
      id: discipline.id,
      nombre: discipline.nombre,
      emoji: discipline.emoji || '🏅',
      profesor: discipline.profesor || { nombre: 'Profesor asignado' },
      niveles: discipline.niveles || 'Todos los niveles',
      dias: discipline.dias || [],
      horario: discipline.horario || '',
      lugar: discipline.lugar || 'Campo de Deportes',
      cupoMax,
      inscriptos: nextInscriptos,
      cupoOcupado: nextInscriptos.length,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // 7. Actualizar perfil del alumno en students/{studentId} (solo allowedFields)
  const currentDeportes = Array.isArray(student.deportes) ? [...student.deportes] : [];
  if (!currentDeportes.includes(discipline.id)) {
    currentDeportes.push(discipline.id);
  }

  const prevSubs = student.deportesSuscripciones || {};
  const nextSubs = {
    ...prevSubs,
    [discipline.id]: {
      fechaInicio: todayStr,
      bajaSolicitada: false,
      bajaProgramada: null,
    },
  };

  const studentUpdates = {
    deportes: currentDeportes,
    deporteFechaInicio: student.deporteFechaInicio || todayStr,
    deportesSuscripciones: nextSubs,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'students', student.id), studentUpdates);

  return {
    ...student,
    ...studentUpdates,
  };
};

/**
 * Da de baja o programa la baja de una disciplina deportiva según la regla del mismo día
 */
export const withdrawStudentFromSport = async ({
  student,
  discipline,
  today = new Date(),
}) => {
  if (!student?.id || !discipline?.id) {
    throw new Error('Datos de alumno o disciplina deportiva incompletos.');
  }

  const currentSubs = student.deportesSuscripciones || {};
  const subInfo = currentSubs[discipline.id] || currentSubs[discipline.nombre] || {};
  const startDate = subInfo.fechaInicio || student.deporteFechaInicio;
  const isSameDay = canCancelServiceToday(startDate, today);

  if (isSameDay) {
    // Baja inmediata en el mismo día de inscripción
    const discIdLower = String(discipline.id).toLowerCase();
    const discNameLower = String(discipline.nombre || '').toLowerCase();

    const nextDeportes = (student.deportes || []).filter((d) => {
      const val = String(typeof d === 'string' ? d : d.id || d.nombre || '').toLowerCase();
      return val !== discIdLower && val !== discNameLower;
    });

    const nextSubs = { ...currentSubs };
    delete nextSubs[discipline.id];
    delete nextSubs[discipline.nombre];

    const studentUpdates = {
      deportes: nextDeportes,
      deportesSuscripciones: nextSubs,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, 'students', student.id), studentUpdates);

    // Retirar también de sportsActivities/{disciplineId}
    try {
      const sportRef = doc(db, 'sportsActivities', discipline.id);
      const snap = await getDoc(sportRef);
      if (snap.exists()) {
        const data = snap.data();
        const inscriptos = Array.isArray(data.inscriptos) ? data.inscriptos : [];
        const cleanDni = String(student.dni || '').replace(/\D/g, '');
        const filtered = inscriptos.filter((ins) => {
          const insId = String(ins?.id || ins?.studentId || '').trim();
          const insDni = String(ins?.dni || '').replace(/\D/g, '');
          if (insId && insId === String(student.id).trim()) return false;
          if (cleanDni && insDni && insDni === cleanDni) return false;
          return true;
        });
        await updateDoc(sportRef, {
          inscriptos: filtered,
          cupoOcupado: filtered.length,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.warn('Aviso actualizando padrón deportivo:', err?.message);
    }

    return {
      student: { ...student, ...studentUpdates },
      immediate: true,
      message: `Baja inmediata de ${discipline.nombre} confirmada (cancelación dentro del mismo día de inscripción).`,
    };
  }

  // Baja programada para el 1º del mes siguiente
  const nextMonth = getNextMonthFirstDay(today);
  const nextSubs = {
    ...currentSubs,
    [discipline.id]: {
      ...subInfo,
      fechaInicio: startDate || getTodayDateString(today),
      bajaSolicitada: true,
      bajaProgramada: nextMonth.iso,
    },
  };

  const studentUpdates = {
    deportesSuscripciones: nextSubs,
    updatedAt: serverTimestamp(),
  };

  await updateDoc(doc(db, 'students', student.id), studentUpdates);

  return {
    student: { ...student, ...studentUpdates },
    immediate: false,
    effectiveDate: nextMonth.display,
    message: `Baja programada registrada para ${discipline.nombre}. Tendrá vigencia a partir del ${nextMonth.display} (solo un Administrador puede forzar la baja inmediata dentro del mes en curso).`,
  };
};

/**
 * Registra el "Visto del Tutor" en Asistencias, Enfermería o Preceptoría
 */
export const acknowledgeStudentRecord = async ({
  student,
  recordType, // 'attendance' | 'health' | 'preceptoria'
  recordId,
  tutorUser,
}) => {
  if (!student?.id || !recordId) return student;

  const tutorName = tutorUser?.nombre || tutorUser?.email || 'Tutor';
  const nowIso = new Date().toISOString();

  if (recordType === 'health') {
    const entries = Array.isArray(student.entradasEnfermeria) ? student.entradasEnfermeria : [];
    const updated = entries.map((item) =>
      String(item.id || item.fecha) === String(recordId)
        ? { ...item, vistoPorTutor: true, fechaVisto: nowIso, vistoPor: tutorName }
        : item
    );
    await updateDoc(doc(db, 'students', student.id), {
      entradasEnfermeria: updated,
      updatedAt: serverTimestamp(),
    });
    return { ...student, entradasEnfermeria: updated };
  }

  if (recordType === 'preceptoria') {
    const entries = Array.isArray(student.entradasPreceptoria) ? student.entradasPreceptoria : [];
    const updated = entries.map((item) =>
      String(item.id || item.fecha) === String(recordId)
        ? { ...item, vistoPorTutor: true, fechaVisto: nowIso, vistoPor: tutorName }
        : item
    );
    await updateDoc(doc(db, 'students', student.id), {
      entradasPreceptoria: updated,
      updatedAt: serverTimestamp(),
    });
    return { ...student, entradasPreceptoria: updated };
  }

  if (recordType === 'attendance') {
    const rawAsistencias =
      student.asistencias && typeof student.asistencias === 'object'
        ? student.asistencias
        : { historial: [] };
    const historial = Array.isArray(rawAsistencias.historial) ? rawAsistencias.historial : [];
    const updatedHistorial = historial.map((item) =>
      String(item.id || item.fecha) === String(recordId)
        ? { ...item, vistoPorTutor: true, fechaVisto: nowIso, vistoPor: tutorName }
        : item
    );
    const nextAsistencias = { ...rawAsistencias, historial: updatedHistorial };
    await updateDoc(doc(db, 'students', student.id), {
      asistencias: nextAsistencias,
      updatedAt: serverTimestamp(),
    });
    return { ...student, asistencias: nextAsistencias };
  }

  return student;
};

/**
 * Justifica una inasistencia subiendo el certificado médico a Firebase Storage
 * en justifications/{uid}/{studentId}_{absenceId}_{timestamp}_{fileName}
 */
export const justifyStudentAbsence = async ({
  student,
  absenceId,
  motivo,
  detalle,
  certificadoCodigo,
  fileAsset,
  tutorUser,
}) => {
  if (!student?.id || !absenceId) {
    throw new Error('Seleccione la inasistencia que desea justificar.');
  }

  const effectiveUid = auth.currentUser?.uid || tutorUser?.uid;
  const nowIso = new Date().toISOString();

  let uploadedInfo = null;
  if (fileAsset) {
    uploadedInfo = await uploadFileToFirebaseStorage({
      fileAsset,
      folder: 'justifications',
      userId: effectiveUid,
      prefix: `${student.id}_${absenceId}`,
      extraMetadata: {
        studentId: String(student.id),
        absenceId: String(absenceId),
        motivo: String(motivo || 'Consulta Médica'),
      },
    });
  }

  const rawAsistencias =
    student.asistencias && typeof student.asistencias === 'object'
      ? student.asistencias
      : { historial: [] };
  const historial = Array.isArray(rawAsistencias.historial) ? rawAsistencias.historial : [];

  const updatedHistorial = historial.map((item) => {
    if (String(item.id || item.fecha) === String(absenceId)) {
      return {
        ...item,
        tipo: 'Falta Justificada (En revisión)',
        estado: 'justificacion_pendiente',
        justificada: true,
        vistoPorTutor: true,
        fechaVisto: item.fechaVisto || nowIso,
        justificacion: {
          studentId: student.id,
          absenceId: String(absenceId),
          motivo: motivo || 'Consulta / Reposo Médico',
          detalle: detalle || 'Certificado adjunto por el tutor',
          certificado: certificadoCodigo || uploadedInfo?.fileName || 'CERT-MED',
          comprobanteNombre: uploadedInfo?.fileName || '',
          comprobanteTamanio: uploadedInfo?.fileSize || '',
          comprobanteUrl: uploadedInfo?.downloadUrl || '',
          comprobanteStoragePath: uploadedInfo?.storagePath || '',
          fechaPresentacion: nowIso,
          estado: 'En revisión por Preceptoría',
        },
      };
    }
    return item;
  });

  const faltasInjustificadas = updatedHistorial.filter(
    (h) =>
      h.estado === 'injustificada' ||
      String(h.tipo || '').toLowerCase().includes('injustificada')
  ).length;

  const faltasJustificadas = updatedHistorial.filter(
    (h) =>
      h.estado === 'justificada' ||
      h.estado === 'justificacion_pendiente' ||
      (String(h.tipo || '').toLowerCase().includes('justificada') &&
        !String(h.tipo || '').toLowerCase().includes('injustificada'))
  ).length;

  const nextAsistencias = {
    ...rawAsistencias,
    faltasInjustificadas,
    faltasJustificadas,
    historial: updatedHistorial,
  };

  await updateDoc(doc(db, 'students', student.id), {
    asistencias: nextAsistencias,
    updatedAt: serverTimestamp(),
  });

  return {
    ...student,
    asistencias: nextAsistencias,
  };
};
