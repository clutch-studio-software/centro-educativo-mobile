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

const collectStudentAttendanceNotifications = (student, studentName, readSet, outList) => {
  const historial = Array.isArray(student?.asistencias?.historial)
    ? student.asistencias.historial
    : [];

  historial.forEach((item, idx) => {
    const itemId = item.id || item.fecha || `att-${idx}`;
    const baseNotifId = `notif-att-${student.id}-${itemId}`;
    const isRead = Boolean(item.vistoPorTutor) || readSet.has(baseNotifId);
    const tipoLabel = item.tipo || 'Inasistencia / Tardanza';

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
      dateLabel: item.fecha || 'Reciente',
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
          dateLabel: item.fecha || 'Reciente',
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
      dateLabel: enf.fecha || 'Reciente',
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
      dateLabel: prec.fecha || 'Reciente',
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
        dateLabel: r.uploadDate || r.month || 'Reciente',
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
        dateLabel: r.uploadDate || r.month || 'Reciente',
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
    outList.push({
      id: notifId,
      firestoreDocId: n.id,
      category: n.category || n.type || 'institutional',
      targetTab: n.targetTab || (String(n.type || '').includes('voucher') ? 'billing' : 'academic'),
      studentId: n.studentId || null,
      title: n.title || n.titulo || 'Notificación Institucional',
      body: n.body || n.mensaje || n.detalle || '',
      dateLabel: n.dateLabel || n.fecha || 'Reciente',
      isRead,
      read: isRead,
    });
  });
};

/**
 * Construye el listado unificado de notificaciones para el centro de avisos (campana)
 * y para la detección de alertas push en tiempo real.
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

  return notifications;
};
