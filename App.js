import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from './src/theme/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { useMobilePortalData } from './src/hooks/useMobilePortalData';
import LoginScreen from './src/screens/LoginScreen';
import BillingScreen from './src/screens/BillingScreen';
import ServicesScreen from './src/screens/ServicesScreen';
import AcademicProfileScreen from './src/screens/AcademicProfileScreen';
import ChangePasswordModal from './src/components/ChangePasswordModal';
import HeaderBurgerMenuModal from './src/components/HeaderBurgerMenuModal';
import ProfileModal from './src/components/ProfileModal';
import NotificationsModal from './src/components/NotificationsModal';

const resolveActiveStudentLabel = (
  isParentRole,
  linkedStudents,
  selectedStudentId,
  effectiveTab,
  currentStudent
) => {
  if (!isParentRole || !Array.isArray(linkedStudents) || linkedStudents.length === 0) {
    return null;
  }
  if (selectedStudentId === 'all' && effectiveTab === 'billing') {
    return 'Grupo Familiar';
  }
  return (
    currentStudent?.nombreCompleto ||
    `${currentStudent?.nombre || ''} ${currentStudent?.apellido || ''}`.trim() ||
    null
  );
};

const MobilePortalShell = () => {
  const {
    user,
    loading: authLoading,
    isLoggedIn,
    logout,
    changePassword,
    updateTutorProfile,
  } = useAuth();
  const {
    loading: portalLoading,
    isStudentRole,
    isParentRole,
    linkedStudents,
    selectedStudentId,
    setSelectedStudentId,
    currentStudent,
    currentStudentSubjects,
    tariffsConfig,
    allDisciplines,
    routes,
    financeReceipts,
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    updateStudentInState,
  } = useMobilePortalData(user);

  const [activeBottomTab, setActiveBottomTab] = useState('billing'); // 'billing' | 'services' | 'academic'
  const [burgerMenuVisible, setBurgerMenuVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [manualPasswordModal, setManualPasswordModal] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState(null);

  if (authLoading) {
    return (
      <View style={styles.centeredScreen}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Validando sesión</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen />;
  }

  // Si el usuario logueado es Estudiante, su vista principal es su Ficha Académica y Servicios
  const effectiveTab = isStudentRole && activeBottomTab === 'billing' ? 'academic' : activeBottomTab;

  const renderMainContent = () => {
    if (portalLoading) {
      return (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      );
    }

    if (linkedStudents.length === 0) {
      return (
        <View style={styles.centeredContent}>
          <Ionicons name="people-circle-outline" size={52} color={COLORS.textMuted} />
          <Text style={styles.noStudentsTitle}>
            No se encontraron alumnos vinculados a su cuenta
          </Text>
          <Text style={styles.noStudentsSub}>
            Por normativa de privacidad institucional, cada padre/tutor solo puede consultar y gestionar la información de sus hijos registrados en Firestore (`studentIds` / `parentId`).
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.mainBody}>
        {effectiveTab === 'billing' && isParentRole && (
          <BillingScreen
            user={user}
            linkedStudents={linkedStudents}
            selectedStudentId={selectedStudentId}
            tariffsConfig={tariffsConfig}
            allDisciplines={allDisciplines}
            financeReceipts={financeReceipts}
            onStudentUpdated={updateStudentInState}
            onFeedback={setFeedbackBanner}
          />
        )}

        {effectiveTab === 'services' && (
          <ServicesScreen
            student={currentStudent}
            allStudents={linkedStudents}
            allDisciplines={allDisciplines}
            routes={routes}
            tariffsConfig={tariffsConfig}
            isStudentRole={isStudentRole}
            onStudentUpdated={updateStudentInState}
            onFeedback={setFeedbackBanner}
          />
        )}

        {effectiveTab === 'academic' && (
          <AcademicProfileScreen
            user={user}
            student={currentStudent}
            subjects={currentStudentSubjects}
            allDisciplines={allDisciplines}
            routes={routes}
            isStudentRole={isStudentRole}
            onStudentUpdated={updateStudentInState}
            onFeedback={setFeedbackBanner}
          />
        )}
      </View>
    );
  };

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
      {isParentRole && (
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveBottomTab('billing')}
        >
          <Ionicons
            name={effectiveTab === 'billing' ? 'wallet' : 'wallet-outline'}
            size={21}
            color={effectiveTab === 'billing' ? COLORS.accent : COLORS.textMuted}
          />
          <Text
            style={[
              styles.navLabel,
              effectiveTab === 'billing' && styles.navLabelActive,
            ]}
          >
            Cuotas y Pagos
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setActiveBottomTab('services')}
      >
        <Ionicons
          name={effectiveTab === 'services' ? 'grid' : 'grid-outline'}
          size={21}
          color={effectiveTab === 'services' ? COLORS.accent : COLORS.textMuted}
        />
        <Text
          style={[
            styles.navLabel,
            effectiveTab === 'services' && styles.navLabelActive,
          ]}
        >
          Servicios y Deportes
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.navItem}
        onPress={() => setActiveBottomTab('academic')}
      >
        <Ionicons
          name={effectiveTab === 'academic' ? 'school' : 'school-outline'}
          size={21}
          color={effectiveTab === 'academic' ? COLORS.accent : COLORS.textMuted}
        />
        <Text
          style={[
            styles.navLabel,
            effectiveTab === 'academic' && styles.navLabelActive,
          ]}
        >
          Legajo y Materias
        </Text>
      </TouchableOpacity>
    </View>
  );

  const activeStudentLabel = resolveActiveStudentLabel(
    isParentRole,
    linkedStudents,
    selectedStudentId,
    effectiveTab,
    currentStudent
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={COLORS.primary} />

      {/* Top Header Institucional */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <TouchableOpacity
            style={styles.burgerBtn}
            onPress={() => setBurgerMenuVisible(true)}
            accessibilityLabel="Abrir menú lateral"
          >
            <Ionicons name="menu" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={0.8}
            onPress={() => setBurgerMenuVisible(true)}
          >
            <Text style={styles.brandTitle} numberOfLines={1}>
              {user?.role === 'Padre' ? 'Portal de Padres' : 'Portal de Alumno'}
            </Text>
            <Text style={styles.userSub} numberOfLines={1}>
              {user?.nombre || user?.email}
              {activeStudentLabel ? ` · ${activeStudentLabel}` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setNotificationsModalVisible(true)}
            accessibilityLabel="Notificaciones"
          >
            <Ionicons
              name={unreadNotificationsCount > 0 ? 'notifications' : 'notifications-outline'}
              size={19}
              color={unreadNotificationsCount > 0 ? '#FDBA74' : COLORS.white}
            />
            {unreadNotificationsCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Notificación global de operaciones */}
      {feedbackBanner && (
        <View
          style={[
            styles.feedbackBar,
            feedbackBanner.type === 'error'
              ? styles.feedbackBarError
              : styles.feedbackBarSuccess,
          ]}
        >
          <Ionicons
            name={feedbackBanner.type === 'error' ? 'alert-circle' : 'checkmark-circle'}
            size={17}
            color={feedbackBanner.type === 'error' ? COLORS.rose : COLORS.emerald}
          />
          <Text
            style={[
              styles.feedbackText,
              {
                color: feedbackBanner.type === 'error' ? COLORS.rose : '#065F46',
              },
            ]}
          >
            {feedbackBanner.message}
          </Text>
          <TouchableOpacity onPress={() => setFeedbackBanner(null)}>
            <Ionicons name="close" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Contenido Principal */}
      {renderMainContent()}

      {/* Barra de Navegación Inferior según Rol */}
      {renderBottomNav()}

      {/* Menú Lateral Desplegable desde la Izquierda (Selector de Alumno, Mi Perfil, Cambiar Contraseña y Cerrar Sesión) */}
      <HeaderBurgerMenuModal
        visible={burgerMenuVisible}
        user={user}
        isStudentRole={isStudentRole}
        students={linkedStudents}
        selectedStudentId={selectedStudentId}
        onSelectStudent={setSelectedStudentId}
        showAllOption={effectiveTab === 'billing'}
        onClose={() => setBurgerMenuVisible(false)}
        onOpenProfile={() => setProfileModalVisible(true)}
        onOpenChangePassword={() => setManualPasswordModal(true)}
        onLogout={logout}
      />

      {/* Modal de Mi Perfil */}
      <ProfileModal
        visible={profileModalVisible}
        user={user}
        student={currentStudent}
        isStudentRole={isStudentRole}
        onClose={() => setProfileModalVisible(false)}
        onSaveTutorProfile={updateTutorProfile}
      />

      {/* Centro de Notificaciones */}
      <NotificationsModal
        visible={notificationsModalVisible}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onClose={() => setNotificationsModalVisible(false)}
        onMarkAllAsRead={markAllNotificationsAsRead}
        onSelectNotification={(item) => {
          void markNotificationAsRead(item);
          setNotificationsModalVisible(false);
          if (item?.studentId && isParentRole) {
            setSelectedStudentId(item.studentId);
          }
          if (item?.targetTab) {
            setActiveBottomTab(item.targetTab);
          }
        }}
      />

      {/* Modal de Cambio de Contraseña (Obligatorio si mustChangePassword === true o voluntario) */}
      <ChangePasswordModal
        visible={Boolean(user?.mustChangePassword) || manualPasswordModal}
        isMandatory={Boolean(user?.mustChangePassword)}
        onClose={() => setManualPasswordModal(false)}
        onSubmitPasswordChange={changePassword}
      />
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MobilePortalShell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  centeredScreen: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: COLORS.white,
    fontWeight: '600',
  },
  topHeader: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  brandRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  burgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
  },
  userSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  notifBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.white,
  },
  feedbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  feedbackBarSuccess: {
    backgroundColor: COLORS.emeraldSoft,
    borderBottomColor: COLORS.emeraldBorder,
  },
  feedbackBarError: {
    backgroundColor: COLORS.roseSoft,
    borderBottomColor: COLORS.roseBorder,
  },
  feedbackText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  centeredContent: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  noStudentsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
  },
  noStudentsSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    maxWidth: 360,
    lineHeight: 18,
  },
  mainBody: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  navLabelActive: {
    color: COLORS.accent,
    fontWeight: '800',
  },
});
