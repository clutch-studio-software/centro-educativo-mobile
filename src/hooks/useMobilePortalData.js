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
   * Carga inicial y suscripción en tiempo real a los hijos vinculados del tutor
   */
  const fetchLinkedChildren = useCallback(async () => {
    const uid = auth.currentUser?.uid || user?.uid;
    if (!uid) {
      setLinkedStudents([]);
      setLoading(false);
      return [];
    }

    const studentsMap = new Map();

    try {
      if (isStudentRole) {
        const stSnap = await getDoc(doc(db, 'students', uid));
        if (stSnap.exists()) {
          studentsMap.set(stSnap.id, { id: stSnap.id, ...stSnap.data() });
        }
      } else {
        // 1. Obtener studentIds desde users/{uid}
        let studentIdsFromProfile = Array.isArray(user?.studentIds) ? [...user.studentIds] : [];
        try {
          const userSnap = await getDoc(doc(db, 'users', uid));
          if (userSnap.exists()) {
            const uData = userSnap.data();
            if (Array.isArray(uData.studentIds)) {
              studentIdsFromProfile = Array.from(
                new Set([...studentIdsFromProfile, ...uData.studentIds])
              );
            }
          }
        } catch {
          // Continuar
        }

        // 2. Leer cada documento students/{studentId}
        if (studentIdsFromProfile.length > 0) {
          const snaps = await Promise.all(
            studentIdsFromProfile.map((sid) =>
              getDoc(doc(db, 'students', String(sid).trim())).catch(() => null)
            )
          );
          snaps.forEach((s) => {
            if (s && s.exists()) {
              studentsMap.set(s.id, { id: s.id, ...s.data() });
            }
          });
        }

        // 3. Consultar también por where('parentId', '==', uid)
        try {
          const qParent = query(collection(db, 'students'), where('parentId', '==', uid));
          const qSnap = await getDocs(qParent);
          qSnap.forEach((s) => {
            studentsMap.set(s.id, { id: s.id, ...s.data() });
          });
        } catch {
          // Continuar si la regla requiere lectura individual
        }
      }
    } catch (err) {
      console.warn('Error cargando alumnos vinculados:', err?.message);
    }

    const list = Array.from(studentsMap.values());
    setLinkedStudents(list);
    setSelectedStudentId((prev) => {
      if (prev && list.some((s) => String(s.id) === String(prev))) return prev;
      return list[0]?.id || null;
    });
    setLoading(false);
    return list;
  }, [user, isStudentRole]);

  // Suscripción en tiempo real a cada hijo vinculado
  useEffect(() => {
    let active = true;
    let unsubStudents = [];

    const setupStudentListeners = async () => {
      setLoading(true);
      const initialList = await fetchLinkedChildren();
      if (!active || initialList.length === 0) return;

      unsubStudents = initialList.map((st) =>
        onSnapshot(
          doc(db, 'students', st.id),
          (snap) => {
            if (snap.exists() && active) {
              const updated = { id: snap.id, ...snap.data() };
              setLinkedStudents((prev) =>
                prev.map((item) => (String(item.id) === String(updated.id) ? updated : item))
              );
            }
          },
          () => {}
        )
      );
    };

    void setupStudentListeners();

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
      () => {}
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
              profesor:
                typeof data.profesor === 'object' && data.profesor !== null
                  ? data.profesor
                  : { nombre: String(data.profesor || data.entrenador || 'Profesor a cargo') },
              niveles: data.niveles || data.nivel || 'Todos los niveles',
              dias: Array.isArray(data.dias)
                ? data.dias
                : typeof data.dias === 'string'
                  ? data.dias.split(',').map((s) => s.trim()).filter(Boolean)
                  : [],
              horario: data.horario || data.schedule || '16:00 - 17:30 hs',
              lugar: data.lugar || data.instalacion || 'Campo de Deportes',
              cupoMax: Number(data.cupoMax || data.cupo) || 25,
              cupoOcupado: inscriptos.length || Number(data.cupoOcupado || data.anotados) || 0,
              precioMensual: Number(data.precioMensual || data.price || data.precio) || 0,
              activo: data.activo !== false,
              inscriptos,
            });
          });
          setAllDisciplines(list);
        }
      },
      () => {}
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
      () => {}
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
      () => {}
    );

    return () => {
      unsubTariffs();
      unsubSports();
      unsubReceipts();
      unsubAcademic();
    };
  }, [user?.uid]);

  const currentStudent = useMemo(() => {
    if (!linkedStudents.length) return null;
    return (
      linkedStudents.find((s) => String(s.id) === String(selectedStudentId)) ||
      linkedStudents[0]
    );
  }, [linkedStudents, selectedStudentId]);

  const currentStudentSubjects = useMemo(() => {
    return resolveStudentSubjects(currentStudent, subjectsCatalog, coursesCatalog);
  }, [currentStudent, subjectsCatalog, coursesCatalog]);

  const updateStudentInState = useCallback((updatedStudent) => {
    if (!updatedStudent?.id) return;
    setLinkedStudents((prev) =>
      prev.map((st) => (String(st.id) === String(updatedStudent.id) ? { ...st, ...updatedStudent } : st))
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
    refreshPortalData: fetchLinkedChildren,
    updateStudentInState,
  };
};
