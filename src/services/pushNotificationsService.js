import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import {
  getPermissionsAsync,
  requestPermissionsAsync,
} from 'expo-notifications/build/NotificationPermissions';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { getExpoPushTokenAsync } from 'expo-notifications/build/getExpoPushTokenAsync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const READ_NOTIFICATIONS_STORAGE_KEY = '@educar_transformar_read_notifications_v1';

try {
  setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (_err) {
  // Entorno web o simulador sin soporte nativo de handler
}

/**
 * Solicita permisos de notificaciones en el dispositivo, configura el canal Android
 * y registra el ExpoPushToken en el documento del usuario en Firestore (cuando no corre en Expo Go).
 */
export const registerForPushNotificationsAsync = async (user) => {
  try {
    if (Platform.OS === 'android') {
      await setNotificationChannelAsync('institutional-alerts', {
        name: 'Avisos Institucionales',
        importance: 4,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#EA580C',
      });
    }

    const existingPerms = await getPermissionsAsync();
    let finalStatus = existingPerms.status;

    if (finalStatus !== 'granted') {
      const requested = await requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // En Expo Go (SDK 53+) las notificaciones remotas están deshabilitadas;
    // solo se usan notificaciones locales en tiempo real (scheduleNotificationAsync).
    if (isRunningInExpoGo()) {
      return null;
    }

    let pushToken = null;
    try {
      const tokenResponse = await getExpoPushTokenAsync();
      pushToken = tokenResponse?.data || null;
    } catch (_tokenErr) {
      // En emulador sin projectId de EAS configurado, las notificaciones locales siguen operativas
    }

    const uid = auth.currentUser?.uid || user?.uid;
    if (pushToken && uid) {
      const roleLower = String(user?.role || '').toLowerCase();
      const isStudent = roleLower.includes('estudiante') || roleLower.includes('alumno');
      const targetCollection = isStudent ? 'students' : 'users';
      try {
        await updateDoc(doc(db, targetCollection, uid), {
          expoPushToken: pushToken,
          expoPushTokens: arrayUnion(pushToken),
          updatedAt: serverTimestamp(),
        });
      } catch (_saveErr) {
        // Ignorar si el documento no admite escritura del token
      }
    }

    return pushToken;
  } catch (_err) {
    return null;
  }
};

/**
 * Dispara una notificación push local inmediata en el sistema operativo (iOS / Android)
 * cuando ingresa un nuevo evento desde Firestore en tiempo real.
 */
export const triggerInstantPushNotification = async ({ title, body, data = {} }) => {
  try {
    await scheduleNotificationAsync({
      content: {
        title: String(title || 'Aviso Institucional'),
        body: String(body || ''),
        data,
        sound: 'default',
      },
      trigger: null,
    });
  } catch (_err) {
    // Continuar si el entorno no soporta notificaciones nativas
  }
};

export const loadReadNotificationIds = async (uid) => {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(`${READ_NOTIFICATIONS_STORAGE_KEY}_${uid}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
};

export const persistReadNotificationIds = async (uid, idsList = []) => {
  if (!uid) return;
  try {
    const unique = Array.from(new Set(idsList));
    await AsyncStorage.setItem(
      `${READ_NOTIFICATIONS_STORAGE_KEY}_${uid}`,
      JSON.stringify(unique)
    );
  } catch (_err) {
    // Ignorar error de almacenamiento local
  }
};

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

const extractTimestampFromId = (rawId) => {
  if (!rawId) return null;
  const match = String(rawId).match(/(\d{10,13})(?!.*\d)/);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return null;
  if (match[1].length === 10 && num >= 1000000000 && num < 10000000000) {
    return num * 1000;
  }
  if (match[1].length === 13 && num >= 1000000000000) {
    return num;
  }
  return null;
};

export const parseTimestampValue = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return value < 1e12 ? value * 1000 : value;
  }

  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') {
      const ms = value.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }
    if (typeof value.toDate === 'function') {
      const ms = value.toDate().getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return seconds * 1000 + Math.floor(nanoseconds / 1e6);
    }
    return null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d{10,13}$/.test(trimmed)) {
      const num = Number(trimmed);
      return trimmed.length === 10 ? num * 1000 : num;
    }

    const dmyMatch = trimmed.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
    );
    if (dmyMatch) {
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      const year = Number(dmyMatch[3]);
      const hour = dmyMatch[4] ? Number(dmyMatch[4]) : 0;
      const min = dmyMatch[5] ? Number(dmyMatch[5]) : 0;
      const sec = dmyMatch[6] ? Number(dmyMatch[6]) : 0;
      const d = new Date(year, month - 1, day, hour, min, sec);
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    }

    const ymdLocalMatch = trimmed.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );
    if (ymdLocalMatch) {
      const year = Number(ymdLocalMatch[1]);
      const month = Number(ymdLocalMatch[2]);
      const day = Number(ymdLocalMatch[3]);
      const hour = ymdLocalMatch[4] ? Number(ymdLocalMatch[4]) : 0;
      const min = ymdLocalMatch[5] ? Number(ymdLocalMatch[5]) : 0;
      const sec = ymdLocalMatch[6] ? Number(ymdLocalMatch[6]) : 0;
      const d = new Date(year, month - 1, day, hour, min, sec);
      return Number.isNaN(d.getTime()) ? null : d.getTime();
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

const resolveNotificationTimestampMs = (
  exactCandidates = [],
  dateStringCandidates = [],
  fallbackId = null
) => {
  for (const candidate of exactCandidates) {
    const ms = parseTimestampValue(candidate);
    if (ms !== null) return ms;
  }

  for (const candidate of dateStringCandidates) {
    if (typeof candidate === 'string' && candidate.includes(':')) {
      const ms = parseTimestampValue(candidate);
      if (ms !== null) return ms;
    }
  }

  const fromId = extractTimestampFromId(fallbackId);
  if (fromId !== null) return fromId;

  for (const candidate of dateStringCandidates) {
    const ms = parseTimestampValue(candidate);
    if (ms !== null) return ms;
  }

  return null;
};

/**
 * Formatea la marca de tiempo de una notificación:
 * - Si fue hace menos de 24hs: muestra minutos u horas ("Hace 5 min", "Hace 3 horas").
 * - Si ya pasó más de un día: muestra el día ("DD/MM/YYYY").
 */
export const formatNotificationTimestamp = (
  timestampMs,
  fallbackLabel = 'Reciente',
  nowMs = Date.now()
) => {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) {
    return fallbackLabel || 'Reciente';
  }

  const diffMs = Math.max(0, nowMs - timestampMs);

  if (diffMs < ONE_DAY_MS) {
    const diffMinutes = Math.floor(diffMs / ONE_MINUTE_MS);
    if (diffMinutes < 1) {
      return 'Hace un momento';
    }
    if (diffMinutes < 60) {
      return `Hace ${diffMinutes} min`;
    }
    const diffHours = Math.floor(diffMs / ONE_HOUR_MS);
    return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
  }

  const date = new Date(timestampMs);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const collectStudentAttendanceNotifications = (student, studentName, readSet, outList) => {
  const historial = Array.isArray(student?.asistencias?.historial)
    ? student.asistencias.historial
    : [];

  historial.forEach((item, idx) => {
    const itemId = item.id || item.fecha || `att-${idx}`;
    const baseNotifId = `notif-att-${student.id}-${itemId}`;
    const isRead = Boolean(item.vistoPorTutor) || readSet.has(baseNotifId);
    const tipoLabel = item.tipo || 'Inasistencia / Tardanza';
    const timestampMs = resolveNotificationTimestampMs(
      [item.createdAt, item.timestamp, item.fechaISO, item.updatedAt],
      [item.fecha],
      itemId
    );

    outList.push({
      id: baseNotifId,
      category: 'attendance',
      targetTab: 'academic',
      studentId: student.id,
      studentName,
      recordId: itemId,
      recordType: 'attendance',
      title: `Asistencia: ${tipoLabel} (${studentName})`,
      body: `${item.fecha || 'Fecha reciente'} · ${item.motivo || 'Registro de asistencia escolar'}`,
      timestampMs,
      dateLabel: formatNotificationTimestamp(timestampMs, item.fecha || 'Reciente'),
      isRead,
      read: isRead,
    });

    if (item.justificacion) {
      const justState = String(item.justificacion.estado || 'En revisión');
      const justLower = justState.toLowerCase();
      const isReviewed =
        justLower.includes('aprob') ||
        justLower.includes('justificad') ||
        justLower.includes('rechaz') ||
        justLower.includes('observ');

      if (isReviewed) {
        const justNotifId = `notif-just-${student.id}-${itemId}-${justLower}`;
        const isRejected = justLower.includes('rechaz') || justLower.includes('observ');
        const isJustRead = readSet.has(justNotifId);
        const justTimestampMs = resolveNotificationTimestampMs(
          [
            item.justificacion.fechaRevision,
            item.justificacion.updatedAt,
            item.justificacion.reviewedAt,
            item.justificacion.fechaPresentacion,
            item.updatedAt,
          ],
          [item.fecha],
          itemId
        );
        outList.push({
          id: justNotifId,
          category: isRejected ? 'justification_rejected' : 'justification_approved',
          targetTab: 'academic',
          studentId: student.id,
          studentName,
          title: isRejected
            ? `Justificación Observada (${studentName})`
            : `Inasistencia Justificada Aprobada (${studentName})`,
          body: `Falta del ${item.fecha || ''}: ${justState}${
            item.justificacion.observacionRevision
              ? ` — ${item.justificacion.observacionRevision}`
              : ''
          }`,
          timestampMs: justTimestampMs,
          dateLabel: formatNotificationTimestamp(justTimestampMs, item.fecha || 'Reciente'),
          isRead: isJustRead,
          read: isJustRead,
        });
      }
    }
  });
};

const collectStudentNursingNotifications = (student, studentName, readSet, outList) => {
  const entries = Array.isArray(student?.entradasEnfermeria)
    ? student.entradasEnfermeria
    : [];

  entries.forEach((enf, idx) => {
    const recId = enf.id || enf.fecha || `enf-${idx}`;
    const notifId = `notif-enf-${student.id}-${recId}`;
    const isRead = Boolean(enf.vistoPorTutor) || readSet.has(notifId);
    const symptom = enf.sintoma || enf.motivo || enf.titulo || 'Atención en gabinete';
    const care = enf.atencion || enf.descripcion || 'Control de enfermería escolar';
    const timestampMs = resolveNotificationTimestampMs(
      [enf.createdAt, enf.timestamp, enf.fechaISO, enf.updatedAt],
      [enf.fecha],
      recId
    );

    outList.push({
      id: notifId,
      category: 'nursing',
      targetTab: 'academic',
      studentId: student.id,
      studentName,
      recordId: recId,
      recordType: 'health',
      title: `Enfermería: ${symptom} (${studentName})`,
      body: `${care} · ${enf.profesional || enf.autor || 'Gabinete de Salud'}`,
      timestampMs,
      dateLabel: formatNotificationTimestamp(timestampMs, enf.fecha || 'Reciente'),
      isRead,
      read: isRead,
    });
  });
};

const collectStudentPreceptoriaNotifications = (student, studentName, readSet, outList) => {
  const entries = Array.isArray(student?.entradasPreceptoria)
    ? student.entradasPreceptoria
    : [];

  entries.forEach((prec, idx) => {
    const recId = prec.id || prec.fecha || `prec-${idx}`;
    const notifId = `notif-prec-${student.id}-${recId}`;
    const isRead = Boolean(prec.vistoPorTutor) || readSet.has(notifId);
    const kind = prec.tipo || prec.categoria || prec.titulo || 'Seguimiento';
    const detail = prec.motivo || prec.descripcion || 'Observación de convivencia escolar';
    const timestampMs = resolveNotificationTimestampMs(
      [prec.createdAt, prec.timestamp, prec.fechaISO, prec.updatedAt],
      [prec.fecha],
      recId
    );

    outList.push({
      id: notifId,
      category: 'preceptoria',
      targetTab: 'academic',
      studentId: student.id,
      studentName,
      recordId: recId,
      recordType: 'preceptoria',
      title: `Preceptoría: ${kind} (${studentName})`,
      body: detail,
      timestampMs,
      dateLabel: formatNotificationTimestamp(timestampMs, prec.fecha || 'Reciente'),
      isRead,
      read: isRead,
    });
  });
};

const collectVoucherStatusNotifications = (
  financeReceipts,
  user,
  studentIdsSet,
  readSet,
  outList
) => {
  const uid = auth.currentUser?.uid || user?.uid;
  const cleanUserDni = String(user?.dni || '').replace(/\D/g, '');

  (financeReceipts || []).forEach((r) => {
    const matchesTutor =
      (uid && (r.tutorUid === uid || r.parentId === uid)) ||
      (cleanUserDni && String(r.tutorDni || '').replace(/\D/g, '') === cleanUserDni);
    const rChildrenIds = Array.isArray(r.children) ? r.children.map((c) => String(c.id)) : [];
    const rStudentIds = Array.isArray(r.studentIds) ? r.studentIds.map(String) : [];
    const matchesChild =
      rChildrenIds.some((id) => studentIdsSet.has(id)) ||
      rStudentIds.some((id) => studentIdsSet.has(id));

    if (!matchesTutor && !matchesChild) return;

    const hasTutorUpload =
      Boolean(r.bankingVoucher?.isUploadedByTutor) ||
      (Array.isArray(r.vouchersHistory) && r.vouchersHistory.length > 0);
    if (!hasTutorUpload) return;

    const status = String(r.status || '').toLowerCase();
    const timestampMs = resolveNotificationTimestampMs(
      [r.reconciledAt, r.reviewedAt, r.rejectedAt, r.updatedAt, r.createdAt],
      [r.bankingVoucher?.issuedAt, r.uploadDate],
      r.id
    );

    if (status === 'aprobado' || status === 'conciliado') {
      const notifId = `notif-vch-approved-${r.id}-${r.receiptNumber || 'ok'}`;
      const isRead = readSet.has(notifId);
      outList.push({
        id: notifId,
        category: 'voucher_approved',
        targetTab: 'billing',
        period: r.month || r.invoicePeriod,
        title: `Comprobante Aprobado — ${r.month || r.invoicePeriod}`,
        body: `Su pago fue conciliado por Administración${
          r.receiptNumber ? ` (Recibo ${r.receiptNumber})` : ''
        }.`,
        timestampMs,
        dateLabel: formatNotificationTimestamp(timestampMs, r.uploadDate || r.month || 'Reciente'),
        isRead,
        read: isRead,
      });
    } else if (status === 'rechazado') {
      const reasonKey = String(r.rejectionReason || 'obs').slice(0, 24);
      const notifId = `notif-vch-rejected-${r.id}-${reasonKey}`;
      const isRead = readSet.has(notifId);
      outList.push({
        id: notifId,
        category: 'voucher_rejected',
        targetTab: 'billing',
        period: r.month || r.invoicePeriod,
        title: `Comprobante Observado — ${r.month || r.invoicePeriod}`,
        body: r.rejectionReason
          ? `Motivo: ${r.rejectionReason}. Puede adjuntar documentación respaldatoria.`
          : 'El comprobante fue observado por Administración. Revise el detalle del mes.',
        timestampMs,
        dateLabel: formatNotificationTimestamp(timestampMs, r.uploadDate || r.month || 'Reciente'),
        isRead,
        read: isRead,
      });
    }
  });
};

const collectDirectFirestoreNotifications = (
  directNotifications,
  user,
  studentIdsSet,
  readSet,
  outList
) => {
  const uid = auth.currentUser?.uid || user?.uid;
  (directNotifications || []).forEach((n) => {
    const forUser = uid && (n.recipientUid === uid || n.parentId === uid || n.tutorUid === uid);
    const forStudent = n.studentId && studentIdsSet.has(String(n.studentId));
    if (!forUser && !forStudent) return;

    const notifId = `notif-doc-${n.id}`;
    const isRead = Boolean(n.read || n.leida) || readSet.has(notifId);
    const timestampMs = resolveNotificationTimestampMs(
      [n.createdAt, n.timestamp, n.fechaISO, n.updatedAt],
      [n.fecha, n.dateLabel],
      n.id
    );
    outList.push({
      id: notifId,
      firestoreDocId: n.id,
      category: n.category || n.type || 'institutional',
      targetTab: n.targetTab || (String(n.type || '').includes('voucher') ? 'billing' : 'academic'),
      studentId: n.studentId || null,
      title: n.title || n.titulo || 'Notificación Institucional',
      body: n.body || n.mensaje || n.detalle || '',
      timestampMs,
      dateLabel: formatNotificationTimestamp(timestampMs, n.dateLabel || n.fecha || 'Reciente'),
      isRead,
      read: isRead,
    });
  });
};

/**
 * Construye el listado unificado de notificaciones para el centro de avisos (campana)
 * y para la detección de alertas push en tiempo real, ordenado de la más reciente a la más antigua.
 */
export const buildInstitutionalNotificationsFeed = ({
  user,
  linkedStudents = [],
  financeReceipts = [],
  directNotifications = [],
  readIds = [],
  readIdsSet,
}) => {
  const readSet =
    readIdsSet instanceof Set
      ? readIdsSet
      : new Set(Array.isArray(readIds) ? readIds : []);
  const studentIdsSet = new Set((linkedStudents || []).map((s) => String(s.id)));
  const notifications = [];

  collectDirectFirestoreNotifications(
    directNotifications,
    user,
    studentIdsSet,
    readSet,
    notifications
  );

  (linkedStudents || []).forEach((student) => {
    const studentName =
      student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim();
    collectStudentNursingNotifications(student, studentName, readSet, notifications);
    collectStudentPreceptoriaNotifications(student, studentName, readSet, notifications);
    collectStudentAttendanceNotifications(student, studentName, readSet, notifications);
  });

  collectVoucherStatusNotifications(
    financeReceipts,
    user,
    studentIdsSet,
    readSet,
    notifications
  );

  notifications.sort((a, b) => {
    const tsA = Number.isFinite(a.timestampMs) ? a.timestampMs : 0;
    const tsB = Number.isFinite(b.timestampMs) ? b.timestampMs : 0;
    if (tsB !== tsA) {
      return tsB - tsA;
    }
    return String(b.id || '').localeCompare(String(a.id || ''));
  });

  return notifications;
};
