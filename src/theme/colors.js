export const COLORS = {
  primary: '#0F172A',       // Azul Marino Institucional
  primaryLight: '#1E293B',
  accent: '#EA580C',        // Naranja Institucional "Educar para Transformar"
  accentSoft: '#FFF7ED',
  accentBorder: '#FED7AA',
  emerald: '#059669',       // Verde Finanzas / Conciliación
  emeraldSoft: '#ECFDF5',
  emeraldBorder: '#A7F3D0',
  indigo: '#4F46E5',        // Índigo Académico / Deportes
  indigoSoft: '#EEF2FF',
  indigoBorder: '#C7D2FE',
  amber: '#D97706',         // Ámbar Pendiente / Revisión
  amberSoft: '#FFFBEB',
  amberBorder: '#FDE68A',
  rose: '#E11D48',          // Rojo Rechazado / Deuda / Alerta
  roseSoft: '#FFF1F2',
  roseBorder: '#FECDD3',
  cyan: '#0891B2',
  cyanSoft: '#ECFEFF',
  cyanBorder: '#A5F3FC',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  white: '#FFFFFF',
};

export const formatCurrencyARS = (amount) => {
  const num = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(num);
  } catch {
    return `$ ${Math.round(num).toLocaleString('es-AR')}`;
  }
};
