import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import {
  TRANSPORT_ROUTES,
  INITIAL_DISCIPLINES,
  calculateMonthlyProportional,
  matchTransportRoute,
} from '../utils/subscriptionRules';
import { isStudentEnrolledInDiscipline } from './servicesMobileService';
import { uploadFileToFirebaseStorage } from './storageMobileService';

const DEFAULT_LEVEL_PRICES = {
  inicial: 52000,
  primario: 65000,
  secundario: 74500,
};

const DEFAULT_DINING_PRICE = 45000;

const DEFAULT_ROUTE_PRICES = {
  r1: 38000,
  'recorrido 1': 38000,
  r2: 40000,
  'recorrido 2': 40000,
  r3: 36000,
  'recorrido 3': 36000,
  r4: 42000,
  'recorrido 4': 42000,
};

const DEFAULT_SPORT_PRICES = {
  'disc-1': 15000,
  'disc-2': 22000,
  'disc-3': 16500,
  'disc-4': 17500,
  'disc-5': 15500,
  'disc-6': 16000,
  'disc-7': 16500,
  'disc-8': 13500,
};

export const resolveSelectedItems = (bv, matchingReceipt) => {
  if (Array.isArray(bv?.selectedItems)) return bv.selectedItems;
  if (Array.isArray(matchingReceipt?.selectedItems)) return matchingReceipt.selectedItems;
  return [];
};

const isVoucherRejectedStatus = (voucherStatus) => {
  const s = String(voucherStatus || '').toLowerCase();
  return s.includes('rechaz') || s.includes('observ');
};

const resolveVoucherStatusLabel = (rawVoucherStatus, receiptStatus, defaultPendingLabel) => {
  if (isVoucherRejectedStatus(rawVoucherStatus)) {
    return rawVoucherStatus;
  }
  if (rawVoucherStatus === 'Conciliado OK') {
    return rawVoucherStatus;
  }
  if (receiptStatus === 'aprobado' || receiptStatus === 'conciliado') {
    return 'Conciliado OK';
  }
  if (receiptStatus === 'rechazado') {
    return 'Rechazado';
  }
  return rawVoucherStatus || defaultPendingLabel;
};

const resolveStudentVoucherStatus = (svStatus, receiptStatus) => {
  if (svStatus === 'aprobado' || svStatus === 'conciliado') {
    return 'Conciliado OK';
  }
  if (svStatus === 'rechazado' || svStatus === 'observado' || receiptStatus === 'rechazado') {
    return 'Rechazado';
  }
  return 'Pendiente de conciliación';
};

const collectStudentVouchers = (
  targetStudents,
  periodLabel,
  defaultDueDate,
  receiptStatus,
  vouchersMap
) => {
  targetStudents.forEach((st) => {
    const stVouchers = Array.isArray(st.comprobantesPago) ? st.comprobantesPago : [];
    stVouchers.forEach((sv, idx) => {
      if (String(sv.invoicePeriod || '').toLowerCase() === periodLabel.toLowerCase()) {
        const key = sv.id || sv.storagePath || sv.fileUrl || sv.operationCode || `sv-${st.id}-${idx}`;
        if (!vouchersMap.has(key)) {
          vouchersMap.set(key, {
            id: sv.id || key,
            operationCode: sv.operationCode || 'TRF-ALU',
            originBank: sv.originBank || 'Transferencia Bancaria',
            operationDate: sv.uploadDate || defaultDueDate,
            transferredAmount: Number(sv.declaredAmount) || 0,
            selectedItems: Array.isArray(sv.selectedItems) ? sv.selectedItems : [],
            selectedItemLabels: Array.isArray(sv.selectedItemLabels) ? sv.selectedItemLabels : [],
            fileName: sv.fileName || 'comprobante.pdf',
            fileSize: sv.fileSize || '',
            fileUrl: sv.fileUrl || '',
            storagePath: sv.storagePath || '',
            voucherStatus: resolveStudentVoucherStatus(sv.status, receiptStatus),
          });
        }
      }
    });
  });
};

const collectReceiptVouchers = (matchingReceipt, defaultDueDate, vouchersMap) => {
  if (!matchingReceipt) return;

  if (Array.isArray(matchingReceipt.vouchersHistory)) {
    matchingReceipt.vouchersHistory.forEach((vh, idx) => {
      const key = vh.id || vh.storagePath || vh.fileUrl || vh.operationCode || `vh-${idx}`;
      if (!vouchersMap.has(key)) {
        vouchersMap.set(key, {
          id: vh.id || key,
          operationCode: vh.operationCode || `TRF-${idx + 1}`,
          originBank: vh.originBank || 'Transferencia Bancaria',
          operationDate: vh.operationDate || matchingReceipt.uploadDate || defaultDueDate,
          transferredAmount: Number(vh.transferredAmount || vh.declaredAmount) || 0,
          selectedItems: Array.isArray(vh.selectedItems) ? vh.selectedItems : [],
          selectedItemLabels: Array.isArray(vh.selectedItemLabels) ? vh.selectedItemLabels : [],
          fileName: vh.attachmentName || vh.fileName || 'comprobante.pdf',
          fileSize: vh.attachmentSize || vh.fileSize || '',
          fileUrl: vh.fileUrl || vh.downloadUrl || '',
          storagePath: vh.storagePath || '',
          voucherStatus: resolveVoucherStatusLabel(
            vh.voucherStatus,
            matchingReceipt.status,
            'En revisión'
          ),
        });
      }
    });
  }

  if (matchingReceipt.bankingVoucher) {
    const bv = matchingReceipt.bankingVoucher;
    const key =
      bv.id ||
      bv.storagePath ||
      bv.fileUrl ||
      bv.operationCode ||
      bv.attachmentName ||
      `bv-${matchingReceipt.id}`;
    if (!vouchersMap.has(key)) {
      vouchersMap.set(key, {
        id: key,
        operationCode: bv.operationCode || matchingReceipt.receiptNumber || 'TRF-REG',
        originBank: bv.originBank || bv.paymentType || 'Transferencia Bancaria',
        operationDate: bv.operationDate || matchingReceipt.uploadDate || defaultDueDate,
        transferredAmount: Number(bv.transferredAmount || matchingReceipt.declaredAmount) || 0,
        selectedItems: resolveSelectedItems(bv, matchingReceipt),
        selectedItemLabels: Array.isArray(bv.selectedItemLabels) ? bv.selectedItemLabels : [],
        fileName: bv.attachmentName || 'comprobante.pdf',
        fileSize: bv.attachmentSize || '',
        fileUrl: bv.fileUrl || bv.downloadUrl || '',
        storagePath: bv.storagePath || '',
        voucherStatus: resolveVoucherStatusLabel(
          bv.voucherStatus,
          matchingReceipt.status,
          'Pendiente de conciliación'
        ),
      });
    }
  }
};

const getReceiptTimestampScore = (r) => {
  if (r?.updatedAt?.seconds) return r.updatedAt.seconds * 1000;
  if (typeof r?.updatedAt === 'number') return r.updatedAt;
  const idMatch = String(r?.id || '').match(/-(\d{10,14})$/);
  if (idMatch) return Number(idMatch[1]);
  return 0;
};

const findMatchingReceiptsForPeriod = (receiptsFromFirestore, periodLabel, studentIdSet) => {
  const matches = (receiptsFromFirestore || []).filter((r) => {
    const rMonth = String(r.month || r.invoicePeriod || '').toLowerCase();
    if (rMonth !== periodLabel.toLowerCase()) return false;

    const rStudentIds = Array.isArray(r.studentIds) ? r.studentIds.map(String) : [];
    const rChildrenIds = Array.isArray(r.children) ? r.children.map((c) => String(c.id)) : [];
    return (
      rStudentIds.some((id) => studentIdSet.has(id)) ||
      rChildrenIds.some((id) => studentIdSet.has(id))
    );
  });

  return matches.sort((a, b) => getReceiptTimestampScore(b) - getReceiptTimestampScore(a));
};

const collectAssociatedVouchers = (matchingReceipts, targetStudents, periodMeta) => {
  const vouchersMap = new Map();
  const primaryStatus = matchingReceipts[0]?.status || null;
  matchingReceipts.forEach((receipt) => {
    collectReceiptVouchers(receipt, periodMeta.dueDate, vouchersMap);
  });
  collectStudentVouchers(
    targetStudents,
    periodMeta.label,
    periodMeta.dueDate,
    primaryStatus,
    vouchersMap
  );
  return Array.from(vouchersMap.values());
};

const collectVoucherItemSets = (associatedVouchers) => {
  const paidItemIdsSet = new Set();
  const rejectedItemIdsSet = new Set();
  let validTransferredSum = 0;

  associatedVouchers.forEach((v) => {
    const isRejected = isVoucherRejectedStatus(v.voucherStatus);
    const items = Array.isArray(v.selectedItems) ? v.selectedItems : [];
    if (isRejected) {
      items.forEach((itemId) => rejectedItemIdsSet.add(itemId));
      return;
    }
    items.forEach((itemId) => paidItemIdsSet.add(itemId));
    validTransferredSum += Number(v.transferredAmount) || 0;
  });

  return { paidItemIdsSet, rejectedItemIdsSet, validTransferredSum };
};

const resolveEnrichedInvoiceItem = ({
  item,
  paidItemIdsSet,
  rejectedItemIdsSet,
  validTransferredSum,
  totalInvoiceAmount,
  isApprovedInFirestore,
  isRejectedInFirestore,
  validVouchersCount,
}) => {
  const isCoveredBySelection = paidItemIdsSet.has(item.id);
  const isCoveredByFullTransfer =
    paidItemIdsSet.size === 0 &&
    validTransferredSum >= totalInvoiceAmount &&
    totalInvoiceAmount > 0 &&
    !isRejectedInFirestore;
  const isPaidOrInReview = isCoveredBySelection || isCoveredByFullTransfer;

  let itemStatus = 'pendiente_pago'; // 'conciliado' | 'en_revision' | 'observado' | 'pendiente_pago'
  if (isApprovedInFirestore && isPaidOrInReview) {
    itemStatus = 'conciliado';
  } else if (isPaidOrInReview && validVouchersCount > 0) {
    itemStatus = 'en_revision';
  } else if (isRejectedInFirestore || rejectedItemIdsSet.has(item.id)) {
    itemStatus = 'observado';
  }

  return {
    ...item,
    itemStatus,
    isPaidOrInReview,
    pendingAmount: isPaidOrInReview ? 0 : item.amount,
  };
};

const normalizePreviousHistoryForResubmission = (prevHistory, wasReceiptRejected) => {
  if (!wasReceiptRejected) return prevHistory;
  return prevHistory.map((vh) => {
    if (vh.voucherStatus === 'Conciliado OK' || isVoucherRejectedStatus(vh.voucherStatus)) {
      return vh;
    }
    return {
      ...vh,
      voucherStatus: 'Observado en envío anterior',
    };
  });
};

const resolveInvoiceStatus = (matchingReceipt, isApprovedInFirestore, pendingBalance, coveredAmount, associatedVouchersCount) => {
  if (matchingReceipt?.status === 'rechazado') {
    return {
      status: 'rechazado',
      statusLabel: 'Rechazado',
    };
  }
  if (isApprovedInFirestore && pendingBalance === 0) {
    return {
      status: 'conciliado',
      statusLabel: 'Aprobado',
    };
  }
  if (associatedVouchersCount > 0 && pendingBalance > 0 && coveredAmount > 0) {
    return {
      status: 'pago_parcial',
      statusLabel: `Pago Parcial`,
    };
  }
  if (associatedVouchersCount > 0 && pendingBalance === 0) {
    return {
      status: 'pendiente',
      statusLabel: 'En Revisión',
    };
  }
  if (associatedVouchersCount > 0) {
    return {
      status: 'pendiente',
      statusLabel: 'En Revisión',
    };
  }
  return {
    status: 'sin_comprobante',
    statusLabel: 'Pendiente',
  };
};

export const BILLING_PERIODS_CATALOG = [
  { label: 'Noviembre 2026', monthNum: '11', year: 2026, dueDate: '10/11/2026', isoStart: '2026-11-01', isoEnd: '2026-11-30' },
  { label: 'Octubre 2026', monthNum: '10', year: 2026, dueDate: '10/10/2026', isoStart: '2026-10-01', isoEnd: '2026-10-31' },
  { label: 'Septiembre 2026', monthNum: '09', year: 2026, dueDate: '10/09/2026', isoStart: '2026-09-01', isoEnd: '2026-09-30' },
  { label: 'Agosto 2026', monthNum: '08', year: 2026, dueDate: '10/08/2026', isoStart: '2026-08-01', isoEnd: '2026-08-31' },
  { label: 'Julio 2026', monthNum: '07', year: 2026, dueDate: '10/07/2026', isoStart: '2026-07-01', isoEnd: '2026-07-31' },
  { label: 'Junio 2026', monthNum: '06', year: 2026, dueDate: '10/06/2026', isoStart: '2026-06-01', isoEnd: '2026-06-30' },
];

const slugify = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const cleanDni = (val) => String(val || '').replace(/\D/g, '');

/**
 * Extrae y normaliza el cuadro tarifario oficial desde tariffs_config/current
 */
export const resolveOfficialTariffs = (tariffsConfig = null) => {
  const levels = { ...DEFAULT_LEVEL_PRICES };
  const rawLevels = tariffsConfig?.tariffs?.academicLevels;
  if (Array.isArray(rawLevels)) {
    rawLevels.forEach((l) => {
      const id = String(l.id || l.name || '').toLowerCase();
      const amount = Number(l.amount);
      if (amount > 0) {
        if (id.includes('ini')) levels.inicial = amount;
        else if (id.includes('sec')) levels.secundario = amount;
        else if (id.includes('pri')) levels.primario = amount;
      }
    });
  } else if (tariffsConfig?.academicLevels && typeof tariffsConfig.academicLevels === 'object') {
    if (Number(tariffsConfig.academicLevels.inicial) > 0) {
      levels.inicial = Number(tariffsConfig.academicLevels.inicial);
    }
    if (Number(tariffsConfig.academicLevels.primario) > 0) {
      levels.primario = Number(tariffsConfig.academicLevels.primario);
    }
    if (Number(tariffsConfig.academicLevels.secundario) > 0) {
      levels.secundario = Number(tariffsConfig.academicLevels.secundario);
    }
  }

  let diningPrice = DEFAULT_DINING_PRICE;
  const rawDining = tariffsConfig?.tariffs?.dining;
  if (Array.isArray(rawDining) && rawDining.length > 0) {
    const firstAmount = Number(rawDining[0].amount);
    if (firstAmount > 0) diningPrice = firstAmount;
  }

  const transportPrices = { ...DEFAULT_ROUTE_PRICES };
  const rawTransport = tariffsConfig?.tariffs?.transport;
  if (Array.isArray(rawTransport)) {
    rawTransport.forEach((r, idx) => {
      const amount = Number(r.amount);
      if (amount > 0) {
        const keyId = String(r.id || '').toLowerCase();
        const keyCode = String(r.code || `r${idx + 1}`).toLowerCase();
        const keyName = String(r.name || '').toLowerCase();
        if (keyId) transportPrices[keyId] = amount;
        if (keyCode) transportPrices[keyCode] = amount;
        if (keyName) transportPrices[keyName] = amount;
        transportPrices[`recorrido ${idx + 1}`] = amount;
        transportPrices[`r${idx + 1}`] = amount;
      }
    });
  }

  const sportsPrices = {
    ...DEFAULT_SPORT_PRICES,
    ...(tariffsConfig?.sportsPrices || {}),
  };

  return {
    levels,
    diningPrice,
    transportPrices,
    sportsPrices,
  };
};

/**
 * Obtiene el valor diferenciado de un recorrido de transporte
 */
export const getRouteMonthlyPrice = (routeKey, tariffsConfig = null) => {
  const { transportPrices } = resolveOfficialTariffs(tariffsConfig);
  const matched = matchTransportRoute(routeKey, TRANSPORT_ROUTES);
  if (matched) {
    const byCode = transportPrices[String(matched.code).toLowerCase()];
    const byId = transportPrices[String(matched.id).toLowerCase()];
    if (Number(byCode) > 0) return Number(byCode);
    if (Number(byId) > 0) return Number(byId);
    if (Number(matched.defaultAmount) > 0) return Number(matched.defaultAmount);
  }
  const rawKey = String(routeKey || '').trim().toLowerCase();
  return Number(transportPrices[rawKey]) || 38000;
};

/**
 * Obtiene el valor diferenciado de una disciplina deportiva
 */
export const getSportMonthlyPrice = (discipline, tariffsConfig = null) => {
  if (!discipline) return 15000;
  const { sportsPrices } = resolveOfficialTariffs(tariffsConfig);
  const byId = Number(sportsPrices[discipline.id]);
  if (byId > 0) return byId;
  const byName = Number(sportsPrices[discipline.nombre]);
  if (byName > 0) return byName;
  const byPriceField = Number(discipline.precioMensual || discipline.price || discipline.defaultPrice);
  if (byPriceField > 0) return byPriceField;
  return 15500;
};

/**
 * Calcula todos los ítems de pago de un alumno para un período dado (con soporte de proporcional por alta)
 */
export const calculateStudentItemizedFees = ({
  student,
  tariffsConfig = null,
  allDisciplines = INITIAL_DISCIPLINES,
  referenceDate = new Date(),
}) => {
  if (!student) return { items: [], totalAmount: 0 };

  const { levels, diningPrice } = resolveOfficialTariffs(tariffsConfig);
  const rawNivel = String(student.nivel || student.curso || '').toLowerCase();

  let baseAmount = levels.primario;
  let nivelLabel = 'Nivel Primario';
  if (rawNivel.includes('ini') || rawNivel.includes('sala') || rawNivel.includes('jardin')) {
    baseAmount = levels.inicial;
    nivelLabel = 'Nivel Inicial';
  } else if (rawNivel.includes('sec') || rawNivel.includes('año')) {
    baseAmount = levels.secundario;
    nivelLabel = 'Nivel Secundario';
  }

  const items = [
    {
      id: `fee-base-${student.id}`,
      studentId: student.id,
      studentName: student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim(),
      category: 'cuota',
      label: `Cuota Curricular (${nivelLabel})`,
      amount: baseAmount,
      fullMonthlyAmount: baseAmount,
      isProportional: false,
      detail: `${student.curso || nivelLabel} · División ${student.division || 'A'}`,
    },
  ];

  // 1. Transporte Escolar (si está activo)
  const servicios = Array.isArray(student.servicios) ? student.servicios : [];
  const hasTransport =
    Boolean(student.recorridoTransporte) ||
    servicios.some((s) => String(s).toLowerCase().includes('transporte'));

  if (hasTransport) {
    const matchedRoute = matchTransportRoute(student.recorridoTransporte, TRANSPORT_ROUTES);
    const routeName = matchedRoute?.nombre || student.recorridoTransporte || 'Recorrido 1 - Zona Norte';
    const monthlyRouteRate = getRouteMonthlyPrice(student.recorridoTransporte || 'r1', tariffsConfig);
    const prop = calculateMonthlyProportional({
      startDate: student.transporteFechaInicio,
      monthlyRate: monthlyRouteRate,
      referenceDate,
    });

    items.push({
      id: `fee-transport-${student.id}`,
      studentId: student.id,
      studentName: student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim(),
      category: 'transporte',
      label: `Transporte Escolar (${routeName})`,
      amount: prop.proportionalAmount,
      fullMonthlyAmount: monthlyRouteRate,
      isProportional: prop.isProportional,
      proportionalInfo: prop,
      detail: prop.isProportional
        ? `Proporcional ${prop.activeDays}/${prop.daysInMonth} días (Alta: ${student.transporteFechaInicio})`
        : `Tarifa mensual completa (${matchedRoute?.vehiculo || 'Sprinter 15 plazas'})`,
    });
  }

  // 2. Comedor Escolar (si está activo)
  const hasDining =
    Boolean(student.comedor) ||
    servicios.some((s) => String(s).toLowerCase().includes('comedor'));

  if (hasDining) {
    const prop = calculateMonthlyProportional({
      startDate: student.comedorFechaInicio,
      monthlyRate: diningPrice,
      referenceDate,
    });

    items.push({
      id: `fee-dining-${student.id}`,
      studentId: student.id,
      studentName: student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim(),
      category: 'comedor',
      label: 'Comedor Escolar Mensual',
      amount: prop.proportionalAmount,
      fullMonthlyAmount: diningPrice,
      isProportional: prop.isProportional,
      proportionalInfo: prop,
      detail: prop.isProportional
        ? `Proporcional ${prop.activeDays}/${prop.daysInMonth} días (Alta: ${student.comedorFechaInicio})`
        : 'Plan nutricional de jornada extendida',
    });
  }

  // 3. Deportes Extracurriculares (hasta 2 deportes activos con precios diferenciados)
  const pool = Array.isArray(allDisciplines) && allDisciplines.length > 0
    ? allDisciplines
    : INITIAL_DISCIPLINES;

  const enrolledSports = pool.filter((disc) => isStudentEnrolledInDiscipline(student, disc));
  enrolledSports.forEach((disc) => {
    const monthlySportRate = getSportMonthlyPrice(disc, tariffsConfig);
    const subInfo = student.deportesSuscripciones?.[disc.id] || {};
    const sportStartDate = subInfo.fechaInicio || student.deporteFechaInicio;
    const prop = calculateMonthlyProportional({
      startDate: sportStartDate,
      monthlyRate: monthlySportRate,
      referenceDate,
    });

    items.push({
      id: `fee-sport-${disc.id}-${student.id}`,
      studentId: student.id,
      studentName: student.nombreCompleto || `${student.nombre || ''} ${student.apellido || ''}`.trim(),
      category: 'deporte',
      disciplineId: disc.id,
      label: `Deporte: ${disc.nombre}`,
      amount: prop.proportionalAmount,
      fullMonthlyAmount: monthlySportRate,
      isProportional: prop.isProportional,
      proportionalInfo: prop,
      detail: prop.isProportional
        ? `Proporcional ${prop.activeDays}/${prop.daysInMonth} días · ${disc.horario || ''}`
        : `${disc.horario || 'Turno tarde'} · ${disc.profesor?.nombre || 'Docente'}`,
    });
  });

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  return { items, totalAmount };
};

/**
 * Construye el estado de cuenta detallado de un alumno o familia cruzando
 * finance_receipts en Firestore, comprobantesPago del alumno y el cuadro tarifario actual.
 * Soporta filtrado por rango de fechas (fromDate, toDate) y múltiples comprobantes por factura.
 */
export const buildBillingInvoicesAndDebtReport = ({
  students = [],
  receiptsFromFirestore = [],
  tariffsConfig = null,
  allDisciplines = INITIAL_DISCIPLINES,
  selectedStudentId = 'all',
  dateFrom = '2026-03-01',
  dateTo = '2026-12-31',
}) => {
  const targetStudents =
    selectedStudentId && selectedStudentId !== 'all'
      ? students.filter((s) => String(s.id) === String(selectedStudentId))
      : students;

  const invoices = BILLING_PERIODS_CATALOG.map((periodMeta) => {
    // Buscar si existen documentos en finance_receipts para este período y familia/alumno
    const studentIdSet = new Set(targetStudents.map((s) => String(s.id)));
    const matchingReceipts = findMatchingReceiptsForPeriod(
      receiptsFromFirestore,
      periodMeta.label,
      studentIdSet
    );
    const matchingReceipt = matchingReceipts[0] || null;
    const rejectionReasonFromHistory =
      matchingReceipts.find((r) => r.rejectionReason)?.rejectionReason || null;

    // Calcular desglose de ítems por cada alumno objetivo
    const refDate = new Date(`${periodMeta.isoStart}T12:00:00`);
    const childrenBreakdowns = targetStudents.map((st) => {
      const calc = calculateStudentItemizedFees({
        student: st,
        tariffsConfig,
        allDisciplines,
        referenceDate: refDate,
      });
      return {
        studentId: st.id,
        studentName: st.nombreCompleto || `${st.nombre || ''} ${st.apellido || ''}`.trim(),
        legajo: st.legajo || st.studentID_login || st.id,
        curso: `${st.curso || ''} ${st.division || ''}`.trim(),
        items: calc.items,
        subtotal: calc.totalAmount,
      };
    });

    const allItems = childrenBreakdowns.flatMap((cb) => cb.items);
    const totalInvoiceAmount = allItems.reduce((sum, i) => sum + i.amount, 0);

    // Recopilar todos los comprobantes asociados a esta factura
    const associatedVouchers = collectAssociatedVouchers(
      matchingReceipts,
      targetStudents,
      periodMeta
    );

    const isApprovedInFirestore =
      matchingReceipt?.status === 'aprobado' || matchingReceipt?.status === 'conciliado';
    const isRejectedInFirestore = matchingReceipt?.status === 'rechazado';

    const { paidItemIdsSet, rejectedItemIdsSet, validTransferredSum } =
      collectVoucherItemSets(associatedVouchers);

    const validVouchersCount = associatedVouchers.filter(
      (v) => !isVoucherRejectedStatus(v.voucherStatus)
    ).length;

    // Si en Firestore figura aprobado/conciliado para un mes pasado y cubre el monto, todos los ítems están pagados
    if (isApprovedInFirestore && paidItemIdsSet.size === 0) {
      allItems.forEach((item) => paidItemIdsSet.add(item.id));
    }

    const enrichedItems = allItems.map((item) =>
      resolveEnrichedInvoiceItem({
        item,
        paidItemIdsSet,
        rejectedItemIdsSet,
        validTransferredSum,
        totalInvoiceAmount,
        isApprovedInFirestore,
        isRejectedInFirestore,
        validVouchersCount,
      })
    );

    const pendingItems = enrichedItems.filter((i) => !i.isPaidOrInReview);
    const pendingBalance = pendingItems.reduce((sum, i) => sum + i.amount, 0);
    const coveredAmount = totalInvoiceAmount - pendingBalance;

    const { status, statusLabel } = resolveInvoiceStatus(
      matchingReceipt,
      isApprovedInFirestore,
      pendingBalance,
      coveredAmount,
      validVouchersCount
    );

    return {
      id: matchingReceipt?.id || `inv-${periodMeta.monthNum}-${periodMeta.year}`,
      period: periodMeta.label,
      dueDate: periodMeta.dueDate,
      isoStart: periodMeta.isoStart,
      isoEnd: periodMeta.isoEnd,
      status,
      statusLabel,
      receiptNumber: matchingReceipt?.receiptNumber || null,
      rejectionReason: matchingReceipt?.rejectionReason || rejectionReasonFromHistory,
      totalAmount: totalInvoiceAmount,
      coveredAmount,
      pendingBalance,
      items: enrichedItems,
      childrenBreakdowns,
      vouchers: associatedVouchers,
      vouchersCount: associatedVouchers.length,
    };
  });

  // Filtrar por período de fechas (dateFrom .. dateTo)
  const cleanFrom = String(dateFrom || '2026-01-01').trim().slice(0, 10);
  const cleanTo = String(dateTo || '2026-12-31').trim().slice(0, 10);

  const filteredInvoices = invoices.filter((inv) => {
    return inv.isoEnd >= cleanFrom && inv.isoStart <= cleanTo;
  });

  // Historial de deuda discriminado por cada ítem de pago
  const debtItemsHistory = filteredInvoices.flatMap((inv) =>
    inv.items
      .filter((item) => item.itemStatus !== 'conciliado')
      .map((item) => ({
        ...item,
        invoiceId: inv.id,
        period: inv.period,
        dueDate: inv.dueDate,
        invoiceStatus: inv.status,
      }))
  );

  const totalPendingDebt = debtItemsHistory
    .filter((i) => i.itemStatus === 'pendiente_pago' || i.itemStatus === 'observado')
    .reduce((sum, i) => sum + i.amount, 0);

  const totalInReviewAmount = debtItemsHistory
    .filter((i) => i.itemStatus === 'en_revision')
    .reduce((sum, i) => sum + i.amount, 0);

  return {
    allInvoices: invoices,
    filteredInvoices,
    debtItemsHistory,
    totalPendingDebt,
    totalInReviewAmount,
  };
};

const extractInitials = (fullName, fallback = 'AL') => {
  const parts = String(fullName || '')
    .split(' ')
    .filter(Boolean);
  if (parts.length === 0) return fallback;
  return parts
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const resolveReferenceDateForPeriod = (invoicePeriod) => {
  const matched = BILLING_PERIODS_CATALOG.find(
    (p) => p.label.toLowerCase() === String(invoicePeriod || '').toLowerCase()
  );
  if (matched?.isoStart) {
    return new Date(`${matched.isoStart}T12:00:00`);
  }
  return new Date();
};

/**
 * Construye el array `children` con el desglose de aranceles (`feeBreakdown`) compatible
 * con el panel de administración web (`FinanceReceiptAccordionPanel` y `FinanceChildCard`).
 */
export const buildReceiptChildrenBreakdown = ({
  linkedStudents = [],
  tariffsConfig = null,
  allDisciplines = INITIAL_DISCIPLINES,
  invoicePeriod = 'Noviembre 2026',
  existingChildren = [],
}) => {
  if (!Array.isArray(linkedStudents) || linkedStudents.length === 0) {
    return Array.isArray(existingChildren) ? existingChildren : [];
  }

  const refDate = resolveReferenceDateForPeriod(invoicePeriod);
  const existingById = new Map(
    (Array.isArray(existingChildren) ? existingChildren : []).map((ch) => [String(ch.id), ch])
  );

  return linkedStudents.map((st, idx) => {
    const prevChild = existingById.get(String(st.id)) || null;
    const calc = calculateStudentItemizedFees({
      student: st,
      tariffsConfig,
      allDisciplines,
      referenceDate: refDate,
    });

    const childName =
      st.nombreCompleto || `${st.nombre || ''} ${st.apellido || ''}`.trim() || 'Estudiante';
    const childLegajo =
      st.studentID_login ||
      st.legajo ||
      prevChild?.legajo ||
      `Leg. #EST-${String(idx + 1).padStart(4, '0')}`;
    const childCurso = st.cursoDisplay || `${st.curso || '1° Año'} ${st.division || 'A'}`.trim();

    const feeBreakdown = calc.items.map((item) => ({
      id: item.id,
      label: item.label,
      amount: item.amount,
      dotClass: item.category === 'deporte' ? 'bg-secondary' : 'bg-primary',
    }));

    return {
      id: st.id,
      name: childName,
      initials: prevChild?.initials || extractInitials(childName, 'AL'),
      avatarBg: prevChild?.avatarBg || 'bg-primary/10 text-primary',
      legajo: childLegajo,
      academicInfo: prevChild?.academicInfo || `${childCurso} · Turno Mañana`,
      totalAmount: calc.totalAmount,
      discountNotice: prevChild?.discountNotice || null,
      feeBreakdown,
    };
  });
};

const isReceiptMatchingFamily = (docData, effectiveUid, cleanTutorDni, studentIdsSet) => {
  if (!docData) return false;
  if (effectiveUid && (docData.tutorUid === effectiveUid || docData.parentId === effectiveUid)) {
    return true;
  }
  if (cleanTutorDni && cleanDni(docData.tutorDni) === cleanTutorDni) {
    return true;
  }
  const docStudentIds = Array.isArray(docData.studentIds) ? docData.studentIds.map(String) : [];
  const docChildrenIds = Array.isArray(docData.children)
    ? docData.children.map((ch) => String(ch.id))
    : [];
  return (
    docStudentIds.some((cid) => studentIdsSet.has(cid)) ||
    docChildrenIds.some((cid) => studentIdsSet.has(cid))
  );
};

const scoreCanonicalReceiptCandidate = (docItem) => {
  let score = 0;
  const docId = String(docItem?.id || '');
  if (!/-\d{10,14}$/.test(docId)) {
    score += 100;
  }
  if (Array.isArray(docItem?.children) && docItem.children.length > 0) {
    score += 60;
  }
  if (!docItem?.parentReceiptId) {
    score += 30;
  }
  return score;
};

const extractTutorVouchersFromReceipt = (receipt) => {
  if (!receipt) return [];
  if (Array.isArray(receipt.vouchersHistory) && receipt.vouchersHistory.length > 0) {
    return receipt.vouchersHistory;
  }
  if (
    receipt.bankingVoucher &&
    (receipt.bankingVoucher.isUploadedByTutor ||
      receipt.bankingVoucher.downloadUrl ||
      receipt.bankingVoucher.fileUrl)
  ) {
    return [receipt.bankingVoucher];
  }
  return [];
};

const mergeUniqueVouchersList = (vouchersArrays) => {
  const seen = new Map();
  vouchersArrays.flat().forEach((v) => {
    if (!v) return;
    const key = String(
      v.id || v.storagePath || v.fileUrl || v.operationCode || v.attachmentName || ''
    ).trim();
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, v);
    }
  });
  return Array.from(seen.values());
};

const resolveFamilyCodeFromReceipts = ({
  tutorUser,
  effectiveUid,
  cleanTutorDni,
  candidateReceipts = [],
}) => {
  if (tutorUser?.familyCode) return tutorUser.familyCode;
  const uidSuffix = String(effectiveUid || '').slice(-4).toUpperCase();
  const preferredUidCode = uidSuffix ? `#FAM-${uidSuffix}` : null;
  if (preferredUidCode && candidateReceipts.some((r) => r?.familyCode === preferredUidCode)) {
    return preferredUidCode;
  }

  const withChildren = candidateReceipts.find(
    (r) => r?.familyCode && Array.isArray(r.children) && r.children.length > 0
  );
  if (withChildren?.familyCode) return withChildren.familyCode;

  const anyWithCode = candidateReceipts.find((r) => Boolean(r?.familyCode));
  if (anyWithCode?.familyCode) return anyWithCode.familyCode;

  const suffix = (effectiveUid || cleanTutorDni || '0001').slice(-4).toUpperCase();
  return `#FAM-${suffix}`;
};

const findFamilyReceiptsForMonth = async ({
  invoicePeriod,
  effectiveUid,
  cleanTutorDni,
  studentIdsSet,
  existingReceiptsPool = [],
}) => {
  const byId = new Map();

  (existingReceiptsPool || []).forEach((r) => {
    const rMonth = String(r?.month || r?.invoicePeriod || '').toLowerCase();
    if (
      r?.id &&
      rMonth === invoicePeriod.toLowerCase() &&
      isReceiptMatchingFamily(r, effectiveUid, cleanTutorDni, studentIdsSet)
    ) {
      byId.set(r.id, r);
    }
  });

  try {
    const qMonth = query(collection(db, 'finance_receipts'), where('month', '==', invoicePeriod));
    const snap = await getDocs(qMonth);
    snap.forEach((dSnap) => {
      const d = { id: dSnap.id, ...dSnap.data() };
      if (isReceiptMatchingFamily(d, effectiveUid, cleanTutorDni, studentIdsSet)) {
        byId.set(dSnap.id, d);
      }
    });
  } catch (err) {
    console.warn('Aviso consultando recibos del período en finance_receipts:', err?.message);
  }

  const matches = Array.from(byId.values());
  matches.sort((a, b) => scoreCanonicalReceiptCandidate(b) - scoreCanonicalReceiptCandidate(a));
  return matches;
};

const cleanupDuplicateReceipts = async (duplicateReceipts = []) => {
  await Promise.all(
    duplicateReceipts.map(async (dup) => {
      if (!dup?.id) return;
      try {
        await deleteDoc(doc(db, 'finance_receipts', dup.id));
      } catch (_err) {
        // Ignorar si no tiene permiso de borrado en algún entorno
      }
    })
  );
};

const reconcileSingleMonthGroup = async ({
  monthLabel,
  monthDocs,
  effectiveUid,
  canonicalFamilyCode,
  linkedStudents,
  tariffsConfig,
  allDisciplines,
}) => {
  monthDocs.sort((a, b) => scoreCanonicalReceiptCandidate(b) - scoreCanonicalReceiptCandidate(a));
  const primary = monthDocs[0];
  const duplicates = monthDocs.slice(1);
  const missingChildren =
    !Array.isArray(primary.children) || primary.children.length < linkedStudents.length;
  const wrongFamilyCode = primary.familyCode !== canonicalFamilyCode;

  if (duplicates.length === 0 && !missingChildren && !wrongFamilyCode) {
    return;
  }

  const docsByRecency = [...monthDocs].sort(
    (a, b) => getReceiptTimestampScore(b) - getReceiptTimestampScore(a)
  );
  const mergedVouchers = mergeUniqueVouchersList(
    docsByRecency.map((d) => extractTutorVouchersFromReceipt(d))
  );
  const childrenBreakdown = buildReceiptChildrenBreakdown({
    linkedStudents,
    tariffsConfig,
    allDisciplines,
    invoicePeriod: monthLabel,
    existingChildren: primary.children,
  });

  const latestDocWithVouchers =
    docsByRecency.find((d) => extractTutorVouchersFromReceipt(d).length > 0) || primary;

  const sumVouchers = mergedVouchers.reduce(
    (sum, v) => sum + (Number(v.transferredAmount || v.declaredAmount || v.amount) || 0),
    0
  );
  const childrenSum = childrenBreakdown.reduce((sum, c) => sum + (Number(c.totalAmount) || 0), 0);
  const resolvedStatus = latestDocWithVouchers.status || primary.status || 'pendiente';
  const resolvedRejection =
    resolvedStatus === 'rechazado'
      ? latestDocWithVouchers.rejectionReason || primary.rejectionReason || null
      : null;

  const consolidatedPayload = {
    ...primary,
    id: primary.id,
    familyCode: canonicalFamilyCode,
    tutorUid: effectiveUid,
    parentId: effectiveUid,
    studentIds: linkedStudents.map((s) => s.id),
    children: childrenBreakdown,
    childrenCount: childrenBreakdown.length,
    enrolledChildrenCount: childrenBreakdown.length,
    status: resolvedStatus,
    receiptNumber:
      monthDocs.find((d) => Boolean(d.receiptNumber))?.receiptNumber ||
      primary.receiptNumber ||
      null,
    rejectionReason: resolvedRejection,
    declaredAmount: sumVouchers > 0 ? sumVouchers : childrenSum,
    bankingVoucher: mergedVouchers[0] || primary.bankingVoucher || null,
    vouchersHistory: mergedVouchers,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'finance_receipts', primary.id), consolidatedPayload, { merge: true });
    if (duplicates.length > 0) {
      await cleanupDuplicateReceipts(duplicates);
    }
  } catch (_err) {
    // Continuar silenciosamente
  }
};

/**
 * Reconcilia y consolida en segundo plano documentos duplicados o sin array `children`
 * en `finance_receipts` para la familia autenticada, unificando `familyCode`, `children` y `vouchersHistory`.
 */
export const reconcileFamilyReceiptsInFirestore = async ({
  tutorUser,
  linkedStudents = [],
  financeReceipts = [],
  tariffsConfig = null,
  allDisciplines = INITIAL_DISCIPLINES,
}) => {
  const effectiveUid = auth.currentUser?.uid || tutorUser?.uid || tutorUser?.id;
  if (!effectiveUid || !Array.isArray(linkedStudents) || linkedStudents.length === 0) return;

  const cleanTutorDni = cleanDni(tutorUser?.dni || '');
  const studentIdsSet = new Set(linkedStudents.map((s) => String(s.id)));

  const familyReceipts = (financeReceipts || []).filter((r) =>
    isReceiptMatchingFamily(r, effectiveUid, cleanTutorDni, studentIdsSet)
  );
  if (familyReceipts.length === 0) return;

  const canonicalFamilyCode = resolveFamilyCodeFromReceipts({
    tutorUser,
    effectiveUid,
    cleanTutorDni,
    candidateReceipts: familyReceipts,
  });

  const byMonth = new Map();
  familyReceipts.forEach((r) => {
    const m = r.month || r.invoicePeriod;
    if (!m) return;
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(r);
  });

  for (const [monthLabel, monthDocs] of byMonth.entries()) {
    await reconcileSingleMonthGroup({
      monthLabel,
      monthDocs,
      effectiveUid,
      canonicalFamilyCode,
      linkedStudents,
      tariffsConfig,
      allDisciplines,
    });
  }
};

/**
 * Sube un comprobante de transferencia bancaria seleccionando ítems específicos a pagar,
 * soporta múltiples comprobantes sobre una misma factura (vouchersHistory),
 * sincroniza finance_receipts y students/{studentId}.comprobantesPago,
 * y emite el Comprobante Digital de Recepción de Pago.
 */
export const submitTransferVoucherWithItems = async ({
  tutorUser,
  linkedStudents = [],
  invoicePeriod = 'Noviembre 2026',
  selectedItems = [], // Array de objetos ítem seleccionados por el padre
  declaredAmount,
  operationCode,
  originBank,
  transferDate,
  fileAsset,
  tariffsConfig = null,
  allDisciplines = INITIAL_DISCIPLINES,
  existingReceiptsPool = [],
}) => {
  if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
    throw new Error('Debe seleccionar al menos un ítem de la factura para imputar el pago.');
  }
  if (!operationCode || !String(operationCode).trim()) {
    throw new Error('Ingrese el número o código de operación de la transferencia bancaria.');
  }
  if (!fileAsset) {
    throw new Error(
      'Debe adjuntar el comprobante bancario de transferencia (PDF, PNG, JPG o JPEG hasta 2 MB).'
    );
  }

  const effectiveUid = auth.currentUser?.uid || tutorUser?.uid || tutorUser?.id;
  if (!effectiveUid) {
    throw new Error('Sesión de usuario no válida. Vuelva a iniciar sesión.');
  }

  const cleanTutorDni = cleanDni(tutorUser?.dni || '');
  const studentIdsSet = new Set(linkedStudents.map((s) => String(s.id)));

  // 1. Buscar recibos existentes del período para reutilizar siempre el recibo canónico y el familyCode oficial
  const monthMatches = await findFamilyReceiptsForMonth({
    invoicePeriod,
    effectiveUid,
    cleanTutorDni,
    studentIdsSet,
    existingReceiptsPool,
  });

  const existingReceipt = monthMatches[0] || null;
  const duplicateReceipts = monthMatches.slice(1);

  const allFamilyReceipts = (existingReceiptsPool || []).filter((r) =>
    isReceiptMatchingFamily(r, effectiveUid, cleanTutorDni, studentIdsSet)
  );
  const familyCode = resolveFamilyCodeFromReceipts({
    tutorUser,
    effectiveUid,
    cleanTutorDni,
    candidateReceipts: [...monthMatches, ...allFamilyReceipts],
  });

  const deterministicDocId = `rec-${slugify(familyCode)}-${slugify(invoicePeriod)}`;
  const targetReceiptId = existingReceipt?.id || deterministicDocId;

  const selectedItemIds = selectedItems.map((i) => i.id);
  const selectedItemLabels = selectedItems.map((i) => `${i.label} (${i.studentName})`);
  const involvedStudentIds = Array.from(
    new Set(selectedItems.map((i) => i.studentId).filter(Boolean))
  );
  const targetStudents =
    involvedStudentIds.length > 0
      ? linkedStudents.filter((s) => involvedStudentIds.includes(s.id))
      : linkedStudents;

  const calculatedSelectionSum = selectedItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const finalAmount = Number(declaredAmount) > 0 ? Number(declaredAmount) : calculatedSelectionSum;

  // 2. Subir archivo a Firebase Storage en vouchers/{uid}/{timestamp}_{fileName}
  const uploadedStorage = await uploadFileToFirebaseStorage({
    fileAsset,
    folder: 'vouchers',
    userId: effectiveUid,
    prefix: `${slugify(familyCode)}_${slugify(invoicePeriod)}`,
    extraMetadata: {
      tutorUid: String(effectiveUid),
      invoicePeriod: String(invoicePeriod),
      operationCode: String(operationCode).trim(),
      declaredAmount: String(finalAmount),
      selectedItems: selectedItemIds.join(','),
    },
  });

  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const uploadDateFormatted = `${day}/${month}/${year}`;
  const uploadTimeFormatted = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')} hs`;

  const tutorDisplayName =
    tutorUser?.nombreCompleto || tutorUser?.nombre || tutorUser?.email || 'Tutor Responsable';

  const voucherEntry = {
    id: `vch-${Date.now()}`,
    attachmentName: uploadedStorage.fileName,
    attachmentSize: uploadedStorage.fileSize,
    fileUrl: uploadedStorage.downloadUrl,
    downloadUrl: uploadedStorage.downloadUrl,
    storagePath: uploadedStorage.storagePath,
    payerName: tutorDisplayName,
    payerCuil: tutorUser?.dni || '',
    operationDate: transferDate || `${year}-${month}-${day}`,
    uploadDate: uploadDateFormatted,
    uploadTime: uploadTimeFormatted,
    transferredAmount: finalAmount,
    declaredAmount: finalAmount,
    paymentType: 'Transferencia Bancaria',
    voucherStatus: 'Pendiente de conciliación',
    isUploadedByTutor: true,
    operationCode: String(operationCode).trim(),
    originBank: originBank || 'Banco Santander',
    studentIds: targetStudents.map((s) => s.id),
    selectedItems: selectedItemIds,
    selectedItemLabels,
    invoicePeriod,
  };

  const wasReceiptRejected = existingReceipt?.status === 'rechazado';
  const allPrevVouchers = mergeUniqueVouchersList(
    monthMatches.map((m) => extractTutorVouchersFromReceipt(m))
  );
  const prevHistory = normalizePreviousHistoryForResubmission(
    allPrevVouchers,
    wasReceiptRejected
  );

  const nextVouchersHistory = [voucherEntry, ...prevHistory];
  const prevSelectedItems = Array.isArray(existingReceipt?.selectedItems)
    ? existingReceipt.selectedItems
    : [];
  const mergedSelectedItems = Array.from(new Set([...prevSelectedItems, ...selectedItemIds]));

  const cumulativeTransferred = nextVouchersHistory
    .filter((v) => !isVoucherRejectedStatus(v.voucherStatus))
    .reduce((sum, v) => sum + (Number(v.transferredAmount || v.declaredAmount) || 0), 0);

  const initials = extractInitials(tutorDisplayName, 'TF');
  const childrenBreakdown = buildReceiptChildrenBreakdown({
    linkedStudents,
    tariffsConfig,
    allDisciplines,
    invoicePeriod,
    existingChildren: existingReceipt?.children,
  });

  const receiptPayload = {
    ...(existingReceipt || {}),
    id: targetReceiptId,
    familyCode,
    tutor: existingReceipt?.tutor || tutorDisplayName,
    tutorDni: existingReceipt?.tutorDni || tutorUser?.dni || '',
    tutorUid: effectiveUid,
    parentId: effectiveUid,
    studentIds: linkedStudents.map((s) => s.id),
    initials: existingReceipt?.initials || initials,
    avatarBg:
      existingReceipt?.avatarBg || 'bg-surface-container-high text-on-surface-variant',
    status: 'pendiente',
    rejectionReason: null,
    uploadDate: uploadDateFormatted,
    uploadTime: uploadTimeFormatted,
    declaredAmount: cumulativeTransferred,
    month: invoicePeriod,
    invoicePeriod,
    selectedItems: mergedSelectedItems,
    conceptSummary: selectedItems.map((i) => i.label).join(' + '),
    bankingVoucher: voucherEntry,
    vouchersHistory: nextVouchersHistory,
    children: childrenBreakdown,
    childrenCount: childrenBreakdown.length,
    enrolledChildrenCount: childrenBreakdown.length || linkedStudents.length || 1,
    updatedAt: serverTimestamp(),
  };

  await setDoc(doc(db, 'finance_receipts', targetReceiptId), receiptPayload, { merge: true });

  if (duplicateReceipts.length > 0) {
    await cleanupDuplicateReceipts(duplicateReceipts);
  }

  // 3. Guardar en el array comprobantesPago de cada alumno involucrado (soportando múltiples comprobantes por período)
  const updatedStudentsMap = {};
  await Promise.all(
    targetStudents.map(async (student) => {
      if (!student?.id) return;
      const prevVouchers = Array.isArray(student.comprobantesPago) ? student.comprobantesPago : [];
      const studentItemsForThisVoucher = selectedItems
        .filter((i) => String(i.studentId) === String(student.id))
        .map((i) => i.id);

      const childVoucherRecord = {
        id: voucherEntry.id,
        receiptId: targetReceiptId,
        invoicePeriod,
        uploadDate: uploadDateFormatted,
        uploadTime: uploadTimeFormatted,
        declaredAmount: finalAmount,
        operationCode: voucherEntry.operationCode,
        originBank: voucherEntry.originBank,
        fileName: voucherEntry.attachmentName,
        fileSize: voucherEntry.attachmentSize,
        fileUrl: voucherEntry.fileUrl,
        storagePath: voucherEntry.storagePath,
        selectedItems:
          studentItemsForThisVoucher.length > 0 ? studentItemsForThisVoucher : selectedItemIds,
        selectedItemLabels,
        status: 'pendiente',
      };

      const normalizedPrevStudentVouchers = prevVouchers.map((pv) => {
        if (
          wasReceiptRejected &&
          String(pv.invoicePeriod || '').toLowerCase() === invoicePeriod.toLowerCase() &&
          pv.status === 'pendiente'
        ) {
          return { ...pv, status: 'rechazado' };
        }
        return pv;
      });

      const nextStudentVouchers = [childVoucherRecord, ...normalizedPrevStudentVouchers];
      await updateDoc(doc(db, 'students', student.id), {
        comprobantesPago: nextStudentVouchers,
        updatedAt: serverTimestamp(),
      });
      updatedStudentsMap[student.id] = nextStudentVouchers;
    })
  );

  // 4. Emitir Comprobante Digital de Pago oficial para el padre
  const digitalReceipt = {
    digitalReceiptNumber: `COMP-DIG-${year}-${String(Date.now()).slice(-6)}`,
    issuedAt: `${uploadDateFormatted} ${uploadTimeFormatted}`,
    invoicePeriod,
    tutorName: tutorDisplayName,
    tutorDni: tutorUser?.dni || 'S/D',
    tutorEmail: tutorUser?.email || '',
    familyCode,
    paymentMethod: 'Transferencia Bancaria',
    originBank: voucherEntry.originBank,
    operationCode: voucherEntry.operationCode,
    transferDate: voucherEntry.operationDate,
    totalTransferred: finalAmount,
    selectedItems,
    fileName: voucherEntry.attachmentName,
    fileUrl: voucherEntry.fileUrl,
    statusLabel: 'Recibido — En Conciliación Administrativa',
  };

  return {
    receiptPayload,
    voucherEntry,
    digitalReceipt,
    updatedStudentsMap,
  };
};
