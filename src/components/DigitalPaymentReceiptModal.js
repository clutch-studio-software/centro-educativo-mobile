import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { COLORS, formatCurrencyARS } from '../theme/colors';

const DigitalPaymentReceiptModal = ({ visible, receipt, onClose }) => {
  const [exporting, setExporting] = useState(false);

  if (!receipt) return null;

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const itemsHtml = (receipt.selectedItems || [])
        .map(
          (i) => `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;">
              <strong>${i.label}</strong><br/>
              <span style="color:#64748b;font-size:11px;">Alumno: ${i.studentName || ''}</span>
            </td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;font-size:12px;">
              ${formatCurrencyARS(i.amount)}
            </td>
          </tr>`
        )
        .join('');

      const html = `
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Comprobante ${receipt.digitalReceiptNumber}</title>
          </head>
          <body style="font-family:Helvetica,Arial,sans-serif;padding:24px;color:#0f172a;">
            <div style="border:2px solid #059669;border-radius:10px;padding:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #cbd5e1;padding-bottom:12px;margin-bottom:16px;">
                <div>
                  <h2 style="margin:0;color:#0f172a;font-size:18px;">CENTRO EDUCATIVO "EDUCAR PARA TRANSFORMAR"</h2>
                  <p style="margin:4px 0 0;font-size:12px;color:#475569;">Resistencia, Chaco · Constancia Digital de Recepción de Transferencia</p>
                </div>
                <div style="text-align:right;">
                  <span style="background:#ecfdf5;color:#059669;padding:4px 10px;border-radius:6px;font-weight:700;font-size:12px;">
                    ${receipt.digitalReceiptNumber}
                  </span>
                </div>
              </div>

              <table style="width:100%;font-size:12px;margin-bottom:16px;">
                <tr>
                  <td style="padding:4px 0;"><strong>Fecha de Emisión:</strong> ${receipt.issuedAt}</td>
                  <td style="padding:4px 0;"><strong>Período Imputado:</strong> ${receipt.invoicePeriod}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><strong>Tutor Responsable:</strong> ${receipt.tutorName} (DNI ${receipt.tutorDni})</td>
                  <td style="padding:4px 0;"><strong>Código Familiar:</strong> ${receipt.familyCode}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;"><strong>Medio de Pago:</strong> ${receipt.paymentMethod} (${receipt.originBank})</td>
                  <td style="padding:4px 0;"><strong>Código de Operación:</strong> ${receipt.operationCode}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;" colspan="2"><strong>Archivo Adjunto en Storage:</strong> ${receipt.fileName}</td>
                </tr>
              </table>

              <h4 style="margin:12px 0 6px;font-size:13px;color:#334155;">Ítems Seleccionados Abonados en esta Transferencia:</h4>
              <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead>
                  <tr style="background:#f1f5f9;font-size:11px;text-align:left;">
                    <th style="padding:8px 10px;">Concepto / Alumno</th>
                    <th style="padding:8px 10px;text-align:right;">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
                <tfoot>
                  <tr style="background:#ecfdf5;">
                    <td style="padding:10px;font-weight:700;color:#065f46;">MONTO TOTAL TRANSFERIDO DECLARADO</td>
                    <td style="padding:10px;text-align:right;font-weight:800;font-size:15px;color:#059669;">
                      ${formatCurrencyARS(receipt.totalTransferred)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <p style="font-size:11px;color:#64748b;margin:0;">
                Estado: <strong>${receipt.statusLabel}</strong>. Este comprobante acredita la carga de la transferencia bancaria y los conceptos seleccionados en el sistema institucional.
              </p>
            </div>
          </body>
        </html>
      `;

      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Comprobante ${receipt.digitalReceiptNumber}`,
            UTI: 'com.adobe.pdf',
          });
        } else {
          await Print.printAsync({ html });
        }
      }
    } catch (err) {
      console.warn('Aviso exportando PDF:', err?.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.topBanner}>
            <View style={styles.badgeIcon}>
              <Ionicons name="checkmark-done-circle" size={28} color={COLORS.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTag}>COMPROBANTE DIGITAL EMITIDO</Text>
              <Text style={styles.bannerTitle}>{receipt.digitalReceiptNumber}</Text>
              <Text style={styles.bannerSub}>{receipt.issuedAt}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeIconBtn}>
              <Ionicons name="close" size={22} color={COLORS.white} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 16 }}>
            <View style={styles.infoGrid}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Institución:</Text>
                <Text style={styles.infoValue}>Educar para Transformar</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Período Imputado:</Text>
                <Text style={styles.infoValue}>{receipt.invoicePeriod}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tutor Titular:</Text>
                <Text style={styles.infoValue}>
                  {receipt.tutorName} (DNI {receipt.tutorDni})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Modalidad:</Text>
                <Text style={styles.infoValue}>Transferencia ({receipt.originBank})</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nº Operación:</Text>
                <Text style={styles.infoValueMono}>{receipt.operationCode}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Archivo Adjunto:</Text>
                <Text style={styles.infoValue} numberOfLines={1}>
                  {receipt.fileName}
                </Text>
              </View>
            </View>

            <Text style={styles.sectionHeader}>
              ÍTEMS SELECCIONADOS ABONADOS ({receipt.selectedItems?.length || 0}):
            </Text>
            <View style={styles.itemsBox}>
              {(receipt.selectedItems || []).map((item) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.label}</Text>
                    <Text style={styles.itemSub}>Alumno: {item.studentName}</Text>
                  </View>
                  <Text style={styles.itemAmount}>{formatCurrencyARS(item.amount)}</Text>
                </View>
              ))}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL TRANSFERIDO</Text>
                <Text style={styles.totalValue}>
                  {formatCurrencyARS(receipt.totalTransferred)}
                </Text>
              </View>
            </View>

            <View style={styles.statusNotice}>
              <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.emerald} />
              <Text style={styles.statusNoticeText}>
                {receipt.statusLabel}. El comprobante quedó vinculado a la factura de{' '}
                {receipt.invoicePeriod} y al legajo del alumno en tiempo real.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footerActions}>
            <TouchableOpacity
              style={styles.pdfBtn}
              onPress={handleExportPdf}
              disabled={exporting}
            >
              <Ionicons name="download-outline" size={18} color={COLORS.white} />
              <Text style={styles.pdfBtnText}>
                {exporting ? 'Generando PDF...' : 'Descargar / Compartir PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topBanner: {
    backgroundColor: COLORS.emerald,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTag: {
    fontSize: 10,
    fontWeight: '800',
    color: '#A7F3D0',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  bannerSub: {
    fontSize: 11,
    color: '#ECFDF5',
    marginTop: 1,
  },
  closeIconBtn: {
    padding: 4,
  },
  body: {
    padding: 16,
  },
  infoGrid: {
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoValueMono: {
    fontSize: 12,
    color: COLORS.emerald,
    fontWeight: '800',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  itemsBox: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceAlt,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemSub: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  itemAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.emerald,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.emerald,
  },
  statusNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: COLORS.emeraldBorder,
    borderRadius: 8,
    padding: 10,
  },
  statusNoticeText: {
    flex: 1,
    fontSize: 11,
    color: '#065F46',
    lineHeight: 16,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  pdfBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    borderRadius: 8,
  },
  pdfBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '700',
  },
  doneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
});

export default DigitalPaymentReceiptModal;
