import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
  TRANSPORT_ROUTES,
  INITIAL_DISCIPLINES,
} from '../utils/subscriptionRules';

const DEFAULT_SUBJECTS_BY_LEVEL = {
  inicial: [
    { id: 'sub-ini-1', nombre: 'Iniciación a las Ciencias y Exploración', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Prof. Carina Benítez', legajo: '#DOC-1018' } },
    { id: 'sub-ini-2', nombre: 'Expresión Artística, Música y Ritmo', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Prof. Sofía Navarro', legajo: '#DOC-1025' } },
    { id: 'sub-ini-3', nombre: 'Educación Física Infantil y Juegos', cargaHoraria: '3 hs/sem', profesor: { nombre: 'Prof. Diego Arzamendia', legajo: '#DOC-1077' } },
    { id: 'sub-ini-4', nombre: 'Taller de Inglés Inicial', cargaHoraria: '3 hs/sem', profesor: { nombre: 'Lic. Laura Paoli', legajo: '#DOC-1054' } },
  ],
  primario: [
    { id: 'sub-pri-1', nombre: 'Prácticas del Lenguaje y Literatura', cargaHoraria: '6 hs/sem', profesor: { nombre: 'Prof. Laura Gómez', legajo: '#DOC-1011' } },
    { id: 'sub-pri-2', nombre: 'Matemática y Geometría', cargaHoraria: '6 hs/sem', profesor: { nombre: 'Prof. Mariana Valenzuela', legajo: '#DOC-1092' } },
    { id: 'sub-pri-3', nombre: 'Ciencias Naturales y Laboratorio', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Dra. Marcela Quiroga', legajo: '#DOC-1021' } },
    { id: 'sub-pri-4', nombre: 'Ciencias Sociales y Formación Ética', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Prof. Roberto Gómez', legajo: '#DOC-1049' } },
    { id: 'sub-pri-5', nombre: 'Lengua Extranjera: Inglés / Portugués', cargaHoraria: '3 hs/sem', profesor: { nombre: 'Lic. Laura Paoli', legajo: '#DOC-1054' } },
    { id: 'sub-pri-6', nombre: 'Educación Física y Deportes', cargaHoraria: '3 hs/sem', profesor: { nombre: 'Prof. Diego Arzamendia', legajo: '#DOC-1077' } },
  ],
  secundario: [
    { id: 'sub-sec-1', nombre: 'Matemática Aplicada & Algoritmos', cargaHoraria: '5 hs/sem', profesor: { nombre: 'Prof. Mariana Valenzuela', legajo: '#DOC-1092' } },
    { id: 'sub-sec-2', nombre: 'Lengua y Literatura', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Lic. Laura Paoli', legajo: '#DOC-1054' } },
    { id: 'sub-sec-3', nombre: 'Física, Química y Laboratorio', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Dra. Marcela Quiroga', legajo: '#DOC-1021' } },
    { id: 'sub-sec-4', nombre: 'Tecnología, Informática & Lógica', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Ing. Carlos Méndez', legajo: '#DOC-1088' } },
    { id: 'sub-sec-5', nombre: 'Historia & Formación Ciudadana', cargaHoraria: '3 hs/sem', profesor: { nombre: 'Prof. Roberto Gómez', legajo: '#DOC-1049' } },
    { id: 'sub-sec-6', nombre: 'Idiomas (Inglés, Portugués, Francés)', cargaHoraria: '4 hs/sem', profesor: { nombre: 'Lic. Laura Paoli', legajo: '#DOC-1054' } },
  ],
};

const parseDaysList = (daysRaw) => {
  if (Array.isArray(daysRaw)) return daysRaw;
  if (typeof daysRaw === 'string') {
    return daysRaw.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
};

const parseTeacherInfo = (profesorRaw) => {
  if (typeof profesorRaw === 'object' && profesorRaw !== null) {
    return profesorRaw;
  }
  return { nombre: String(profesorRaw || 'Profesor a cargo') };
};

/**
 * Consulta y consolida los hijos vinculados a un usuario Padre/Tutor.
 */
const fetchParentLinkedStudents = async (uid, user) => {
  const studentsMap = new Map();
  let studentIds = Array.isArray(user?.studentIds) ? [...user.studentIds] : [];

  try {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      if (Array.isArray(uData.studentIds)) {
        studentIds = Array.from(new Set([...studentIds, ...uData.studentIds]));
      }
    }
  } catch (_err) {
    // Continuar si la lectura falla
  }

  if (studentIds.length > 0) {
    const snaps = await Promise.all(
      studentIds.map((sid) =>
        getDoc(doc(db, 'students', String(sid).trim())).catch(() => null)
      )
    );
    snaps.forEach((s) => {
      if (s && s.exists()) {
        studentsMap.set(s.id, { id: s.id, ...s.data() });
      }
    });
  }

  try {
    const qParent = query(collection(db, 'students'), where('parentId', '==', uid));
    const qSnap = await getDocs(qParent);
    qSnap.forEach((s) => {
      studentsMap.set(s.id, { id: s.id, ...s.data() });
    });
  } catch (_err) {
    // Continuar si la consulta por parentId no está habilitada
  }

  return Array.from(studentsMap.values());
};

export const resolveStudentSubjects = (student, subjectsCatalog = [], coursesCatalog = []) => {
  if (!student) return [];
  const rawCurso = String(student.curso || '').trim().toLowerCase();
  const rawDiv = String(student.division || 'A').trim().toLowerCase();

  if (Array.isArray(subjectsCatalog) && subjectsCatalog.length > 0 && rawCurso) {
    const matchedCourse = (coursesCatalog || []).find((c) => {
      const cName = String(c.nombre || '').trim().toLowerCase();
      const cDiv = String(c.division || 'A').trim().toLowerCase();
      return (cName === rawCurso || rawCurso.includes(cName)) && cDiv === rawDiv;
    });

    const filtered = subjectsCatalog.filter((sub) => {
      if (sub.dictadoActivo === false) return false;
      if (matchedCourse && sub.cursoId === matchedCourse.id) return true;
      const subCurso = String(sub.curso || '').trim().toLowerCase();
      if (!subCurso) return false;
      return subCurso.includes(rawCurso) || rawCurso.includes(subCurso);
    });

    if (filtered.length > 0) {
      return filtered;
    }
  }

  const rawNivel = String(student.nivel || student.curso || '').toLowerCase();
  if (rawNivel.includes('ini') || rawNivel.includes('sala')) return DEFAULT_SUBJECTS_BY_LEVEL.inicial;
  if (rawNivel.includes('sec') || rawNivel.includes('año')) return DEFAULT_SUBJECTS_BY_LEVEL.secundario;
  return DEFAULT_SUBJECTS_BY_LEVEL.primario;
};

export const useMobilePortalData = (user) => {
  const [loading, setLoading] = useState(true);
  const [linkedStudents, setLinkedStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [tariffsConfig, setTariffsConfig] = useState(null);
  const [allDisciplines, setAllDisciplines] = useState(INITIAL_DISCIPLINES);
  const [financeReceipts, setFinanceReceipts] = useState([]);
  const [subjectsCatalog, setSubjectsCatalog] = useState([]);
  const [coursesCatalog, setCoursesCatalog] = useState([]);

  const roleLower = String(user?.role || '').toLowerCase();
  const isStudentRole = roleLower.includes('estudiante') || roleLower.includes('alumno');
  const isParentRole = !isStudentRole;

  /**
   * Carga inicial y suscripción a los hijos vinculados del usuario
   */
  const fetchLinkedChildren = useCallback(async () => {
    await Promise.resolve();
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) {
      setLinkedStudents([]);
      setLoading(false);
      return [];
    }

    try {
      if (isStudentRole) {
        const stSnap = await getDoc(doc(db, 'students', uid));
        const list = stSnap.exists() ? [{ id: stSnap.id, ...stSnap.data() }] : [];
        setLinkedStudents(list);
        setSelectedStudentId(list[0]?.id || null);
        setLoading(false);
        return list;
      }

      const list = await fetchParentLinkedStudents(uid, user);
      setLinkedStudents(list);
      setSelectedStudentId((prev) => {
        if (prev && list.some((s) => String(s.id) === String(prev))) return prev;
        return list[0]?.id || null;
      });
      setLoading(false);
      return list;
    } catch (err) {
      console.warn('Error cargando alumnos vinculados:', err?.message);
      setLoading(false);
      return [];
    }
  }, [user, isStudentRole]);

  // Listener para sincronización en tiempo real de los estudiantes vinculados
  useEffect(() => {
    let active = true;
    let unsubStudents = [];

    const handleStudentSnapshot = (snap) => {
      if (snap.exists() && active) {
        const updated = { id: snap.id, ...snap.data() };
        setLinkedStudents((prev) =>
          prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
        );
      }
    };

    const syncChildren = async () => {
      try {
        const initialList = await fetchLinkedChildren();
        if (!active || !initialList || initialList.length === 0) return;
        unsubStudents = initialList.map((st) =>
          onSnapshot(doc(db, 'students', st.id), handleStudentSnapshot, () => undefined)
        );
      } catch (_err) {
        // ignore
      }
    };

    void syncChildren();

    return () => {
      active = false;
      unsubStudents.forEach((u) => typeof u === 'function' && u());
    };
  }, [fetchLinkedChildren]);

  // Suscripción en tiempo real a tariffs_config/current, sportsActivities, finance_receipts y academicOffer
  useEffect(() => {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) return undefined;

    // 1. Cuadro tarifario oficial
    const unsubTariffs = onSnapshot(
      doc(db, 'tariffs_config', 'current'),
      (snap) => {
        if (snap.exists()) {
          setTariffsConfig(snap.data());
        }
      },
      () => undefined
    );

    // 2. Catálogo de Deportes Extracurriculares
    const unsubSports = onSnapshot(
      collection(db, 'sportsActivities'),
      (snap) => {
        if (!snap.empty) {
          const list = [];
          snap.forEach((d) => {
            const data = d.data();
            const inscriptos = Array.isArray(data.inscriptos) ? data.inscriptos : [];
            list.push({
              id: d.id,
              nombre: data.nombre || data.name || 'Disciplina',
              emoji: data.emoji || '🏅',
              profesor: parseTeacherInfo(data.profesor || data.entrenador),
              niveles: data.niveles || data.nivel || 'Todos los niveles',
              dias: parseDaysList(data.dias),
              horario: data.horario || data.schedule || '16:00 - 17:30 hs',
              lugar: data.lugar || data.instalacion || 'Campo de Deportes',
              cupoMax: Number(data.cupoMax || data.cupo) || 25,
              cupoOcupado: inscriptos.length || Number(data.cupoOcupado || data.anotados) || 0,
              precioMensual: Number(data.precioMensual || data.price || data.precio) || 0,
              activo: Boolean(data.activo !== false),
              inscriptos,
            });
          });
          setAllDisciplines(list);
        }
      },
      () => undefined
    );

    // 3. Facturas y Comprobantes en finance_receipts
    const unsubReceipts = onSnapshot(
      collection(db, 'finance_receipts'),
      (snap) => {
        const list = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        setFinanceReceipts(list);
      },
      () => undefined
    );

    // 4. Oferta académica (Cursos y Profesores por materia)
    const unsubAcademic = onSnapshot(
      collection(db, 'academicOffer'),
      (snap) => {
        const courses = [];
        snap.forEach((d) => {
          if (d.id === 'subjects_catalog') {
            const data = d.data();
            if (Array.isArray(data?.items)) {
              setSubjectsCatalog(data.items);
            }
          } else if (d.id !== 'current') {
            courses.push({ id: d.id, ...d.data() });
          }
        });
        setCoursesCatalog(courses);
      },
      () => undefined
    );

    return () => {
      unsubTariffs();
      unsubSports();
      unsubReceipts();
      unsubAcademic();
    };
  }, [user]);

  // Alumno actualmente seleccionado
  const currentStudent = useMemo(() => {
    if (selectedStudentId === 'all') return null;
    return (
      linkedStudents.find((s) => String(s.id) === String(selectedStudentId)) ||
      linkedStudents[0] ||
      null
    );
  }, [linkedStudents, selectedStudentId]);

  // Materias resueltas del alumno actual
  const currentStudentSubjects = useMemo(() => {
    return resolveStudentSubjects(currentStudent, subjectsCatalog, coursesCatalog);
  }, [currentStudent, subjectsCatalog, coursesCatalog]);

  // Actualizador manual de estudiante en el estado local
  const updateStudentInState = useCallback((updatedStudent) => {
    if (!updatedStudent?.id) return;
    setLinkedStudents((prev) =>
      prev.map((s) => (String(s.id) === String(updatedStudent.id) ? { ...s, ...updatedStudent } : s))
    );
  }, []);

  return {
    loading,
    isStudentRole,
    isParentRole,
    linkedStudents,
    selectedStudentId,
    setSelectedStudentId,
    currentStudent,
    currentStudentSubjects,
    tariffsConfig,
    allDisciplines,
    routes: TRANSPORT_ROUTES,
    financeReceipts,
    updateStudentInState,
    refreshData: fetchLinkedChildren,
  };
};
