import { formatCurrencyARS } from '../theme/colors';

export const SPRINTER_STANDARD_CAPACITY = 15;

export const TRANSPORT_ROUTES = [
  {
    id: 'Recorrido 1',
    code: 'r1',
    nombre: 'Recorrido 1 - Zona Norte',
    zona: 'Av. Sarmiento, Av. Sabin y Parque Autódromo',
    horarioIda: '07:00 hs',
    horarioRegreso: '16:30 hs',
    capacidadMaxima: SPRINTER_STANDARD_CAPACITY,
    vehiculo: 'Mercedes-Benz Sprinter (15 plazas)',
    defaultAmount: 38000,
  },
  {
    id: 'Recorrido 2',
    code: 'r2',
    nombre: 'Recorrido 2 - Zona Sur',
    zona: 'Av. Castelli, Av. Alberdi y Campus UNNE',
    horarioIda: '07:05 hs',
    horarioRegreso: '16:30 hs',
    capacidadMaxima: SPRINTER_STANDARD_CAPACITY,
    vehiculo: 'Mercedes-Benz Sprinter (15 plazas)',
    defaultAmount: 40000,
  },
  {
    id: 'Recorrido 3',
    code: 'r3',
    nombre: 'Recorrido 3 - Zona Este / Centro',
    zona: 'Plaza 25 de Mayo, Av. 9 de Julio y Barranqueras',
    horarioIda: '06:55 hs',
    horarioRegreso: '16:35 hs',
    capacidadMaxima: SPRINTER_STANDARD_CAPACITY,
    vehiculo: 'Mercedes-Benz Sprinter (15 plazas)',
    defaultAmount: 36000,
  },
  {
    id: 'Recorrido 4',
    code: 'r4',
    nombre: 'Recorrido 4 - Zona Oeste / Fontana',
    zona: 'Av. Alvear, Av. 25 de Mayo y Fontana',
    horarioIda: '07:10 hs',
    horarioRegreso: '16:25 hs',
    capacidadMaxima: SPRINTER_STANDARD_CAPACITY,
    vehiculo: 'Mercedes-Benz Sprinter (15 plazas)',
    defaultAmount: 42000,
  },
];

export const INITIAL_DISCIPLINES = [
  {
    id: 'disc-1',
    nombre: 'Atletismo',
    emoji: '🏃',
    profesor: { nombre: 'Prof. Diego Arzamendia', email: 'diego.arzamendia@colegio.edu.ar' },
    niveles: 'Primario y Secundario',
    dias: ['Martes', 'Jueves'],
    horario: 'Martes y Jueves 16:30 - 18:00',
    lugar: 'Pista de Atletismo / Campo de Deportes',
    cupoMax: 25,
    cupoOcupado: 0,
    defaultPrice: 15000,
    inscriptos: [],
  },
  {
    id: 'disc-2',
    nombre: 'Natación',
    emoji: '🏊',
    profesor: { nombre: 'Prof. Camila Rivas', email: 'camila.rivas@colegio.edu.ar' },
    niveles: 'Todos los niveles',
    dias: ['Lunes', 'Miércoles', 'Viernes'],
    horario: 'Lunes, Miércoles y Viernes 15:00 - 17:00',
    lugar: 'Pileta de Natación Climatizada',
    cupoMax: 30,
    cupoOcupado: 0,
    defaultPrice: 22000,
    inscriptos: [],
  },
  {
    id: 'disc-3',
    nombre: 'Fútbol',
    emoji: '⚽',
    profesor: { nombre: 'Prof. Esteban Morales', email: 'esteban.morales@colegio.edu.ar' },
    niveles: 'Primario y Secundario',
    dias: ['Lunes', 'Miércoles'],
    horario: 'Lunes y Miércoles 17:00 - 18:30',
    lugar: 'Canchas de Fútbol Sintético',
    cupoMax: 35,
    cupoOcupado: 0,
    defaultPrice: 16500,
    inscriptos: [],
  },
  {
    id: 'disc-4',
    nombre: 'Artes Marciales / Taekwondo',
    emoji: '🥋',
    profesor: { nombre: 'Sensei Kenji Sato', email: 'kenji.sato@colegio.edu.ar' },
    niveles: 'Primario y Secundario',
    dias: ['Martes', 'Jueves'],
    horario: 'Martes y Jueves 17:00 - 18:30',
    lugar: 'Gimnasio Cubierto (Dojo)',
    cupoMax: 20,
    cupoOcupado: 0,
    defaultPrice: 17500,
    inscriptos: [],
  },
  {
    id: 'disc-5',
    nombre: 'Vóleibol',
    emoji: '🏐',
    profesor: { nombre: 'Prof. Mariana Valenzuela', email: 'mariana.valenzuela@colegio.edu.ar' },
    niveles: 'Secundario',
    dias: ['Miércoles', 'Viernes'],
    horario: 'Miércoles y Viernes 16:00 - 17:30',
    lugar: 'Gimnasio Cubierto - Cancha 1',
    cupoMax: 24,
    cupoOcupado: 0,
    defaultPrice: 15500,
    inscriptos: [],
  },
  {
    id: 'disc-6',
    nombre: 'Danza & Expresión',
    emoji: '🩰',
    profesor: { nombre: 'Prof. Florencia Peña', email: 'florencia.pena@colegio.edu.ar' },
    niveles: 'Inicial y Primario',
    dias: ['Lunes', 'Miércoles'],
    horario: 'Lunes y Miércoles 16:00 - 17:15',
    lugar: 'Salón de Danza y Expresión',
    cupoMax: 20,
    cupoOcupado: 0,
    defaultPrice: 16000,
    inscriptos: [],
  },
  {
    id: 'disc-7',
    nombre: 'Básquet',
    emoji: '🏀',
    profesor: { nombre: 'Prof. Javier Rossi', email: 'javier.rossi@colegio.edu.ar' },
    niveles: 'Primario y Secundario',
    dias: ['Martes', 'Jueves'],
    horario: 'Martes y Jueves 16:00 - 17:30',
    lugar: 'Gimnasio Cubierto - Cancha Central',
    cupoMax: 25,
    cupoOcupado: 0,
    defaultPrice: 16500,
    inscriptos: [],
  },
  {
    id: 'disc-8',
    nombre: 'Ajedrez & Estrategia',
    emoji: '♟️',
    profesor: { nombre: 'Prof. Marcelo Benítez', email: 'marcelo.benitez@colegio.edu.ar' },
    niveles: 'Todos los niveles',
    dias: ['Sábados'],
    horario: 'Sábados 10:00 - 12:00',
    lugar: 'Biblioteca / Sala de Estrategia',
    cupoMax: 15,
    cupoOcupado: 0,
    defaultPrice: 13500,
    inscriptos: [],
  },
];

export const getTodayDateString = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDisplay = (dateValue) => {
  if (!dateValue) return 'Sin fecha';
  try {
    const clean = String(dateValue).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const [year, month, day] = clean.slice(0, 10).split('-');
      return `${day}/${month}/${year}`;
    }
    const d = new Date(dateValue);
    if (Number.isNaN(d.getTime())) return clean;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateValue);
  }
};

export const getNextMonthFirstDay = (referenceDate = new Date()) => {
  const d = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const nextMonthYear = d.getMonth() === 11 ? d.getFullYear() + 1 : d.getFullYear();
  const nextMonth = (d.getMonth() + 1) % 12;
  const firstDay = new Date(nextMonthYear, nextMonth, 1);
  const iso = getTodayDateString(firstDay);
  return {
    iso,
    display: formatDateDisplay(iso),
    monthName: firstDay.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }),
  };
};

/**
 * Regla de Negocio Crítica:
 * El tutor solo puede dar de baja inmediata un servicio si la baja se ejecuta
 * antes de que finalice el mismo día de inscripción (fechaInicio === hoy).
 */
export const canCancelServiceToday = (startDateStr, today = new Date()) => {
  if (!startDateStr) return false;
  const todayStr = getTodayDateString(today);
  return String(startDateStr).trim().slice(0, 10) === todayStr;
};

/**
 * Calcula el importe proporcional del primer mes según la fecha de inicio de suscripción
 * (diasActivos / diasDelMes)
 */
export const calculateMonthlyProportional = ({
  startDate,
  monthlyRate = 0,
  referenceDate = new Date(),
}) => {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const year = ref.getFullYear();
  const month = ref.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  if (!startDate) {
    return {
      daysInMonth,
      startDay: 1,
      activeDays: daysInMonth,
      dailyRate: Math.round(monthlyRate / daysInMonth),
      proportionalAmount: Math.round(monthlyRate),
      fullMonthlyAmount: Math.round(monthlyRate),
      isProportional: false,
      percentage: 100,
      formattedProportional: formatCurrencyARS(monthlyRate),
      formattedMonthlyRate: formatCurrencyARS(monthlyRate),
    };
  }

  const cleanStr = String(startDate).trim().slice(0, 10);
  const parts = cleanStr.split('-').map((n) => Number.parseInt(n, 10));
  const startYear = parts[0] || year;
  const startMonth = (parts[1] || month + 1) - 1;
  const startDay = parts[2] || 1;

  // Si se inscribió en un mes anterior al mes de referencia, cobra mes completo
  if (startYear < year || (startYear === year && startMonth < month)) {
    return {
      daysInMonth,
      startDay: 1,
      activeDays: daysInMonth,
      dailyRate: Math.round(monthlyRate / daysInMonth),
      proportionalAmount: Math.round(monthlyRate),
      fullMonthlyAmount: Math.round(monthlyRate),
      isProportional: false,
      percentage: 100,
      formattedProportional: formatCurrencyARS(monthlyRate),
      formattedMonthlyRate: formatCurrencyARS(monthlyRate),
    };
  }

  const activeDays = Math.max(1, Math.min(daysInMonth, daysInMonth - startDay + 1));
  const dailyRate = monthlyRate / daysInMonth;
  const proportionalAmount = Math.round(dailyRate * activeDays);
  const percentage = Math.round((activeDays / daysInMonth) * 100);

  return {
    daysInMonth,
    startDay,
    activeDays,
    dailyRate: Math.round(dailyRate),
    proportionalAmount,
    fullMonthlyAmount: Math.round(monthlyRate),
    isProportional: activeDays < daysInMonth,
    percentage,
    formattedProportional: formatCurrencyARS(proportionalAmount),
    formattedMonthlyRate: formatCurrencyARS(monthlyRate),
  };
};

export const matchTransportRoute = (routeKey, routes = TRANSPORT_ROUTES) => {
  if (!routeKey) return null;
  const clean = String(routeKey).trim().toLowerCase();
  return (
    (routes || TRANSPORT_ROUTES).find(
      (r) =>
        String(r.id).toLowerCase() === clean ||
        String(r.code || '').toLowerCase() === clean ||
        String(r.nombre || '').toLowerCase() === clean ||
        (clean === 'r1' && String(r.id).toLowerCase().includes('1')) ||
        (clean === 'r2' && String(r.id).toLowerCase().includes('2')) ||
        (clean === 'r3' && String(r.id).toLowerCase().includes('3')) ||
        (clean === 'r4' && String(r.id).toLowerCase().includes('4'))
    ) || null
  );
};

export const getTransportRouteOccupancy = (
  routeKey,
  students = [],
  routes = TRANSPORT_ROUTES,
  maxCapacity = SPRINTER_STANDARD_CAPACITY
) => {
  const matchedRoute = matchTransportRoute(routeKey, routes);
  const effectiveCapacity = matchedRoute?.capacidadMaxima || maxCapacity;

  const enrolledList = (students || []).filter((st) => {
    const servicios = Array.isArray(st.servicios) ? st.servicios : [];
    const hasTransport =
      Boolean(st.recorridoTransporte) ||
      servicios.some((s) => String(s).toLowerCase().includes('transporte'));
    if (!hasTransport) return false;
    const stRouteMatched = matchTransportRoute(st.recorridoTransporte, routes);
    if (matchedRoute && stRouteMatched) {
      return stRouteMatched.id === matchedRoute.id;
    }
    return String(st.recorridoTransporte || '').trim().toLowerCase() === String(routeKey || '').trim().toLowerCase();
  });

  const count = enrolledList.length;
  return {
    ocupados: count,
    capacidad: effectiveCapacity,
    disponibles: Math.max(0, effectiveCapacity - count),
    estaLleno: count >= effectiveCapacity,
    porcentaje: Math.min(100, Math.round((count / effectiveCapacity) * 100)),
  };
};

export const getDayOrderIndex = (day) => {
  const normalized = String(day || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized.startsWith('lun')) return 1;
  if (normalized.startsWith('mar')) return 2;
  if (normalized.startsWith('mie')) return 3;
  if (normalized.startsWith('jue')) return 4;
  if (normalized.startsWith('vie')) return 5;
  if (normalized.startsWith('sab')) return 6;
  if (normalized.startsWith('dom')) return 7;
  return 99;
};

const parseMinutesFromTimeStr = (timeStr = '') => {
  const parts = String(timeStr).trim().split(':');
  if (parts.length < 2) return null;
  const h = Number.parseInt(parts[0], 10);
  const m = Number.parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
};

export const parseHorariosFromDiscipline = (discipline) => {
  if (discipline?.horariosPorDia && typeof discipline.horariosPorDia === 'object') {
    return { ...discipline.horariosPorDia };
  }
  let defaultInicio = '16:00';
  let defaultFin = '17:30';
  if (discipline?.horario) {
    const match = String(discipline.horario).match(/(\d{1,2}:\d{2})\s*(?:-|a|–|al)\s*(\d{1,2}:\d{2})/);
    if (match) {
      defaultInicio = match[1].padStart(5, '0');
      defaultFin = match[2].padStart(5, '0');
    }
  }
  const dias = Array.isArray(discipline?.dias)
    ? discipline.dias
    : typeof discipline?.dias === 'string'
      ? discipline.dias.split(',').map((d) => d.trim()).filter(Boolean)
      : [];
  const result = {};
  dias.forEach((dia) => {
    result[dia] = { inicio: defaultInicio, fin: defaultFin };
  });
  return result;
};

export const checkScheduleConflict = (enrolledDisciplines = [], targetDiscipline) => {
  if (!targetDiscipline || !Array.isArray(enrolledDisciplines) || enrolledDisciplines.length === 0) {
    return null;
  }

  const targetSchedule = parseHorariosFromDiscipline(targetDiscipline);
  const targetDays = Array.isArray(targetDiscipline.dias)
    ? targetDiscipline.dias
    : Object.keys(targetSchedule);

  for (const current of enrolledDisciplines) {
    if (!current || (targetDiscipline.id && current.id === targetDiscipline.id)) continue;

    const currentSchedule = parseHorariosFromDiscipline(current);
    const currentDays = Array.isArray(current.dias)
      ? current.dias
      : Object.keys(currentSchedule);

    for (const tDay of targetDays) {
      const matchingDay = currentDays.find(
        (cDay) => getDayOrderIndex(cDay) !== 99 && getDayOrderIndex(cDay) === getDayOrderIndex(tDay)
      );
      if (!matchingDay) continue;

      const tSlot = targetSchedule[tDay] || { inicio: '16:00', fin: '17:30' };
      const cSlot = currentSchedule[matchingDay] || { inicio: '16:00', fin: '17:30' };

      const tStart = parseMinutesFromTimeStr(tSlot.inicio) ?? 960;
      const tEnd = parseMinutesFromTimeStr(tSlot.fin) ?? 1050;
      const cStart = parseMinutesFromTimeStr(cSlot.inicio) ?? 960;
      const cEnd = parseMinutesFromTimeStr(cSlot.fin) ?? 1050;

      if (tStart < cEnd && cStart < tEnd) {
        return {
          disciplineName: current.nombre || 'otra actividad',
          day: tDay,
          overlapLabel: `${tDay} (${tSlot.inicio} - ${tSlot.fin}) se superpone con "${
            current.nombre || 'otra actividad'
          }" (${cSlot.inicio} - ${cSlot.fin})`,
        };
      }
    }
  }

  return null;
};

/**
 * Calcula el último día hábil (Lunes a Viernes) de un mes dado
 */
export const getLastBusinessDayOfMonth = (year, monthIndex) => {
  const lastDate = new Date(year, monthIndex + 1, 0);
  const dayOfWeek = lastDate.getDay(); // 0 = Dom, 6 = Sáb
  if (dayOfWeek === 0) {
    lastDate.setDate(lastDate.getDate() - 2);
  } else if (dayOfWeek === 6) {
    lastDate.setDate(lastDate.getDate() - 1);
  }
  return lastDate;
};
