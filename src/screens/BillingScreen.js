import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, formatCurrencyARS } from '../theme/colors';
import {
  BILLING_PERIODS_CATALOG,
  buildBillingInvoicesAndDebtReport,
  submitTransferVoucherWithItems,
} from '../services/billingMobileService';
import { pickAllowedDocument, formatFileSize } from '../services/storageMobileService';
import {
  buildMonthlyReminderEmailPayload,
  buildDay20DebtEmailPayload,
  triggerBillingEmailNotification,
} from '../services/emailNotificationsService';
import DigitalPaymentReceiptModal from '../components/DigitalPaymentReceiptModal';

const BANK_OPTIONS = [
  'Banco Santander Río',
  'Banco Nación',
  'Banco Galicia',
  'Nuevo Banco del Chaco (NBCH)',
  'Banco Macro',
  'Mercado Pago',
];

const getItemStatusBadge = (itemStatus) => {
  if (itemStatus === 'conciliado') {
    return { color: COLORS.emerald, label: '✓ Pagado' };
  }
  if (itemStatus === 'en_revision') {
    return { color: COLORS.amber, label: '⏳ En revisión' };
  }
  return { color: COLORS.rose, label: '• Pendiente' };
};

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
  const [subTab, setSubTab] = useState('invoices'); // 'invoices' | 'debt' | 'pay' | 'emails'
  const [dateFrom, setDateFrom] = useState('2026-08-01');
  const [dateTo, setDateTo] = useState('2026-11-30');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'paid'

  // Estado para el formulario de pago con selección de ítems
  const [targetPeriod, setTargetPeriod] = useState('Noviembre 2026');
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [customAmount, setCustomAmount] = useState('');
  const [operationCode, setOperationCode] = useState('');
  const [originBank, setOriginBank] = useState('Banco Santander Río');
  const [transferDate, setTransferDate] = useState('2026-11-06');
  const [pickedFile, setPickedFile] = useState(null);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [emittedDigitalReceipt, setEmittedDigitalReceipt] = useState(null);

  // Estado para avisos automáticos por correo
  const [sendingEmailType, setSendingEmailType] = useState(null);
  const [previewEmailPayload, setPreviewEmailPayload] = useState(null);

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
      return selectedItemIds.filter((id) => selectableItems.some((item) => item.id === id));
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
    const pendingIds = selectableItems.filter((i) => !i.isPaidOrInReview).map((i) => i.id);
    const idsToUse = pendingIds.length > 0 ? pendingIds : selectableItems.map((i) => i.id);
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
        message: 'Seleccione al menos un ítem (Cuota, Comedor, Transporte o Deporte) a abonar.',
      });
      return;
    }
    if (!operationCode.trim()) {
      onFeedback?.({
        type: 'error',
        message: 'Ingrese el código o número de operación de la transferencia bancaria.',
      });
      return;
    }
    if (!pickedFile) {
      onFeedback?.({
        type: 'error',
        message: 'Adjunte el archivo del comprobante bancario (PDF, PNG o JPG hasta 2 MB).',
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
        declaredAmount: Number(customAmount) > 0 ? Number(customAmount) : selectedItemsTotal,
        operationCode: operationCode.trim(),
        originBank,
        transferDate,
        fileAsset: pickedFile,
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
    setTargetPeriod(debtItem.period || 'Noviembre 2026');
    setSelectedItemIds([debtItem.id]);
    setCustomAmount(String(debtItem.amount));
    setSubTab('pay');
  };

  const handleTriggerEmail = async (mode) => {
    setSendingEmailType(mode);
    try {
      const currentInv = billingReport.allInvoices[0];
      const payload =
        mode === 'reminder'
          ? buildMonthlyReminderEmailPayload({
              tutorUser: user,
              currentInvoice: currentInv,
            })
          : buildDay20DebtEmailPayload({
              tutorUser: user,
              debtItems: billingReport.debtItemsHistory.filter(
                (i) => i.itemStatus === 'pendiente_pago'
              ),
              totalPendingDebt: billingReport.totalPendingDebt,
              periodLabel: currentInv?.period || 'Noviembre 2026',
            });

      setPreviewEmailPayload(payload);
      const res = await triggerBillingEmailNotification(payload);
      onFeedback?.({
        type: 'success',
        message: res.message,
      });
    } catch (err) {
      onFeedback?.({
        type: 'error',
        message: err?.message || 'No se pudo procesar el aviso por correo.',
      });
    } finally {
      setSendingEmailType(null);
    }
  };

  const renderStatusBadge = (status, statusLabel) => {
    let bg = COLORS.amberSoft;
    let border = COLORS.amberBorder;
    let text = COLORS.amber;
    let icon = 'time-outline';

    if (status === 'conciliado') {
      bg = COLORS.emeraldSoft;
      border = COLORS.emeraldBorder;
      text = COLORS.emerald;
      icon = 'checkmark-circle';
    } else if (status === 'rechazado') {
      bg = COLORS.roseSoft;
      border = COLORS.roseBorder;
      text = COLORS.rose;
      icon = 'alert-circle';
    } else if (status === 'sin_comprobante') {
      bg = COLORS.roseSoft;
      border = COLORS.roseBorder;
      text = COLORS.rose;
      icon = 'warning-outline';
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons name={icon} size={13} color={text} />
        <Text style={[styles.statusBadgeText, { color: text }]}>{statusLabel}</Text>
      </View>
    );
  };

  const renderInvoicesTab = () => (
    <View style={styles.sectionWrap}>
      {/* Filtro por Período de Fechas */}
      <View style={styles.filterCard}>
        <View style={styles.filterHeader}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
          <Text style={styles.filterTitle}>
            Filtrar Facturas y Comprobantes por Período de Fechas
          </Text>
        </View>

        <View style={styles.dateInputsRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Desde (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="2026-06-01"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Hasta (AAAA-MM-DD)</Text>
            <TextInput
              style={styles.dateInput}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="2026-11-30"
            />
          </View>
        </View>

        <View style={styles.presetRow}>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => {
              setDateFrom('2026-11-01');
              setDateTo('2026-11-30');
            }}
          >
            <Text style={styles.presetChipText}>Mes Actual (Nov)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => {
              setDateFrom('2026-09-01');
              setDateTo('2026-11-30');
            }}
          >
            <Text style={styles.presetChipText}>Últimos 3 Meses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.presetChip}
            onPress={() => {
              setDateFrom('2026-03-01');
              setDateTo('2026-12-31');
            }}
          >
            <Text style={styles.presetChipText}>Todo el Ciclo 2026</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusFilterRow}>
          {[
            { id: 'all', label: 'Todas las facturas' },
            { id: 'pending', label: 'Pendientes' },
            { id: 'paid', label: 'Conciliadas' },
          ].map((st) => (
            <TouchableOpacity
              key={st.id}
              style={[
                styles.statusFilterChip,
                statusFilter === st.id && styles.statusFilterChipActive,
              ]}
              onPress={() => setStatusFilter(st.id)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  statusFilter === st.id && styles.statusFilterTextActive,
                ]}
              >
                {st.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Listado de Facturas y sus Comprobantes Asociados */}
      {displayedInvoices.map((inv) => (
        <View key={inv.id} style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.invoicePeriod}>{inv.period}</Text>
              <Text style={styles.invoiceMeta}>
                Vencimiento: {inv.dueDate}
              </Text>
            </View>
            {renderStatusBadge(inv.status, inv.statusLabel)}
          </View>

          <View style={styles.amountsSummaryBar}>
            <View>
              <Text style={styles.amountSmallLabel}>Importe Total</Text>
              <Text style={styles.amountBold}>{formatCurrencyARS(inv.totalAmount)}</Text>
            </View>
            <View>
              <Text style={styles.amountSmallLabel}>Cubierto / En Rev.</Text>
              <Text style={[styles.amountBold, { color: COLORS.emerald }]}>
                {formatCurrencyARS(inv.coveredAmount)}
              </Text>
            </View>
            <View>
              <Text style={styles.amountSmallLabel}>Saldo Pendiente</Text>
              <Text
                style={[
                  styles.amountBold,
                  { color: inv.pendingBalance > 0 ? COLORS.rose : COLORS.emerald },
                ]}
              >
                {formatCurrencyARS(inv.pendingBalance)}
              </Text>
            </View>
          </View>

          {/* Composición de Ítems de la Factura */}
          <Text style={styles.subSectionLabel}>
            COMPOSICIÓN DE ÍTEMS ({inv.items.length}):
          </Text>
          <View style={styles.itemsListBox}>
            {inv.items.map((item) => (
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
                  <Text
                    style={[
                      styles.itemMiniBadge,
                      { color: getItemStatusBadge(item.itemStatus).color },
                    ]}
                  >
                    {getItemStatusBadge(item.itemStatus).label}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Comprobantes de Pago Asociados a esta Factura (Soporta 1 o más comprobantes) */}
          <View style={styles.vouchersBlock}>
            <View style={styles.vouchersHeaderRow}>
              <Ionicons name="document-attach-outline" size={15} color={COLORS.indigo} />
              <Text style={styles.vouchersHeaderTitle}>
                Comprobantes de Transferencia Asociados ({inv.vouchers.length})
              </Text>
            </View>

            {inv.vouchers.length === 0 ? (
              <Text style={styles.noVouchersText}>
                No se registran comprobantes bancarios asociados a esta factura.
              </Text>
            ) : (
              inv.vouchers.map((v, vIdx) => (
                <View key={`${v.id}-${vIdx}`} style={styles.voucherRowCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.voucherCode}>
                      #{vIdx + 1} · Op: {v.operationCode} ({v.originBank})
                    </Text>
                    <Text style={styles.voucherMeta}>
                      Fecha: {v.operationDate} · Monto:{' '}
                      {formatCurrencyARS(v.transferredAmount)} · {v.voucherStatus}
                    </Text>
                    {v.selectedItemLabels?.length > 0 && (
                      <Text style={styles.voucherItemsCovered}>
                        Ítems imputados: {v.selectedItemLabels.join(' + ')}
                      </Text>
                    )}
                  </View>
                  {v.fileUrl ? (
                    <TouchableOpacity
                      style={styles.openFileBtn}
                      onPress={() => Linking.openURL(v.fileUrl)}
                    >
                      <Ionicons name="open-outline" size={14} color={COLORS.emerald} />
                      <Text style={styles.openFileBtnText}>Ver Archivo</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>

          {inv.pendingBalance > 0 && (
            <TouchableOpacity
              style={styles.payInvoiceBtn}
              onPress={() => {
                setTargetPeriod(inv.period);
                setSelectedItemIds(
                  inv.items.filter((i) => !i.isPaidOrInReview).map((i) => i.id)
                );
                setCustomAmount(String(inv.pendingBalance));
                setSubTab('pay');
              }}
            >
              <Ionicons name="card-outline" size={16} color={COLORS.white} />
              <Text style={styles.payInvoiceBtnText}>
                Seleccionar Ítems Pendientes y Cargar Comprobante
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );

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
          <Ionicons name="checkmark-done-circle" size={38} color={COLORS.emerald} />
          <Text style={styles.emptyTitle}>Sin Deuda Registrada en el Período</Text>
          <Text style={styles.emptySub}>
            Todos los ítems de cuota, comedor, transporte y deportes se encuentran conciliados.
          </Text>
        </View>
      ) : (
        billingReport.debtItemsHistory.map((dItem) => (
          <View key={`${dItem.invoiceId}-${dItem.id}`} style={styles.debtItemCard}>
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
                        dItem.itemStatus === 'en_revision' ? COLORS.amber : COLORS.rose,
                    },
                  ]}
                >
                  {dItem.itemStatus === 'en_revision'
                    ? 'Comprobante en Revisión'
                    : 'Pendiente de Transferencia'}
                </Text>
              </View>
            </View>

            {dItem.itemStatus === 'pendiente_pago' && (
              <TouchableOpacity
                style={styles.paySingleItemBtn}
                onPress={() => handleQuickPayFromDebtItem(dItem)}
              >
                <Ionicons name="arrow-forward-circle-outline" size={15} color={COLORS.accent} />
                <Text style={styles.paySingleItemBtnText}>
                  Imputar pago de este ítem por transferencia
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
    </View>
  );

  const renderPayTab = () => (
    <View style={styles.sectionWrap}>
      {/* Datos Bancarios Oficiales (Sin efectivo) */}
      <View style={styles.bankDataCard}>
        <View style={styles.bankHeaderRow}>
          <Ionicons name="business-outline" size={18} color={COLORS.emerald} />
          <Text style={styles.bankHeaderTitle}>
            Pago Exclusivo por Transferencia Bancaria (No se admite efectivo)
          </Text>
        </View>
        <Text style={styles.bankLine}>
          • Banco: <Text style={styles.bankBold}>Banco Santander Río</Text> · Titular:{' '}
          <Text style={styles.bankBold}>Centro Educativo Integral SRL</Text>
        </Text>
        <Text style={styles.bankLine}>
          • CBU: <Text style={styles.bankBold}>0720026720000001289412</Text> · Alias:{' '}
          <Text style={[styles.bankBold, { color: COLORS.emerald }]}>
            COLEGIO.CENTRO.PAGOS
          </Text>
        </Text>
      </View>

      {/* Paso 1: Elegir Período / Factura */}
      <View style={styles.formSectionCard}>
        <Text style={styles.stepTitle}>
          1. Seleccione el Período de Factura a Imputar
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginTop: 8 }}
        >
          {BILLING_PERIODS_CATALOG.slice(0, 3).map((p) => {
            const active = targetPeriod === p.label;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.periodOption, active && styles.periodOptionActive]}
                onPress={() => {
                  setTargetPeriod(p.label);
                  setSelectedItemIds([]);
                  setCustomAmount('');
                }}
              >
                <Text
                  style={[
                    styles.periodOptionText,
                    active && styles.periodOptionTextActive,
                  ]}
                >
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {activeInvoiceForPayment?.vouchersCount > 0 && (
          <View style={styles.multiVoucherNotice}>
            <Ionicons name="layers-outline" size={16} color={COLORS.indigo} />
            <Text style={styles.multiVoucherNoticeText}>
              Esta factura ya cuenta con {activeInvoiceForPayment.vouchersCount}{' '}
              comprobante(s) cargado(s). Puede adjuntar un nuevo comprobante adicional seleccionando los ítems restantes.
            </Text>
          </View>
        )}
      </View>

      {/* Paso 2: Seleccionar los Ítems a Pagar */}
      <View style={styles.formSectionCard}>
        <View style={styles.stepHeaderBetween}>
          <Text style={styles.stepTitle}>
            2. Seleccione los Ítems a Pagar ({selectedItemsObjects.length} elegidos)
          </Text>
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

      {/* Paso 3: Datos de la Transferencia y Archivo en Storage */}
      <View style={styles.formSectionCard}>
        <Text style={styles.stepTitle}>
          3. Datos de la Transferencia y Comprobante (Máx. 2 MB)
        </Text>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Monto Declarado Transferido ($ ARS) *</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={customAmount !== '' ? customAmount : String(selectedItemsTotal)}
            onChangeText={setCustomAmount}
            placeholder="Ej: 110000"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Código / Nº de Operación Bancaria *</Text>
          <TextInput
            style={styles.textInput}
            value={operationCode}
            onChangeText={setOperationCode}
            placeholder="Ej: TRF-9928310"
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Banco / Billetera de Origen</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginTop: 4 }}
          >
            {BANK_OPTIONS.map((bank) => (
              <TouchableOpacity
                key={bank}
                style={[
                  styles.bankChip,
                  originBank === bank && styles.bankChipActive,
                ]}
                onPress={() => setOriginBank(bank)}
              >
                <Text
                  style={[
                    styles.bankChipText,
                    originBank === bank && styles.bankChipTextActive,
                  ]}
                >
                  {bank}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>Fecha de Transferencia (AAAA-MM-DD)</Text>
          <TextInput
            style={styles.textInput}
            value={transferDate}
            onChangeText={setTransferDate}
            placeholder="2026-11-06"
          />
        </View>

        <View style={styles.fieldWrap}>
          <Text style={styles.inputLabel}>
            Archivo del Comprobante (.pdf, .png, .jpg, .jpeg — máx. 2 MB) *
          </Text>
          <TouchableOpacity
            style={styles.filePickerBtn}
            onPress={handlePickVoucherFile}
          >
            <Ionicons name="document-attach" size={20} color={COLORS.emerald} />
            <View style={{ flex: 1 }}>
              <Text style={styles.filePickerTitle}>
                {pickedFile
                  ? pickedFile.name
                  : 'Seleccionar Comprobante Bancario (PDF / Imagen)'}
              </Text>
              <Text style={styles.filePickerSub}>
                {pickedFile
                  ? `Tamaño: ${formatFileSize(pickedFile.size)} · Tipo: ${pickedFile.mimeType}`
                  : 'Se almacenará de forma segura en Firebase Storage (vouchers/{uid}/...)'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitVoucherBtn, submittingPayment && { opacity: 0.65 }]}
          onPress={handleSubmitVoucher}
          disabled={submittingPayment}
        >
          {submittingPayment ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="checkmark-done-circle" size={19} color={COLORS.white} />
              <Text style={styles.submitVoucherBtnText}>
                Confirmar Pago y Emitir Comprobante Digital
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmailsTab = () => (
    <View style={styles.sectionWrap}>
      <View style={styles.emailRuleCard}>
        <View style={styles.emailRuleHeader}>
          <View style={styles.emailIconBox}>
            <Ionicons name="calendar" size={20} color={COLORS.emerald} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emailRuleTitle}>
              Hito 1: Recordatorio del Último Día Hábil del Mes
            </Text>
            <Text style={styles.emailRuleDesc}>
              Envía por mail a cada padre el total que debe abonar, detallando la composición de ese valor (Cuota + Comedor + Transporte + Deportes) y adjuntando la factura.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.triggerEmailBtn}
          onPress={() => handleTriggerEmail('reminder')}
          disabled={sendingEmailType === 'reminder'}
        >
          <Ionicons name="send-outline" size={15} color={COLORS.white} />
          <Text style={styles.triggerEmailBtnText}>
            {sendingEmailType === 'reminder'
              ? 'Generando y enviando...'
              : 'Generar y Enviar Recordatorio de Fin de Mes'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.emailRuleCard}>
        <View style={styles.emailRuleHeader}>
          <View style={[styles.emailIconBox, { backgroundColor: COLORS.roseSoft }]}>
            <Ionicons name="alert-circle" size={20} color={COLORS.rose} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.emailRuleTitle}>
              Hito 2: Aviso de Deuda del Día 20 de cada Mes
            </Text>
            <Text style={styles.emailRuleDesc}>
              Envía el día 20 de cada mes a cada padre el estado de deuda discriminado por ítem en caso de no haber registrado el pago completo del período.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.triggerEmailBtn, { backgroundColor: COLORS.rose }]}
          onPress={() => handleTriggerEmail('debt20')}
          disabled={sendingEmailType === 'debt20'}
        >
          <Ionicons name="warning-outline" size={15} color={COLORS.white} />
          <Text style={styles.triggerEmailBtnText}>
            {sendingEmailType === 'debt20'
              ? 'Generando aviso...'
              : 'Generar y Enviar Aviso de Deuda (Día 20)'}
          </Text>
        </TouchableOpacity>
      </View>

      {previewEmailPayload && (
        <View style={styles.emailPreviewCard}>
          <Text style={styles.emailPreviewTag}>
            PREVISUALIZACIÓN DEL CORREO GENERADO ({previewEmailPayload.scheduledRule})
          </Text>
          <Text style={styles.emailPreviewLine}>
            Para: <Text style={{ fontWeight: '700' }}>{previewEmailPayload.to}</Text>
          </Text>
          <Text style={styles.emailPreviewLine}>
            Asunto: <Text style={{ fontWeight: '700' }}>{previewEmailPayload.subject}</Text>
          </Text>
          <View style={styles.emailPreviewDivider} />
          {(previewEmailPayload.items || previewEmailPayload.debtItems || []).map(
            (it, idx) => (
              <View key={idx} style={styles.emailPreviewItem}>
                <Text style={styles.emailPreviewItemText}>
                  • {it.label} ({it.studentName})
                </Text>
                <Text style={styles.emailPreviewItemAmount}>
                  {formatCurrencyARS(it.amount)}
                </Text>
              </View>
            )
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Sub-navegación del Módulo 2 */}
      <View style={styles.subTabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subTabsScroll}
        >
          <TouchableOpacity
            style={[styles.subTabBtn, subTab === 'invoices' && styles.subTabBtnActive]}
            onPress={() => setSubTab('invoices')}
          >
            <Ionicons
              name="receipt-outline"
              size={15}
              color={subTab === 'invoices' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.subTabText, subTab === 'invoices' && styles.subTabTextActive]}>
              Facturas y Comprobantes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, subTab === 'debt' && styles.subTabBtnActive]}
            onPress={() => setSubTab('debt')}
          >
            <Ionicons
              name="list-outline"
              size={15}
              color={subTab === 'debt' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.subTabText, subTab === 'debt' && styles.subTabTextActive]}>
              Deuda por Ítem ({billingReport.debtItemsHistory.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, subTab === 'pay' && styles.subTabBtnActive]}
            onPress={() => setSubTab('pay')}
          >
            <Ionicons
              name="cloud-upload-outline"
              size={15}
              color={subTab === 'pay' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.subTabText, subTab === 'pay' && styles.subTabTextActive]}>
              Seleccionar Ítems y Pagar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.subTabBtn, subTab === 'emails' && styles.subTabBtnActive]}
            onPress={() => setSubTab('emails')}
          >
            <Ionicons
              name="mail-unread-outline"
              size={15}
              color={subTab === 'emails' ? COLORS.white : COLORS.textSecondary}
            />
            <Text style={[styles.subTabText, subTab === 'emails' && styles.subTabTextActive]}>
              Avisos Email (Día 20 / Fin de Mes)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Resumen Ejecutivo de Saldos */}
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

        {/* SUB-TAB 1: FACTURAS Y COMPROBANTES ASOCIADOS EN UN PERÍODO DE FECHAS */}
        {subTab === 'invoices' && renderInvoicesTab()}

        {/* SUB-TAB 2: HISTORIAL DE DEUDA DISCRIMINADO POR CADA ÍTEM DE PAGO */}
        {subTab === 'debt' && renderDebtTab()}

        {/* SUB-TAB 3: SELECCIONAR ÍTEMS A PAGAR Y CARGAR COMPROBANTE DE TRANSFERENCIA */}
        {subTab === 'pay' && renderPayTab()}

        {/* SUB-TAB 4: AUTOMATIZACIÓN DE NOTIFICACIONES POR CORREO (ÚLTIMO DÍA HÁBIL Y DÍA 20) */}
        {subTab === 'emails' && renderEmailsTab()}
      </ScrollView>

      <DigitalPaymentReceiptModal
        visible={Boolean(emittedDigitalReceipt)}
        receipt={emittedDigitalReceipt}
        onClose={() => setEmittedDigitalReceipt(null)}
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
    paddingVertical: 8,
  },
  subTabsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
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
    padding: 14,
    paddingBottom: 32,
    gap: 14,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
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
    fontSize: 17,
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
  filterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  statusFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  statusFilterChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  statusFilterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  statusFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  statusFilterTextActive: {
    color: COLORS.white,
  },
  invoiceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  invoicePeriod: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  invoiceMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
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
    padding: 10,
    borderRadius: 10,
  },
  amountSmallLabel: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontWeight: '600',
  },
  amountBold: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.text,
    marginTop: 2,
  },
  subSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
  },
  itemsListBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
  },
  invoiceItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
    gap: 8,
  },
  invoiceItemLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  invoiceItemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  invoiceItemAmount: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  itemMiniBadge: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  vouchersBlock: {
    backgroundColor: COLORS.indigoSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.indigoBorder,
    gap: 8,
  },
  vouchersHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  vouchersHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.indigo,
  },
  noVouchersText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  voucherRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  voucherCode: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  voucherMeta: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 1,
  },
  voucherItemsCovered: {
    fontSize: 10,
    color: COLORS.emerald,
    fontWeight: '600',
    marginTop: 2,
  },
  openFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
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
    gap: 6,
    backgroundColor: COLORS.emerald,
    paddingVertical: 11,
    borderRadius: 9,
  },
  payInvoiceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.white,
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
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
  periodOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.background,
  },
  periodOptionActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  periodOptionText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  periodOptionTextActive: {
    color: COLORS.white,
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
  bankChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.background,
  },
  bankChipActive: {
    backgroundColor: COLORS.emerald,
    borderColor: COLORS.emerald,
  },
  bankChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  bankChipTextActive: {
    color: COLORS.white,
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
  emailRuleCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  emailRuleHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  emailIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.emeraldSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailRuleTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  emailRuleDesc: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 16,
  },
  triggerEmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.emerald,
    paddingVertical: 10,
    borderRadius: 8,
  },
  triggerEmailBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  emailPreviewCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.indigoBorder,
    gap: 6,
  },
  emailPreviewTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.indigo,
    letterSpacing: 0.5,
  },
  emailPreviewLine: {
    fontSize: 12,
    color: COLORS.text,
  },
  emailPreviewDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 4,
  },
  emailPreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  emailPreviewItemText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  emailPreviewItemAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
});

export default BillingScreen;
