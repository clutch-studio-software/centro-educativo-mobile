import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, formatCurrencyARS } from '../theme/colors';
import {
  buildBillingInvoicesAndDebtReport,
  submitTransferVoucherWithItems,
} from '../services/billingMobileService';
import { pickAllowedDocument, formatFileSize } from '../services/storageMobileService';
import DigitalPaymentReceiptModal from '../components/DigitalPaymentReceiptModal';
import InlineCalendarPicker, {
  formatIsoToDisplay,
} from '../components/InlineCalendarPicker';

const DATE_PRESETS = [
  {
    id: 'current',
    label: 'Mes Actual',
    subLabel: 'Noviembre 2026',
    from: '2026-11-01',
    to: '2026-11-30',
  },
  {
    id: 'last3',
    label: 'Últimos 3 Meses',
    subLabel: 'Sep – Nov 2026',
    from: '2026-09-01',
    to: '2026-11-30',
  },
  {
    id: 'last4',
    label: 'Últimos 4 Meses',
    subLabel: 'Ago – Nov 2026',
    from: '2026-08-01',
    to: '2026-11-30',
  },
  {
    id: 'year',
    label: 'Todo el Ciclo 2026',
    subLabel: 'Jun – Nov 2026',
    from: '2026-03-01',
    to: '2026-12-31',
  },
  {
    id: 'custom',
    label: 'Personalizado',
    subLabel: 'Seleccionar rango Desde y Hasta',
    from: null,
    to: null,
  },
];

const resolvePresetIdForDates = (dateFrom, dateTo) => {
  const found = DATE_PRESETS.find(
    (p) => p.id !== 'custom' && p.from === dateFrom && p.to === dateTo
  );
  return found ? found.id : 'custom';
};

const resolvePeriodRangeLabel = (dateFrom, dateTo) => {
  const matchedPreset = DATE_PRESETS.find(
    (p) => p.id !== 'custom' && p.from === dateFrom && p.to === dateTo
  );
  if (matchedPreset) {
    return matchedPreset.label;
  }
  return `${formatIsoToDisplay(dateFrom)} al ${formatIsoToDisplay(dateTo)}`;
};

const getItemStatusBadge = (itemStatus) => {
  if (itemStatus === 'conciliado') {
    return { color: COLORS.emerald, label: 'Pagado' };
  }
  if (itemStatus === 'en_revision') {
    return { color: COLORS.amber, label: 'En revisión' };
  }
  if (itemStatus === 'observado') {
    return { color: COLORS.rose, label: 'Observado' };
  }
  return { color: COLORS.rose, label: 'Pendiente' };
};

const getDebtItemStatusLabel = (itemStatus) => {
  if (itemStatus === 'en_revision') {
    return 'Comprobante en Revisión';
  }
  if (itemStatus === 'observado') {
    return 'Comprobante Observado — Requiere Respaldo';
  }
  return 'Pendiente de Transferencia';
};

const resolvePrimaryPayButtonLabel = (invoice) => {
  if (invoice.status === 'rechazado') {
    return 'Enviar comprobante';
  }
  if (invoice.pendingBalance > 0) {
    return 'Enviar comprobante de transferencia';
  }
  return 'Enviar comprobante';
};

const resolveInvoiceStatusTheme = (status) => {
  if (status === 'conciliado') {
    return {
      bg: COLORS.emeraldSoft,
      border: COLORS.emeraldBorder,
      text: COLORS.emerald,
      icon: 'checkmark-circle',
    };
  }
  if (status === 'rechazado') {
    return {
      bg: COLORS.roseSoft,
      border: COLORS.roseBorder,
      text: COLORS.rose,
      icon: 'alert-circle',
    };
  }
  if (status === 'sin_comprobante') {
    return {
      bg: COLORS.roseSoft,
      border: COLORS.roseBorder,
      text: COLORS.rose,
      icon: 'warning-outline',
    };
  }
  return {
    bg: COLORS.amberSoft,
    border: COLORS.amberBorder,
    text: COLORS.amber,
    icon: 'time-outline',
  };
};

const InvoiceStatusBadge = ({ status, statusLabel }) => {
  const theme = resolveInvoiceStatusTheme(status);
  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: theme.bg, borderColor: theme.border },
      ]}
    >
      <Ionicons name={theme.icon} size={13} color={theme.text} />
      <Text style={[styles.statusBadgeText, { color: theme.text }]}>
        {statusLabel}
      </Text>
    </View>
  );
};

/**
 * Modal con Dropdown de períodos y opción "Personalizado" con dos campos calendario (Desde / Hasta)
 */
const DatePeriodFilterModal = ({
  visible,
  dateFrom,
  dateTo,
  onApply,
  onClose,
}) => {
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const [selectedPresetId, setSelectedPresetId] = useState(() =>
    resolvePresetIdForDates(dateFrom, dateTo)
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeCalendarField, setActiveCalendarField] = useState(null);

  const handleOpenSync = () => {
    setDraftFrom(dateFrom);
    setDraftTo(dateTo);
    const initialId = resolvePresetIdForDates(dateFrom, dateTo);
    setSelectedPresetId(initialId);
    setIsDropdownOpen(false);
    setActiveCalendarField(null);
  };

  const currentPresetOption =
    DATE_PRESETS.find((p) => p.id === selectedPresetId) || DATE_PRESETS[0];

  const handleSelectDropdownOption = (preset) => {
    setSelectedPresetId(preset.id);
    setIsDropdownOpen(false);
    if (preset.id === 'custom') {
      setActiveCalendarField('from');
    } else {
      setDraftFrom(preset.from);
      setDraftTo(preset.to);
      setActiveCalendarField(null);
    }
  };

  const handleCalendarDatePicked = (pickedIso) => {
    if (activeCalendarField === 'from') {
      setDraftFrom(pickedIso);
      if (pickedIso > draftTo) {
        setDraftTo(pickedIso);
      }
      setActiveCalendarField('to');
      return;
    }

    setDraftTo(pickedIso);
    if (pickedIso < draftFrom) {
      setDraftFrom(pickedIso);
    }
    setActiveCalendarField(null);
  };

  const toggleCalendarField = (field) => {
    setIsDropdownOpen(false);
    setActiveCalendarField((prev) => (prev === field ? null : field));
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onShow={handleOpenSync}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Filtrar por Período</Text>
              <Text style={styles.modalSubtitle}>
                Seleccione un período de consulta o un rango personalizado
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSectionTitle}>PERÍODO DE CONSULTA</Text>

          {/* Dropdown Selector */}
          <View style={styles.dropdownWrapper}>
            <TouchableOpacity
              style={[
                styles.dropdownTrigger,
                isDropdownOpen && styles.dropdownTriggerOpen,
              ]}
              onPress={() => {
                setIsDropdownOpen((prev) => !prev);
                setActiveCalendarField(null);
              }}
              activeOpacity={0.78}
            >
              <View style={styles.dropdownTriggerLeft}>
                <Ionicons
                  name={
                    selectedPresetId === 'custom'
                      ? 'calendar-number-outline'
                      : 'calendar-outline'
                  }
                  size={18}
                  color={COLORS.emerald}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dropdownTriggerTitle}>
                    {currentPresetOption.label}
                  </Text>
                  <Text style={styles.dropdownTriggerSub}>
                    {selectedPresetId === 'custom'
                      ? `${formatIsoToDisplay(draftFrom)} – ${formatIsoToDisplay(draftTo)}`
                      : currentPresetOption.subLabel}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>

            {isDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {DATE_PRESETS.map((preset) => {
                  const isSelected = selectedPresetId === preset.id;
                  return (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.dropdownOptionRow,
                        isSelected && styles.dropdownOptionRowActive,
                      ]}
                      onPress={() => handleSelectDropdownOption(preset)}
                      activeOpacity={0.75}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.dropdownOptionTitle,
                            isSelected && styles.dropdownOptionTitleActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                        <Text
                          style={[
                            styles.dropdownOptionSub,
                            isSelected && styles.dropdownOptionSubActive,
                          ]}
                        >
                          {preset.subLabel}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={COLORS.emerald}
                        />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Campos Calendario "Desde" y "Hasta" cuando se elige "Personalizado" */}
          {selectedPresetId === 'custom' && (
            <View style={styles.customDatesSection}>
              <View style={styles.dateFieldsRow}>
                <TouchableOpacity
                  style={[
                    styles.calendarFieldBox,
                    activeCalendarField === 'from' &&
                      styles.calendarFieldBoxActive,
                  ]}
                  onPress={() => toggleCalendarField('from')}
                  activeOpacity={0.78}
                >
                  <Text style={styles.calendarFieldLabel}>DESDE</Text>
                  <View style={styles.calendarFieldValueRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={
                        activeCalendarField === 'from'
                          ? COLORS.emerald
                          : COLORS.primary
                      }
                    />
                    <Text
                      style={[
                        styles.calendarFieldValue,
                        activeCalendarField === 'from' &&
                          styles.calendarFieldValueActive,
                      ]}
                    >
                      {formatIsoToDisplay(draftFrom)}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.calendarFieldBox,
                    activeCalendarField === 'to' &&
                      styles.calendarFieldBoxActive,
                  ]}
                  onPress={() => toggleCalendarField('to')}
                  activeOpacity={0.78}
                >
                  <Text style={styles.calendarFieldLabel}>HASTA</Text>
                  <View style={styles.calendarFieldValueRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={15}
                      color={
                        activeCalendarField === 'to'
                          ? COLORS.emerald
                          : COLORS.primary
                      }
                    />
                    <Text
                      style={[
                        styles.calendarFieldValue,
                        activeCalendarField === 'to' &&
                          styles.calendarFieldValueActive,
                      ]}
                    >
                      {formatIsoToDisplay(draftTo)}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {activeCalendarField && (
                <InlineCalendarPicker
                  key={activeCalendarField}
                  mode="range"
                  activeField={activeCalendarField}
                  draftFrom={draftFrom}
                  draftTo={draftTo}
                  onSelectDate={handleCalendarDatePicked}
                />
              )}
            </View>
          )}

          <View style={styles.modalActionsRow}>
            <TouchableOpacity
              style={styles.modalResetBtn}
              onPress={() => {
                onApply('2026-03-01', '2026-12-31');
                onClose();
              }}
            >
              <Text style={styles.modalResetBtnText}>Ver Todo 2026</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalApplyBtn}
              onPress={() => {
                onApply(draftFrom, draftTo);
                onClose();
              }}
            >
              <Ionicons name="checkmark" size={17} color={COLORS.white} />
              <Text style={styles.modalApplyBtnText}>Aplicar Filtro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/**
 * Tarjeta compacta de cada mes en el listado principal
 */
const InvoiceMonthSummaryCard = ({ invoice, onPress }) => {
  const theme = resolveInvoiceStatusTheme(invoice.status);
  const hasPartialPending =
    invoice.pendingBalance > 0 && invoice.coveredAmount > 0;

  return (
    <TouchableOpacity
      style={[styles.monthSummaryCard, { borderLeftColor: theme.text }]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.monthCardTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.monthCardTitle}>{invoice.period}</Text>
          
        </View>
        <InvoiceStatusBadge
          status={invoice.status}
          statusLabel={invoice.statusLabel}
        />
      </View>
      <View style={styles.monthDueRow}>
            <Ionicons
              name="calendar-clear-outline"
              size={13}
              color={COLORS.textMuted}
            />
            <Text style={styles.monthCardDueText}>
              Vencimiento: {invoice.dueDate}
            </Text>
          </View>

      <View style={styles.monthCardDivider} />

      <View style={styles.monthCardBottomRow}>
        <View>
          <Text style={styles.monthTotalLabel}>TOTAL DEL MES</Text>
          <Text style={styles.monthTotalValue}>
            {formatCurrencyARS(invoice.totalAmount)}
          </Text>
          {hasPartialPending && (
            <Text style={styles.monthPartialPendingText}>
              Saldo pendiente: {formatCurrencyARS(invoice.pendingBalance)}
            </Text>
          )}
        </View>

        <View style={styles.monthDetailAction}>
          <Text style={styles.monthDetailActionText}>Ver detalle</Text>
          <View style={styles.monthChevronCircle}>
            <Ionicons
              name="chevron-forward"
              size={15}
              color={COLORS.primary}
            />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/**
 * Modal de aviso de redirección al navegador para visualizar comprobantes
 */
const RedirectVoucherModal = ({ visible, secondsLeft, onCancel }) => (
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    onRequestClose={onCancel}
  >
    <View style={styles.redirectModalBackdrop}>
      <View style={styles.redirectModalCard}>
        <View style={styles.redirectIconBox}>
          <Ionicons name="open-outline" size={26} color={COLORS.emerald} />
        </View>

        <Text style={styles.redirectModalTitle}>Abriendo Comprobante</Text>

        <Text style={styles.redirectModalMessage}>
          Serás redirigido fuera de la aplicación para ver el comprobante en un navegador.
        </Text>

        <View style={styles.redirectProgressRow}>
          <ActivityIndicator size="small" color={COLORS.emerald} />
          <Text style={styles.redirectCountdownText}>
            Redirigiendo en {secondsLeft} {secondsLeft === 1 ? 'segundo' : 'segundos'}...
          </Text>
        </View>

        <TouchableOpacity
          style={styles.redirectCancelBtn}
          onPress={onCancel}
          activeOpacity={0.75}
        >
          <Text style={styles.redirectCancelBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

/**
 * Vista dedicada con el detalle completo del mes seleccionado
 */
const InvoiceMonthDetailView = ({
  invoice,
  onBack,
  onPayInvoice,
  onViewVoucher,
}) => (
  <View style={styles.sectionWrap}>
    <TouchableOpacity
      style={styles.backToMonthsBtn}
      onPress={onBack}
      activeOpacity={0.75}
    >
      <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
      <Text style={styles.backToMonthsText}>Volver al listado de meses</Text>
    </TouchableOpacity>

    {/* Encabezado y Resumen Financiero del Mes */}
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.invoicePeriod}>{invoice.period}</Text>
          <Text style={styles.invoiceMeta}>
            Vencimiento: {invoice.dueDate}
          </Text>
        </View>
        <InvoiceStatusBadge
          status={invoice.status}
          statusLabel={invoice.statusLabel}
        />
      </View>

      <View style={styles.amountsSummaryBar}>
        <View style={styles.amountCol}>
          <Text style={styles.amountSmallLabel}>Importe Total</Text>
          <Text style={styles.amountBold}>
            {formatCurrencyARS(invoice.totalAmount)}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amountSmallLabel}>Cubierto / En Rev.</Text>
          <Text style={[styles.amountBold, { color: COLORS.emerald }]}>
            {formatCurrencyARS(invoice.coveredAmount)}
          </Text>
        </View>
        <View style={styles.amountCol}>
          <Text style={styles.amountSmallLabel}>Saldo Pendiente</Text>
          <Text
            style={[
              styles.amountBold,
              {
                color:
                  invoice.pendingBalance > 0 ? COLORS.rose : COLORS.emerald,
              },
            ]}
          >
            {formatCurrencyARS(invoice.pendingBalance)}
          </Text>
        </View>
      </View>

      {invoice.status === 'rechazado' && (
        <View style={styles.rejectedAlertBox}>
          <Ionicons name="alert-circle" size={18} color={COLORS.rose} />
          <View style={{ flex: 1 }}>
            <Text style={styles.rejectedAlertTitle}>
              Comprobante observado por Administración
            </Text>
            <Text style={styles.rejectedAlertText}>
              {invoice.rejectionReason ||
                'El monto o comprobante informado presenta observaciones. Puede añadir otra transferencia o documentación respaldatoria para completar su abono.'}
            </Text>
          </View>
        </View>
      )}

      {invoice.status !== 'conciliado' && (
        <TouchableOpacity
          style={[
            styles.payInvoiceBtn,
            invoice.status === 'rechazado' && styles.payInvoiceBtnResubmit,
          ]}
          onPress={() => onPayInvoice(invoice)}
        >
          <Ionicons
            name={
              invoice.status === 'rechazado'
                ? 'document-attach-outline'
                : 'card-outline'
            }
            size={17}
            color={COLORS.white}
          />
          <Text style={styles.payInvoiceBtnText}>
            {resolvePrimaryPayButtonLabel(invoice)}
          </Text>
        </TouchableOpacity>
      )}
    </View>

    {/* Desglose de Ítems del Mes */}
    <View style={styles.invoiceCard}>
      <Text style={styles.subSectionLabel}>
        CONCEPTOS FACTURADOS EN EL MES ({invoice.items.length})
      </Text>
      <View style={styles.itemsListBox}>
        {invoice.items.map((item) => {
          const badge = getItemStatusBadge(item.itemStatus);
          return (
            <View key={item.id} style={styles.invoiceItemRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invoiceItemLabel}>{item.label}</Text>
                <Text style={styles.invoiceItemSub}>
                  {item.studentName} · {item.detail}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.invoiceItemAmount}>
                  {formatCurrencyARS(item.amount)}
                </Text>
                <Text style={[styles.itemMiniBadge, { color: badge.color }]}>
                  {badge.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>

    {/* Comprobantes Asociados al Mes */}
    <View style={styles.vouchersBlock}>
      <View style={styles.vouchersHeaderRow}>
        <Ionicons
          name="document-attach-outline"
          size={16}
          color={COLORS.indigo}
        />
        <Text style={styles.vouchersHeaderTitle}>
          Comprobantes de Transferencia ({invoice.vouchers.length})
        </Text>
      </View>

      {invoice.vouchers.length === 0 ? (
        <Text style={styles.noVouchersText}>
          No se registran comprobantes bancarios asociados a este mes.
        </Text>
      ) : (
        invoice.vouchers.map((v, vIdx) => (
          <View key={`${v.id}-${vIdx}`} style={styles.voucherRowCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.voucherCode}>
                #{vIdx + 1} · Op: {v.operationCode} - Fecha: {v.operationDate}
              </Text>
              <Text style={styles.voucherMeta}>
                 Monto:{' '}
                {formatCurrencyARS(v.transferredAmount)} · {v.voucherStatus}
              </Text>
              
            </View>
            {v.fileUrl ? (
              <TouchableOpacity
                style={styles.openFileBtn}
                onPress={() => onViewVoucher(v.fileUrl)}
              >
                <Ionicons
                  name="open-outline"
                  size={14}
                  color={COLORS.emerald}
                />
                <Text style={styles.openFileBtnText}>Ver comprobante</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ))
      )}
    </View>
  </View>
);

const BillingScreen = ({
  user,
  linkedStudents = [],
  selectedStudentId,
  tariffsConfig,
  allDisciplines = [],
  financeReceipts = [],
  onStudentUpdated,
  onFeedback,
}) => {
  const [subTab, setSubTab] = useState('invoices'); // 'invoices' | 'debt'
  const [dateFrom, setDateFrom] = useState('2026-08-01');
  const [dateTo, setDateTo] = useState('2026-11-30');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid'
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [selectedInvoicePeriod, setSelectedInvoicePeriod] = useState(null);
  const [isUploadingForSelectedMonth, setIsUploadingForSelectedMonth] =
    useState(false);

  // Estado para el formulario de pago con selección de ítems (automático según el mes en detalle)
  const [targetPeriod, setTargetPeriod] = useState('Noviembre 2026');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [customAmount, setCustomAmount] = useState('');
  const [operationCode, setOperationCode] = useState('');
  const [originBank] = useState('Banco Santander Río');
  const [transferDate, setTransferDate] = useState('2026-11-06');
  const [isTransferCalendarOpen, setIsTransferCalendarOpen] = useState(false);
  const [pickedFile, setPickedFile] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [emittedDigitalReceipt, setEmittedDigitalReceipt] = useState(null);
  const [redirectUrl, setRedirectUrl] = useState(null);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  useEffect(() => {
    if (!redirectUrl) return undefined;

    const intervalId = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(intervalId);
          Linking.openURL(redirectUrl).catch(() => {});
          setRedirectUrl(null);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(intervalId);
  }, [redirectUrl]);

  const handleRequestOpenVoucher = (url) => {
    if (!url) return;
    setRedirectCountdown(5);
    setRedirectUrl(url);
  };

  const handleCancelRedirect = () => {
    setRedirectUrl(null);
    setRedirectCountdown(5);
  };

  // Reporte integral de facturación y deuda
  const billingReport = useMemo(() => {
    return buildBillingInvoicesAndDebtReport({
      students: linkedStudents,
      receiptsFromFirestore: financeReceipts,
      tariffsConfig,
      allDisciplines,
      selectedStudentId: selectedStudentId || 'all',
      dateFrom,
      dateTo,
    });
  }, [
    linkedStudents,
    financeReceipts,
    tariffsConfig,
    allDisciplines,
    selectedStudentId,
    dateFrom,
    dateTo,
  ]);

  const displayedInvoices = useMemo(() => {
    return billingReport.filteredInvoices.filter((inv) => {
      if (statusFilter === 'paid') return inv.status === 'conciliado';
      if (statusFilter === 'pending') return inv.status !== 'conciliado';
      return true;
    });
  }, [billingReport.filteredInvoices, statusFilter]);

  const selectedInvoiceForDetail = useMemo(() => {
    if (!selectedInvoicePeriod) return null;
    return (
      billingReport.allInvoices.find(
        (inv) => inv.period === selectedInvoicePeriod
      ) || null
    );
  }, [billingReport.allInvoices, selectedInvoicePeriod]);

  // Factura seleccionada para imputar pago en la pestaña "Pagar / Cargar Comprobante"
  const activeInvoiceForPayment = useMemo(() => {
    return (
      billingReport.allInvoices.find((inv) => inv.period === targetPeriod) ||
      billingReport.allInvoices[0] ||
      null
    );
  }, [billingReport.allInvoices, targetPeriod]);

  // Ítems disponibles para seleccionar en la factura elegida
  const selectableItems = useMemo(() => {
    return activeInvoiceForPayment?.items || [];
  }, [activeInvoiceForPayment]);

  // Si selectedItemIds está vacío por defecto, preseleccionamos los ítems pendientes de esa factura
  const effectiveSelectedIds = useMemo(() => {
    if (selectedItemIds.length > 0) {
      return selectedItemIds.filter((id) =>
        selectableItems.some((item) => item.id === id)
      );
    }
    return selectableItems.filter((i) => !i.isPaidOrInReview).map((i) => i.id);
  }, [selectedItemIds, selectableItems]);

  const selectedItemsObjects = useMemo(() => {
    const set = new Set(effectiveSelectedIds);
    return selectableItems.filter((item) => set.has(item.id));
  }, [effectiveSelectedIds, selectableItems]);

  const selectedItemsTotal = useMemo(() => {
    return selectedItemsObjects.reduce((sum, item) => sum + item.amount, 0);
  }, [selectedItemsObjects]);

  const toggleItemSelection = (itemId) => {
    const current = new Set(effectiveSelectedIds);
    if (current.has(itemId)) {
      current.delete(itemId);
    } else {
      current.add(itemId);
    }
    const nextIds = Array.from(current);
    setSelectedItemIds(nextIds);
    const nextSum = selectableItems
      .filter((i) => nextIds.includes(i.id))
      .reduce((s, i) => s + i.amount, 0);
    setCustomAmount(String(nextSum));
  };

  const handleSelectAllPending = () => {
    const pendingIds = selectableItems
      .filter((i) => !i.isPaidOrInReview)
      .map((i) => i.id);
    const idsToUse =
      pendingIds.length > 0 ? pendingIds : selectableItems.map((i) => i.id);
    setSelectedItemIds(idsToUse);
    const sum = selectableItems
      .filter((i) => idsToUse.includes(i.id))
      .reduce((s, i) => s + i.amount, 0);
    setCustomAmount(String(sum));
  };

  const handlePickVoucherFile = async () => {
    try {
      const asset = await pickAllowedDocument();
      if (asset) {
        setPickedFile(asset);
      }
    } catch (err) {
      if (onFeedback) {
        onFeedback({ type: 'error', message: err.message });
      }
    }
  };

  const handleSubmitVoucher = async () => {
    if (selectedItemsObjects.length === 0) {
      onFeedback?.({
        type: 'error',
        message:
          'Seleccione al menos un ítem (Cuota, Comedor, Transporte o Deporte) a abonar.',
      });
      return;
    }
    if (!operationCode.trim()) {
      onFeedback?.({
        type: 'error',
        message:
          'Ingrese el código o número de operación de la transferencia bancaria.',
      });
      return;
    }
    if (!pickedFile) {
      onFeedback?.({
        type: 'error',
        message:
          'Adjunte el archivo del comprobante bancario (PDF, PNG o JPG hasta 2 MB).',
      });
      return;
    }

    setSubmittingPayment(true);
    try {
      const result = await submitTransferVoucherWithItems({
        tutorUser: user,
        linkedStudents,
        invoicePeriod: targetPeriod,
        selectedItems: selectedItemsObjects,
        declaredAmount:
          Number(customAmount) > 0 ? Number(customAmount) : selectedItemsTotal,
        operationCode: operationCode.trim(),
        originBank,
        transferDate,
        fileAsset: pickedFile,
        tariffsConfig,
        allDisciplines,
        existingReceiptsPool: financeReceipts,
      });

      if (result.updatedStudentsMap && onStudentUpdated) {
        linkedStudents.forEach((st) => {
          if (result.updatedStudentsMap[st.id]) {
            onStudentUpdated({
              ...st,
              comprobantesPago: result.updatedStudentsMap[st.id],
            });
          }
        });
      }

      setEmittedDigitalReceipt(result.digitalReceipt);
      setPickedFile(null);
      setOperationCode('');
      setCustomAmount('');
      setSelectedItemIds([]);
      setIsTransferCalendarOpen(false);
      setIsUploadingForSelectedMonth(false);

      onFeedback?.({
        type: 'success',
        message: `Comprobante registrado exitosamente. Se emitió el recibo digital ${result.digitalReceipt.digitalReceiptNumber}.`,
      });
    } catch (err) {
      onFeedback?.({
        type: 'error',
        message: err?.message || 'Error al registrar el comprobante de pago.',
      });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleQuickPayFromDebtItem = (debtItem) => {
    const period = debtItem.period || 'Noviembre 2026';
    setSelectedInvoicePeriod(period);
    setTargetPeriod(period);
    setSelectedItemIds([debtItem.id]);
    setCustomAmount(String(debtItem.amount));
    setIsTransferCalendarOpen(false);
    setIsUploadingForSelectedMonth(true);
    setSubTab('invoices');
  };

  const handlePayFromInvoiceDetail = (inv) => {
    setTargetPeriod(inv.period);
    const pendingOrObservedIds = inv.items
      .filter((i) => !i.isPaidOrInReview)
      .map((i) => i.id);
    const fallbackAllIds = inv.items.map((i) => i.id);
    setSelectedItemIds(
      pendingOrObservedIds.length > 0 ? pendingOrObservedIds : fallbackAllIds
    );
    setCustomAmount(
      String(inv.pendingBalance > 0 ? inv.pendingBalance : inv.totalAmount)
    );
    setIsTransferCalendarOpen(false);
    setIsUploadingForSelectedMonth(true);
  };

  const renderMonthVoucherUploadView = () => (
    <View style={styles.sectionWrap}>
      <TouchableOpacity
        style={styles.backToMonthsBtn}
        onPress={() => {
          setIsTransferCalendarOpen(false);
          setIsUploadingForSelectedMonth(false);
        }}
        activeOpacity={0.75}
      >
        <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
        <Text style={styles.backToMonthsText}>
          Volver al detalle de {activeInvoiceForPayment?.period || targetPeriod}
        </Text>
      </TouchableOpacity>

      {/* Encabezado automático del mes a imputar */}
      <View style={styles.autoPeriodHeaderCard}>
        <View style={styles.autoPeriodRow}>
          <View style={styles.periodIconBox}>
            <Ionicons
              name="calendar-clear-outline"
              size={18}
              color={COLORS.emerald}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.periodSelectorLabel}>
              PERÍODO A IMPUTAR AUTOMÁTICAMENTE
            </Text>
            <Text style={styles.autoPeriodTitle}>
              {activeInvoiceForPayment?.period || targetPeriod}
            </Text>
            {activeInvoiceForPayment?.dueDate ? (
              <Text style={styles.autoPeriodSub}>
                Vencimiento: {activeInvoiceForPayment.dueDate}
              </Text>
            ) : null}
          </View>
        </View>

        {activeInvoiceForPayment?.status === 'rechazado' && (
          <View style={styles.rejectedAlertBox}>
            <Ionicons name="alert-circle" size={17} color={COLORS.rose} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rejectedAlertTitle}>
                Documentación de respaldo por comprobante observado
              </Text>
              <Text style={styles.rejectedAlertText}>
                {activeInvoiceForPayment.rejectionReason
                  ? `Motivo informado: "${activeInvoiceForPayment.rejectionReason}". `
                  : ''}
                Puede adjuntar aquí una nueva transferencia por la diferencia de monto o documentación respaldatoria adicional.
              </Text>
            </View>
          </View>
        )}

        {activeInvoiceForPayment?.vouchersCount > 0 && (
          <View style={styles.multiVoucherNotice}>
            <Ionicons name="layers-outline" size={16} color={COLORS.indigo} />
            <Text style={styles.multiVoucherNoticeText}>
              Esta factura ya registra {activeInvoiceForPayment.vouchersCount}{' '}
              comprobante(s) previo(s). La nueva documentación se sumará al historial del mes para respaldar su abono.
            </Text>
          </View>
        )}
      </View>

      {/* Datos Bancarios Oficiales (Sin efectivo) */}
      <View style={styles.bankDataCard}>
        <View style={styles.bankHeaderRow}>
          <Ionicons name="business-outline" size={18} color={COLORS.emerald} />
          <Text style={styles.bankHeaderTitle}>
            Pago Exclusivo por Transferencia Bancaria
          </Text>
        </View>
        <Text style={styles.bankLine}>
          • Banco: <Text style={styles.bankBold}>Banco Santander Río</Text>
        </Text>
        <Text style={styles.bankLine}>
          • Titular:{' '}
          <Text style={[styles.bankBold, { color: COLORS.emerald }]}>
            Centro Educativo Integral SRL
          </Text>
        </Text>
        <Text style={styles.bankLine}>
          • CBU: <Text style={styles.bankBold}>0720026720000001289412</Text>
        </Text>
        <Text style={styles.bankLine}>
          • Alias:{' '}
          <Text style={[styles.bankBold, { color: COLORS.emerald }]}>
            COLEGIO.CENTRO.PAGOS
          </Text>
        </Text>
      </View>

      {/* Paso 1: Seleccionar los Ítems a Pagar */}
      <View style={styles.formSectionCard}>
        <View style={styles.stepHeaderBetween}>
          <Text style={styles.stepTitle}>1. Seleccione los Ítems a Pagar</Text>
          <TouchableOpacity onPress={handleSelectAllPending}>
            <Text style={styles.selectAllLink}>Marcar pendientes</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 8, marginTop: 10 }}>
          {selectableItems.map((item) => {
            const checked = effectiveSelectedIds.includes(item.id);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.checkItemCard,
                  checked && styles.checkItemCardSelected,
                ]}
                onPress={() => toggleItemSelection(item.id)}
              >
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={21}
                  color={checked ? COLORS.emerald : COLORS.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkItemTitle}>{item.label}</Text>
                  <Text style={styles.checkItemSub}>
                    {item.studentName} · {item.detail}
                  </Text>
                  {item.isPaidOrInReview && (
                    <Text style={styles.alreadyCoveredTag}>
                      Ya incluido en comprobante anterior ({item.itemStatus})
                    </Text>
                  )}
                  {item.itemStatus === 'observado' && (
                    <Text style={styles.observedItemTag}>
                      Comprobante anterior observado — adjunte respaldo o diferencia
                    </Text>
                  )}
                </View>
                <Text style={styles.checkItemPrice}>
                  {formatCurrencyARS(item.amount)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.selectedSubtotalBar}>
          <Text style={styles.selectedSubtotalLabel}>
            Total de Ítems Seleccionados:
          </Text>
          <Text style={styles.selectedSubtotalValue}>
            {formatCurrencyARS(selectedItemsTotal)}
          </Text>
        </View>
      </View>

      {/* Paso 2: Datos de la Transferencia y Archivo en Storage */}
      <View style={styles.formSectionCard}>
        <Text style={styles.stepTitle}>
          2. Datos de la Transferencia y Comprobante
        </Text>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>
            Monto Declarado Transferido ($ ARS) *
          </Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={
              customAmount !== '' ? customAmount : String(selectedItemsTotal)
            }
            onChangeText={setCustomAmount}
            placeholder="Ej: 110000"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>
            Código / Nº de Operación Bancaria *
          </Text>
          <TextInput
            style={styles.textInput}
            value={operationCode}
            onChangeText={setOperationCode}
            placeholder="Ej: TRF-9928310"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Fecha de Transferencia *</Text>
          <TouchableOpacity
            style={[
              styles.transferDateSelectorBtn,
              isTransferCalendarOpen && styles.calendarFieldBoxActive,
            ]}
            onPress={() => setIsTransferCalendarOpen((prev) => !prev)}
            activeOpacity={0.78}
          >
            <View style={styles.calendarFieldValueRow}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={
                  isTransferCalendarOpen ? COLORS.emerald : COLORS.primary
                }
              />
              <Text
                style={[
                  styles.calendarFieldValue,
                  isTransferCalendarOpen && styles.calendarFieldValueActive,
                ]}
              >
                {formatIsoToDisplay(transferDate)}
              </Text>
            </View>
            <Ionicons
              name={isTransferCalendarOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {isTransferCalendarOpen && (
            <InlineCalendarPicker
              mode="single"
              selectedDate={transferDate}
              hintText="Seleccione la fecha de transferencia"
              onSelectDate={(pickedIso) => {
                setTransferDate(pickedIso);
                setIsTransferCalendarOpen(false);
              }}
            />
          )}
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Archivo del Comprobante *</Text>
          <TouchableOpacity
            style={styles.filePickerBtn}
            onPress={handlePickVoucherFile}
          >
            <Ionicons name="document-attach" size={20} color={COLORS.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={styles.filePickerTitle}>
                {pickedFile
                  ? pickedFile.name
                  : 'Seleccionar Comprobante Bancario'}
              </Text>
              <Text style={styles.filePickerSub}>
                {pickedFile
                  ? `Tamaño: ${formatFileSize(pickedFile.size)} · Tipo: ${pickedFile.mimeType}`
                  : 'Tipo de archivo permitido (.pdf, .png, .jpg, .jpeg — máx. 2 MB)'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.submitVoucherBtn,
            submittingPayment && { opacity: 0.65 },
          ]}
          onPress={handleSubmitVoucher}
          disabled={submittingPayment}
        >
          {submittingPayment ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons
                name="checkmark-done-circle"
                size={19}
                color={COLORS.white}
              />
              <Text style={styles.submitVoucherBtnText}>
                Enviar aviso de pago
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderInvoicesTab = () => {
    if (selectedInvoiceForDetail && isUploadingForSelectedMonth) {
      return renderMonthVoucherUploadView();
    }

    if (selectedInvoiceForDetail) {
      return (
        <InvoiceMonthDetailView
          invoice={selectedInvoiceForDetail}
          onBack={() => {
            setIsUploadingForSelectedMonth(false);
            setSelectedInvoicePeriod(null);
          }}
          onPayInvoice={handlePayFromInvoiceDetail}
          onViewVoucher={handleRequestOpenVoucher}
        />
      );
    }

    return (
      <View style={styles.sectionWrap}>
        {/* Barra de Filtros Compacta y Limpia */}
        <View style={styles.compactFilterContainer}>
          <TouchableOpacity
            style={styles.periodSelectorButton}
            onPress={() => setIsPeriodModalOpen(true)}
            activeOpacity={0.78}
          >
            <View style={styles.periodIconBox}>
              <Ionicons
                name="calendar-outline"
                size={18}
                color={COLORS.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.periodSelectorLabel}>PERÍODO DE CONSULTA</Text>
              <Text style={styles.periodSelectorValue} numberOfLines={1}>
                {resolvePeriodRangeLabel(dateFrom, dateTo)}
              </Text>
            </View>
            <View style={styles.periodFilterActionPill}>
              <Ionicons
                name="options-outline"
                size={14}
                color={COLORS.primary}
              />
              <Text style={styles.periodFilterActionText}>Cambiar</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.segmentedStatusRow}>
            {[
              { id: 'all', label: 'Todas' },
              { id: 'pending', label: 'Pendientes' },
              { id: 'paid', label: 'Conciliadas' },
            ].map((st) => {
              const isActive = statusFilter === st.id;
              return (
                <TouchableOpacity
                  key={st.id}
                  style={[
                    styles.segmentedStatusBtn,
                    isActive && styles.segmentedStatusBtnActive,
                  ]}
                  onPress={() => setStatusFilter(st.id)}
                >
                  <Text
                    style={[
                      styles.segmentedStatusText,
                      isActive && styles.segmentedStatusTextActive,
                    ]}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Listado de Meses en formato Botón Resumen */}
        {displayedInvoices.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="document-text-outline"
              size={36}
              color={COLORS.textMuted}
            />
            <Text style={styles.emptyTitle}>
              Sin cuotas para el filtro seleccionado
            </Text>
            <Text style={styles.emptySub}>
              Puede cambiar el período de fechas o el estado para consultar otros meses.
            </Text>
          </View>
        ) : (
          <View style={styles.monthsListWrap}>
            {displayedInvoices.map((inv) => (
              <InvoiceMonthSummaryCard
                key={inv.id}
                invoice={inv}
                onPress={() => {
                  setIsUploadingForSelectedMonth(false);
                  setSelectedInvoicePeriod(inv.period);
                }}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderDebtTab = () => (
    <View style={styles.sectionWrap}>
      <View style={styles.debtBanner}>
        <Ionicons name="analytics-outline" size={20} color={COLORS.rose} />
        <View style={{ flex: 1 }}>
          <Text style={styles.debtBannerTitle}>
            Historial de Deuda Discriminado por Ítem de Pago
          </Text>
          <Text style={styles.debtBannerSub}>
            Visualice cada concepto individual adeudado o en revisión (Cuota Base, Transporte por Recorrido, Comedor y cada Deporte) para el alumno seleccionado.
          </Text>
        </View>
      </View>

      {billingReport.debtItemsHistory.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons
            name="checkmark-done-circle"
            size={38}
            color={COLORS.emerald}
          />
          <Text style={styles.emptyTitle}>
            Sin Deuda Registrada en el Período
          </Text>
          <Text style={styles.emptySub}>
            Todos los ítems de cuota, comedor, transporte y deportes se encuentran conciliados.
          </Text>
        </View>
      ) : (
        billingReport.debtItemsHistory.map((dItem) => (
          <View
            key={`${dItem.invoiceId}-${dItem.id}`}
            style={styles.debtItemCard}
          >
            <View style={styles.debtItemHeader}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>
                  {String(dItem.category || 'ARANCEL').toUpperCase()}
                </Text>
              </View>
              <Text style={styles.debtItemPeriod}>
                Período: {dItem.period} (Vence {dItem.dueDate})
              </Text>
            </View>

            <View style={styles.debtItemMainRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.debtItemLabel}>{dItem.label}</Text>
                <Text style={styles.debtItemStudent}>
                  Alumno: {dItem.studentName} · {dItem.detail}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.debtItemAmount}>
                  {formatCurrencyARS(dItem.amount)}
                </Text>
                <Text
                  style={[
                    styles.debtItemStatusText,
                    {
                      color:
                        dItem.itemStatus === 'en_revision'
                          ? COLORS.amber
                          : COLORS.rose,
                    },
                  ]}
                >
                  {getDebtItemStatusLabel(dItem.itemStatus)}
                </Text>
              </View>
            </View>

            {(dItem.itemStatus === 'pendiente_pago' ||
              dItem.itemStatus === 'observado') && (
              <TouchableOpacity
                style={styles.paySingleItemBtn}
                onPress={() => handleQuickPayFromDebtItem(dItem)}
              >
                <Ionicons
                  name="arrow-forward-circle-outline"
                  size={15}
                  color={COLORS.accent}
                />
                <Text style={styles.paySingleItemBtnText}>
                  {dItem.itemStatus === 'observado'
                    ? 'Enviar comprobante'
                    : 'Imputar pago de este ítem por transferencia'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  );

  const showGlobalKpis = !(subTab === 'invoices' && selectedInvoiceForDetail && Number(billingReport?.totalPendingDebt) > 0);

  return (
    <View style={styles.container}>
      {/* Sub-navegación del Módulo 2 (Solo Facturas por Mes y Deuda por Ítem) */}
      <View style={styles.subTabsBar}>
        <View style={styles.subTabsRow}>
          <TouchableOpacity
            style={[
              styles.subTabBtn,
              subTab === 'invoices' && styles.subTabBtnActive,
            ]}
            onPress={() => {
              setIsUploadingForSelectedMonth(false);
              setSelectedInvoicePeriod(null);
              setSubTab('invoices');
            }}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={subTab === 'invoices' ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.subTabText,
                subTab === 'invoices' && styles.subTabTextActive,
              ]}
            >
              Facturas por Mes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, subTab === 'debt' && styles.subTabBtnActive]}
            onPress={() => {
              setIsUploadingForSelectedMonth(false);
              setSelectedInvoicePeriod(null);
              setSubTab('debt');
            }}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={subTab === 'debt' ? COLORS.white : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.subTabText,
                subTab === 'debt' && styles.subTabTextActive,
              ]}
            >
              Deuda por Ítem ({billingReport.debtItemsHistory.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Resumen Ejecutivo de Saldos */}
        {(showGlobalKpis && billingReport.totalPendingDebt > 0) && (
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderLeftColor: COLORS.rose }]}>
              <Text style={styles.kpiLabel}>DEUDA PENDIENTE</Text>
              <Text style={[styles.kpiValue, { color: COLORS.rose }]}>
                {formatCurrencyARS(billingReport.totalPendingDebt)}
              </Text>
              <Text style={styles.kpiSub}>Sin comprobante cargado</Text>
            </View>

            <View style={[styles.kpiCard, { borderLeftColor: COLORS.amber }]}>
              <Text style={styles.kpiLabel}>EN CONCILIACIÓN</Text>
              <Text style={[styles.kpiValue, { color: COLORS.amber }]}>
                {formatCurrencyARS(billingReport.totalInReviewAmount)}
              </Text>
              <Text style={styles.kpiSub}>Transferencia informada</Text>
            </View>
          </View>
        )}

        {/* SUB-TAB 1: FACTURAS Y COMPROBANTES POR MES (con detalle y carga de comprobantes del mes) */}
        {subTab === 'invoices' && renderInvoicesTab()}

        {/* SUB-TAB 2: HISTORIAL DE DEUDA DISCRIMINADO POR CADA ÍTEM DE PAGO */}
        {subTab === 'debt' && renderDebtTab()}
      </ScrollView>

      <DatePeriodFilterModal
        visible={isPeriodModalOpen}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={(nextFrom, nextTo) => {
          setDateFrom(nextFrom);
          setDateTo(nextTo);
        }}
        onClose={() => setIsPeriodModalOpen(false)}
      />

      <DigitalPaymentReceiptModal
        visible={Boolean(emittedDigitalReceipt)}
        receipt={emittedDigitalReceipt}
        onClose={() => setEmittedDigitalReceipt(null)}
      />

      <RedirectVoucherModal
        visible={Boolean(redirectUrl)}
        secondsLeft={redirectCountdown}
        onCancel={handleCancelRedirect}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  subTabsBar: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  subTabsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  subTabBtnActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  subTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  subTabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
    gap: 16,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  sectionWrap: {
    gap: 14,
  },
  compactFilterContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  periodSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  periodIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodSelectorLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  periodSelectorValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  periodFilterActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  periodFilterActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  segmentedStatusRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  segmentedStatusBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedStatusBtnActive: {
    backgroundColor: COLORS.primary,
  },
  segmentedStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  segmentedStatusTextActive: {
    color: COLORS.white,
  },
  monthsListWrap: {
    gap: 12,
  },
  monthSummaryCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    gap: 12,
  },
  monthCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-center',
    gap: 10,
  },
  monthCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  monthDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  monthCardDueText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  monthCardDivider: {
    height: 1,
    backgroundColor: COLORS.surfaceAlt,
  },
  monthCardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthTotalLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  monthTotalValue: {
    fontSize: 17,
    fontWeight: '900',
    color: COLORS.text,
    marginTop: 2,
  },
  monthPartialPendingText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.rose,
    marginTop: 2,
  },
  monthDetailAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthDetailActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  monthChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToMonthsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backToMonthsText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 18,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  dropdownWrapper: {
    gap: 6,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    gap: 10,
  },
  dropdownTriggerOpen: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.emeraldSoft,
  },
  dropdownTriggerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dropdownTriggerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  dropdownTriggerSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  dropdownMenu: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    overflow: 'hidden',
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
    gap: 8,
  },
  dropdownOptionRowActive: {
    backgroundColor: COLORS.emeraldSoft,
  },
  dropdownOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  dropdownOptionTitleActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  dropdownOptionSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  dropdownOptionSubActive: {
    color: COLORS.emerald,
    fontWeight: '600',
  },
  customDatesSection: {
    gap: 10,
  },
  dateFieldsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  calendarFieldBox: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    gap: 4,
  },
  calendarFieldBoxActive: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.emeraldSoft,
  },
  calendarFieldLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.4,
  },
  calendarFieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  calendarFieldValue: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  calendarFieldValueActive: {
    color: '#065F46',
  },
  transferDateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  autoPeriodHeaderCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  autoPeriodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  autoPeriodTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 1,
  },
  autoPeriodSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalResetBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  modalResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  modalApplyBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.emerald,
  },
  modalApplyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  invoiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoicePeriod: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  invoiceMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  amountsSummaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceAlt,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  amountCol: {
    flex: 1,
  },
  amountSmallLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '700',
  },
  amountBold: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 3,
  },
  subSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  itemsListBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
    gap: 10,
  },
  invoiceItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceItemSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  invoiceItemAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemMiniBadge: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  vouchersBlock: {
    backgroundColor: COLORS.indigoSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.indigoBorder,
    gap: 10,
  },
  vouchersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vouchersHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.indigo,
  },
  noVouchersText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  voucherRowCard: {
    flexDirection: 'col',
    alignItems: 'start',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  voucherCode: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'start',
    width: '120%'
  },
  voucherMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  voucherItemsCovered: {
    fontSize: 11,
    color: COLORS.emerald,
    fontWeight: '600',
    marginTop: 3,
  },
  openFileBtn: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
  },
  openFileBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  payInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.emerald,
    paddingVertical: 12,
    borderRadius: 10,
  },
  payInvoiceBtnResubmit: {
    backgroundColor: COLORS.rose,
  },
  payInvoiceBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  rejectedAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.roseSoft,
    borderColor: COLORS.roseBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
  },
  rejectedAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.rose,
  },
  rejectedAlertText: {
    fontSize: 11,
    color: '#9F1239',
    marginTop: 2,
    lineHeight: 16,
  },
  debtBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: COLORS.roseSoft,
    borderColor: COLORS.roseBorder,
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
  },
  debtBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.rose,
  },
  debtBannerSub: {
    fontSize: 11,
    color: '#9F1239',
    marginTop: 2,
    lineHeight: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  debtItemCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  debtItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryPill: {
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  debtItemPeriod: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  debtItemMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  debtItemLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  debtItemStudent: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  debtItemAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.rose,
  },
  debtItemStatusText: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  paySingleItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceAlt,
  },
  paySingleItemBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  bankDataCard: {
    backgroundColor: COLORS.emeraldSoft,
    borderColor: COLORS.emeraldBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  bankHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  bankHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  bankLine: {
    fontSize: 11,
    color: '#064E3B',
  },
  bankBold: {
    fontWeight: '800',
  },
  formSectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  stepHeaderBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  multiVoucherNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.indigoSoft,
    padding: 9,
    borderRadius: 8,
    marginTop: 4,
  },
  multiVoucherNoticeText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.indigo,
  },
  checkItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  checkItemCardSelected: {
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.emeraldSoft,
  },
  checkItemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  checkItemSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  alreadyCoveredTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.amber,
    marginTop: 2,
  },
  observedItemTag: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.rose,
    marginTop: 2,
  },
  checkItemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  selectedSubtotalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 4,
  },
  selectedSubtotalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  selectedSubtotalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.white,
  },
  fieldWrap: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  filePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.emerald,
    backgroundColor: COLORS.emeraldSoft,
    padding: 12,
    borderRadius: 10,
  },
  filePickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  filePickerSub: {
    fontSize: 11,
    color: COLORS.emerald,
    marginTop: 2,
  },
  submitVoucherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.emerald,
    paddingVertical: 13,
    borderRadius: 10,
    marginTop: 6,
  },
  submitVoucherBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  redirectModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  redirectModalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  redirectIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  redirectModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  redirectModalMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  redirectProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    width: '100%',
  },
  redirectCountdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.emerald,
  },
  redirectCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.background,
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  redirectCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default BillingScreen;
