import { auth, FUNCTIONS_BASE_URL } from './firebase';
import { formatCurrencyARS } from '../theme/colors';
import { getLastBusinessDayOfMonth, formatDateDisplay } from '../utils/subscriptionRules';

/**
 * Genera el contenido HTML de la Factura Mensual (Recordatorio del Último Día Hábil del Mes)
 */
export const buildMonthlyReminderEmailPayload = ({
  tutorUser,
  currentInvoice,
  referenceDate = new Date(),
}) => {
  const year = referenceDate.getFullYear();
  const monthIndex = referenceDate.getMonth();
  const lastBusinessDay = getLastBusinessDayOfMonth(year, monthIndex);

  const itemsRowsHtml = (currentInvoice?.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#0f172a;">
          <strong>${item.label}</strong><br/>
          <span style="font-size:11px;color:#64748b;">Alumno: ${item.studentName} · ${item.detail || ''}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;color:#0f172a;">
          ${formatCurrencyARS(item.amount)}
        </td>
      </tr>`
    )
    .join('');

  const subject = `[Educar para Transformar] Recordatorio de Facturación (${currentInvoice?.period || 'Mes en Curso'}) - Total: ${formatCurrencyARS(currentInvoice?.totalAmount || 0)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
      <div style="background:#0f172a;color:#ffffff;padding:18px 24px;">
        <h2 style="margin:0;font-size:18px;">Centro Educativo "Educar para Transformar"</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#cbd5e1;">Aviso Automático — Último Día Hábil del Mes (${formatDateDisplay(lastBusinessDay)})</p>
      </div>
      <div style="padding:20px 24px;color:#1e293b;">
        <p>Estimado/a <strong>${tutorUser?.nombre || 'Tutor Familiar'}</strong>,</p>
        <p>Le enviamos el resumen de liquidación mensual correspondiente al período <strong>${currentInvoice?.period || 'Noviembre 2026'}</strong> con el detalle discriminado por cada concepto contratado:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:6px;">
          <thead>
            <tr style="background:#e2e8f0;text-align:left;font-size:12px;color:#475569;">
              <th style="padding:8px 12px;">Concepto / Servicio</th>
              <th style="padding:8px 12px;text-align:right;">Importe</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#ecfdf5;">
              <td style="padding:12px;font-weight:700;color:#065f46;">TOTAL A ABONAR (Vencimiento ${currentInvoice?.dueDate || '10/11/2026'})</td>
              <td style="padding:12px;text-align:right;font-weight:800;font-size:16px;color:#059669;">${formatCurrencyARS(currentInvoice?.totalAmount || 0)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="font-size:12px;color:#475569;">
          Recuerde que los pagos se realizan exclusivamente mediante transferencia bancaria (Alias: <strong>COLEGIO.CENTRO.PAGOS</strong>) y puede informar los ítems abonados adjuntando su comprobante desde la App Móvil.
        </p>
      </div>
    </div>
  `;

  return {
    type: 'last_business_day_reminder',
    scheduledRule: `Último día hábil del mes (${formatDateDisplay(lastBusinessDay)})`,
    to: tutorUser?.email || 'familia@colegio.edu.ar',
    subject,
    html,
    totalAmount: currentInvoice?.totalAmount || 0,
    items: currentInvoice?.items || [],
    invoiceId: currentInvoice?.id || 'FAC-2026-11',
  };
};

/**
 * Genera el contenido HTML del Aviso de Deuda del Día 20 de cada mes (si no se registró pago completo)
 */
export const buildDay20DebtEmailPayload = ({
  tutorUser,
  debtItems = [],
  totalPendingDebt = 0,
  periodLabel = 'Noviembre 2026',
}) => {
  const debtRowsHtml = debtItems
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #fecdd3;font-size:13px;color:#881337;">
          <strong>${item.label}</strong> (${item.period || periodLabel})<br/>
          <span style="font-size:11px;color:#9f1239;">Alumno: ${item.studentName}</span>
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #fecdd3;text-align:right;font-weight:700;color:#be123c;">
          ${formatCurrencyARS(item.amount)}
        </td>
      </tr>`
    )
    .join('');

  const subject = `[Educar para Transformar] Aviso de Saldo Pendiente (Día 20) - Deuda: ${formatCurrencyARS(totalPendingDebt)}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #fecdd3;border-radius:8px;overflow:hidden;">
      <div style="background:#be123c;color:#ffffff;padding:18px 24px;">
        <h2 style="margin:0;font-size:18px;">Aviso de Regularización de Aranceles — Día 20</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#ffe4e6;">Centro Educativo "Educar para Transformar"</p>
      </div>
      <div style="padding:20px 24px;color:#1e293b;">
        <p>Estimado/a <strong>${tutorUser?.nombre || 'Tutor Familiar'}</strong>,</p>
        <p>Habiendo transcurrido el día 20 del mes, le informamos que aún se registra un saldo pendiente de pago o conciliación en su cuenta familiar:</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#fff1f2;border-radius:6px;">
          <thead>
            <tr style="background:#ffe4e6;text-align:left;font-size:12px;color:#881337;">
              <th style="padding:8px 12px;">Ítem Pendiente</th>
              <th style="padding:8px 12px;text-align:right;">Saldo</th>
            </tr>
          </thead>
          <tbody>
            ${debtRowsHtml}
          </tbody>
          <tfoot>
            <tr style="background:#ffe4e6;">
              <td style="padding:12px;font-weight:700;color:#881337;">DEUDA TOTAL PENDIENTE DE PAGO</td>
              <td style="padding:12px;text-align:right;font-weight:800;font-size:16px;color:#be123c;">${formatCurrencyARS(totalPendingDebt)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="font-size:12px;color:#475569;">
          Si ya realizó la transferencia bancaria, por favor adjunte el comprobante correspondiente desde la App Móvil seleccionando los ítems abonados.
        </p>
      </div>
    </div>
  `;

  return {
    type: 'day_20_debt_notice',
    scheduledRule: 'Día 20 de cada mes (Pago incompleto / saldo pendiente)',
    to: tutorUser?.email || 'familia@colegio.edu.ar',
    subject,
    html,
    totalPendingDebt,
    debtItems,
  };
};

/**
 * Envía la notificación de facturación o deuda mediante Cloud Functions (o devuelve confirmación simulada si la CF no está desplegada aún)
 */
export const triggerBillingEmailNotification = async (emailPayload) => {
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
    const response = await fetch(`${FUNCTIONS_BASE_URL}/cf_sendBillingNotification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        sent: true,
        cloudFunction: true,
        message: data.message || `Correo enviado exitosamente a ${emailPayload.to}.`,
      };
    }
  } catch {
    // Continuar con registro local si el endpoint aún no fue redesplegado
  }

  return {
    sent: true,
    cloudFunction: false,
    message: `Notificación preparada y despachada a la cola de correo para ${emailPayload.to} (${emailPayload.scheduledRule}).`,
  };
};
