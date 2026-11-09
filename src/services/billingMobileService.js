import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
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

const resolvePreviousVouchers = (existingReceipt) => {
  if (Array.isArray(existingReceipt?.vouchersHistory)) {
    return existingReceipt.vouchersHistory;
  }
  if (existingReceipt?.bankingVoucher?.isUploadedByTutor) {
    return [existingReceipt.bankingVoucher];
  }
  return [];
};

const collectStudentVouchers = (targetStudents, periodLabel, defaultDueDate, vouchersMap) => {
  targetStudents.forEach((st) => {
    const stVouchers = Array.isArray(st.comprobantesPago) ? st.comprobantesPago : [];
    stVouchers.forEach((sv, idx) => {
      if (String(sv.invoicePeriod || '').toLowerCase() === periodLabel.toLowerCase()) {
        const key = sv.operationCode || sv.id || `sv-${st.id}-${idx}`;
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
            voucherStatus:
              sv.status === 'aprobado' || sv.status === 'conciliado'
                ? 'Conciliado OK'
                : 'Pendiente de conciliación',
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
      const key = vh.operationCode || vh.id || `vh-${idx}`;
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
        voucherStatus: vh.voucherStatus || (matchingReceipt.status === 'aprobado' || matchingReceipt.status === 'conciliado' ? 'Conciliado OK' : 'En revisión'),
      });
    });
  }

  if (matchingReceipt.bankingVoucher) {
    const bv = matchingReceipt.bankingVoucher;
    const key = bv.operationCode || bv.attachmentName || `bv-${matchingReceipt.id}`;
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
        voucherStatus:
          bv.voucherStatus ||
          (matchingReceipt.status === 'aprobado' || matchingReceipt.status === 'conciliado'
            ? 'Conciliado OK'
            : 'Pendiente de conciliación'),
      });
    }
  }
};

const collectAssociatedVouchers = (matchingReceipt, targetStudents, periodMeta) => {
  const vouchersMap = new Map();
  collectReceiptVouchers(matchingReceipt, periodMeta.dueDate, vouchersMap);
  collectStudentVouchers(targetStudents, periodMeta.label, periodMeta.dueDate, vouchersMap);
  return Array.from(vouchersMap.values());
};

const resolveInvoiceStatus = (matchingReceipt, isApprovedInFirestore, pendingBalance, coveredAmount, associatedVouchersCount) => {
  if (matchingReceipt?.status === 'rechazado') {
    return {
      status: 'rechazado',
      statusLabel: 'Comprobante Observado / Rechazado',
    };
  }
  if (isApprovedInFirestore && pendingBalance === 0) {
    return {
      status: 'conciliado',
      statusLabel: 'Pagado y Conciliado',
    };
  }
  if (associatedVouchersCount > 0 && pendingBalance > 0 && coveredAmount > 0) {
    return {
      status: 'pago_parcial',
      statusLabel: `Pago Parcial (${associatedVouchersCount} comp.) · Resta saldo`,
    };
  }
  if (associatedVouchersCount > 0 && pendingBalance === 0) {
    return {
      status: 'pendiente',
      statusLabel: 'En Revisión / Pendiente de Conciliación',
    };
  }
  if (associatedVouchersCount > 0) {
    return {
      status: 'pendiente',
      statusLabel: 'En Revisión Administrativa',
    };
  }
  return {
    status: 'sin_comprobante',
    statusLabel: 'Pendiente de Pago',
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
    // Buscar si existe documento en finance_receipts para este período y familia/alumno
    const studentIdSet = new Set(targetStudents.map((s) => String(s.id)));

    const matchingReceipt = (receiptsFromFirestore || []).find((r) => {
      const rMonth = String(r.month || r.invoicePeriod || '').toLowerCase();
      if (rMonth !== periodMeta.label.toLowerCase()) return false;

      const rStudentIds = Array.isArray(r.studentIds) ? r.studentIds.map(String) : [];
      const rChildrenIds = Array.isArray(r.children) ? r.children.map((c) => String(c.id)) : [];
      const hasAnyTargetStudent =
        rStudentIds.some((id) => studentIdSet.has(id)) ||
        rChildrenIds.some((id) => studentIdSet.has(id));

      return hasAnyTargetStudent;
    });

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
    const associatedVouchers = collectAssociatedVouchers(matchingReceipt, targetStudents, periodMeta);

    // Determinar ítems abonados y estado de la cuota
    const paidItemIdsSet = new Set();
    associatedVouchers.forEach((v) => {
      if (Array.isArray(v.selectedItems) && v.selectedItems.length > 0) {
        v.selectedItems.forEach((itemId) => paidItemIdsSet.add(itemId));
      }
    });

    const isApprovedInFirestore =
      matchingReceipt?.status === 'aprobado' || matchingReceipt?.status === 'conciliado';

    const totalTransferred = associatedVouchers.reduce(
      (sum, v) => sum + (Number(v.transferredAmount) || 0),
      0
    );

    // Si en Firestore figura aprobado/conciliado para un mes pasado y cubre el monto, todos los ítems están pagados
    if (isApprovedInFirestore && paidItemIdsSet.size === 0) {
      allItems.forEach((item) => paidItemIdsSet.add(item.id));
    }

    const enrichedItems = allItems.map((item) => {
      const isCoveredBySelection = paidItemIdsSet.has(item.id);
      const isCoveredByFullTransfer =
        paidItemIdsSet.size === 0 && totalTransferred >= totalInvoiceAmount && totalInvoiceAmount > 0;
      const isPaidOrInReview = isCoveredBySelection || isCoveredByFullTransfer;

      let itemStatus = 'pendiente_pago'; // 'conciliado' | 'en_revision' | 'pendiente_pago'
      if (isApprovedInFirestore && isPaidOrInReview) {
        itemStatus = 'conciliado';
      } else if (isPaidOrInReview && associatedVouchers.length > 0) {
        itemStatus = 'en_revision';
      }

      return {
        ...item,
        itemStatus,
        isPaidOrInReview,
        pendingAmount: isPaidOrInReview ? 0 : item.amount,
      };
    });

    const pendingItems = enrichedItems.filter((i) => !i.isPaidOrInReview);
    const pendingBalance = pendingItems.reduce((sum, i) => sum + i.amount, 0);
    const coveredAmount = totalInvoiceAmount - pendingBalance;

    const { status, statusLabel } = resolveInvoiceStatus(
      matchingReceipt,
      isApprovedInFirestore,
      pendingBalance,
      coveredAmount,
      associatedVouchers.length
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
      rejectionReason: matchingReceipt?.rejectionReason || null,
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
    .filter((i) => i.itemStatus === 'pendiente_pago')
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
  const familySuffix = (cleanTutorDni || effectiveUid || '0001').slice(-4).toUpperCase();
  const familyCode = `#FAM-${familySuffix}`;

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

  // 1. Subir archivo a Firebase Storage en vouchers/{uid}/{timestamp}_{fileName}
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

  // 2. Buscar si ya existe el recibo mensual en finance_receipts
  const deterministicDocId = `rec-${slugify(familyCode)}-${slugify(invoicePeriod)}`;
  let targetReceiptId = deterministicDocId;
  let existingReceipt = null;

  try {
    const directSnap = await getDoc(doc(db, 'finance_receipts', deterministicDocId));
    if (directSnap.exists()) {
      existingReceipt = directSnap.data();
    } else {
      const qMonth = query(collection(db, 'finance_receipts'), where('month', '==', invoicePeriod));
      const snap = await getDocs(qMonth);
      const studentIdsSet = new Set(linkedStudents.map((s) => String(s.id)));
      snap.forEach((dSnap) => {
        const d = dSnap.data();
        const matchesUid = d.tutorUid === effectiveUid || d.parentId === effectiveUid;
        const matchesDni = cleanTutorDni && cleanDni(d.tutorDni) === cleanTutorDni;
        const docChildrenIds = Array.isArray(d.children) ? d.children.map((ch) => String(ch.id)) : [];
        const matchesChild = docChildrenIds.some((cid) => studentIdsSet.has(cid));
        if (matchesUid || matchesDni || matchesChild) {
          targetReceiptId = dSnap.id;
          existingReceipt = d;
        }
      });
    }
  } catch (err) {
    console.warn('Aviso consultando recibo previo en finance_receipts:', err?.message);
  }

  const prevHistory = resolvePreviousVouchers(existingReceipt);

  const nextVouchersHistory = [voucherEntry, ...prevHistory];
  const prevSelectedItems = Array.isArray(existingReceipt?.selectedItems)
    ? existingReceipt.selectedItems
    : [];
  const mergedSelectedItems = Array.from(new Set([...prevSelectedItems, ...selectedItemIds]));

  const cumulativeTransferred = nextVouchersHistory.reduce(
    (sum, v) => sum + (Number(v.transferredAmount || v.declaredAmount) || 0),
    0
  );

  const initials =
    tutorDisplayName
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'TF';

  const receiptPayload = {
    ...(existingReceipt || {}),
    id: targetReceiptId,
    familyCode: existingReceipt?.familyCode || familyCode,
    tutor: existingReceipt?.tutor || tutorDisplayName,
    tutorDni: existingReceipt?.tutorDni || tutorUser?.dni || '',
    tutorUid: effectiveUid,
    parentId: effectiveUid,
    studentIds: linkedStudents.map((s) => s.id),
    initials: existingReceipt?.initials || initials,
    status: 'pendiente', // Necesario 'pendiente' según firestore.rules para permitir updates posteriores del tutor
    uploadDate: uploadDateFormatted,
    uploadTime: uploadTimeFormatted,
    declaredAmount: cumulativeTransferred,
    month: invoicePeriod,
    invoicePeriod,
    selectedItems: mergedSelectedItems,
    conceptSummary: selectedItems.map((i) => i.label).join(' + '),
    bankingVoucher: voucherEntry,
    vouchersHistory: nextVouchersHistory,
    enrolledChildrenCount: linkedStudents.length || 1,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'finance_receipts', targetReceiptId), receiptPayload, { merge: true });
  } catch (setDocErr) {
    if (setDocErr) {
      // Si existingReceipt tenía status != 'pendiente' y firestore.rules bloqueó el update sobre ese docId,
      // creamos un documento complementario determinístico para este envío
      const fallbackDocId = `${targetReceiptId}-${Date.now()}`;
      await setDoc(doc(db, 'finance_receipts', fallbackDocId), {
        ...receiptPayload,
        id: fallbackDocId,
        parentReceiptId: targetReceiptId,
      });
    }
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

      const nextStudentVouchers = [childVoucherRecord, ...prevVouchers];
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
