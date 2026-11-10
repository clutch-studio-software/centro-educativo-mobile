import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const ReadOnlyField = ({ label, value, icon }) => (
  <View style={styles.fieldGroup}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.lockedTag}>
        <Ionicons name="lock-closed" size={10} color={COLORS.textMuted} />
        <Text style={styles.lockedTagText}>Solo lectura</Text>
      </View>
    </View>
    <View style={styles.readOnlyBox}>
      <Ionicons name={icon} size={16} color={COLORS.textMuted} />
      <Text style={styles.readOnlyText}>{value || 'No especificado'}</Text>
    </View>
  </View>
);

const EditableContactField = ({
  label,
  value,
  onChangeText,
  editable,
  icon,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
}) => (
  <View style={styles.fieldGroup}>
    <View style={styles.labelRow}>
      <Text style={styles.label}>{label}</Text>
      {editable ? (
        <Text style={styles.editableTag}>Editable</Text>
      ) : (
        <View style={styles.lockedTag}>
          <Ionicons name="lock-closed" size={10} color={COLORS.textMuted} />
          <Text style={styles.lockedTagText}>Solo lectura</Text>
        </View>
      )}
    </View>
    <View style={[styles.inputBox, !editable && styles.readOnlyBox]}>
      <Ionicons
        name={icon}
        size={16}
        color={editable ? COLORS.primary : COLORS.textMuted}
      />
      <TextInput
        style={[styles.input, !editable && styles.readOnlyText]}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  </View>
);

const ProfileModal = ({
  visible,
  user,
  student,
  isStudentRole = false,
  onClose,
  onSaveProfile,
  onSaveTutorProfile,
}) => {
  const [email, setEmail] = useState(user?.email || '');
  const [telefono, setTelefono] = useState(user?.telefono || '');
  const [domicilio, setDomicilio] = useState(user?.domicilio || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const syncFieldsFromUser = () => {
    setEmail(user?.email || student?.emailPadre || '');
    setTelefono(user?.telefono || '');
    setDomicilio(user?.domicilio || student?.domicilio || '');
    setError('');
    setSuccessMsg('');
  };

  const handleSubmit = async () => {
    if (isStudentRole) return;
    setError('');
    setSuccessMsg('');
    setSaving(true);
    try {
      const saveFn = onSaveTutorProfile || onSaveProfile;
      if (saveFn) {
        await saveFn({ email, telefono, domicilio });
      }
      setSuccessMsg('Datos de contacto actualizados correctamente.');
      setTimeout(() => {
        setSuccessMsg('');
        onClose?.();
      }, 900);
    } catch (err) {
      setError(err?.message || 'No se pudieron actualizar los datos de perfil.');
    } finally {
      setSaving(false);
    }
  };

  const fullName =
    user?.nombreCompleto ||
    `${user?.nombre || ''} ${user?.apellido || ''}`.trim() ||
    student?.nombreCompleto ||
    'Usuario Institucional';
  const roleLabel = isStudentRole ? 'Estudiante' : 'Padre / Tutor Responsable';
  const studentAcademic = isStudentRole
    ? `${user?.curso || student?.curso || 'Curso asignado'} ${user?.division || student?.division || ''}`.trim()
    : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onShow={syncFieldsFromUser}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person-outline" size={20} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Mi Perfil Institucional</Text>
                <Text style={styles.subtitle}>{roleLabel}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View
              style={[
                styles.policyBanner,
                isStudentRole && styles.policyBannerStudent,
              ]}
            >
              <Ionicons
                name={isStudentRole ? 'lock-closed-outline' : 'information-circle-outline'}
                size={17}
                color={isStudentRole ? COLORS.amber : COLORS.indigo}
              />
              <Text
                style={[
                  styles.policyText,
                  isStudentRole && { color: '#92400E' },
                ]}
              >
                {isStudentRole
                  ? 'El perfil de alumno es de solo lectura. No se permite modificar datos filiatorios ni de contacto desde una cuenta de estudiante.'
                  : 'Como tutor responsable puede actualizar únicamente su correo electrónico, dirección y teléfono de contacto. Los demás datos son administrados por la institución.'}
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color={COLORS.rose} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {successMsg ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.emerald} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            <Text style={styles.sectionTitle}>DATOS INSTITUCIONALES</Text>

            <ReadOnlyField
              label="Nombre y Apellido"
              value={fullName}
              icon="person-outline"
            />
            <ReadOnlyField
              label="Documento Nacional de Identidad (DNI)"
              value={user?.dni || 'No registrado'}
              icon="card-outline"
            />
            {isStudentRole && (
              <>
                <ReadOnlyField
                  label="Legajo Estudiantil"
                  value={user?.legajo || user?.studentID_login}
                  icon="school-outline"
                />
                <ReadOnlyField
                  label="Curso y División"
                  value={studentAcademic}
                  icon="book-outline"
                />
              </>
            )}

            <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
              DATOS DE CONTACTO
            </Text>

            <EditableContactField
              label="Correo Electrónico"
              value={email}
              onChangeText={setEmail}
              editable={!isStudentRole}
              icon="mail-outline"
              placeholder="ejemplo@familia.edu.ar"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <EditableContactField
              label="Teléfono de Contacto"
              value={telefono}
              onChangeText={setTelefono}
              editable={!isStudentRole}
              icon="call-outline"
              placeholder="Ej: 3624001122"
              keyboardType="phone-pad"
            />

            <EditableContactField
              label="Dirección / Domicilio"
              value={domicilio}
              onChangeText={setDomicilio}
              editable={!isStudentRole}
              icon="location-outline"
              placeholder="Ej: Av. Sarmiento 1250"
            />
          </ScrollView>

          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelBtnText}>
                {isStudentRole ? 'Cerrar' : 'Cancelar'}
              </Text>
            </TouchableOpacity>

            {!isStudentRole && (
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.65 }]}
                onPress={handleSubmit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={17} color={COLORS.white} />
                    <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingBottom: 10,
  },
  policyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: COLORS.indigoSoft,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
  },
  policyBannerStudent: {
    backgroundColor: COLORS.amberSoft,
    borderColor: COLORS.amberBorder,
  },
  policyText: {
    flex: 1,
    fontSize: 11.5,
    color: COLORS.indigo,
    lineHeight: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  lockedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: COLORS.surfaceAlt,
  },
  lockedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  editableTag: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.emerald,
    backgroundColor: COLORS.emeraldSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  readOnlyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceAlt,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
    padding: 0,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.roseSoft,
    borderColor: COLORS.roseBorder,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.rose,
    fontWeight: '600',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.emeraldSoft,
    borderColor: COLORS.emeraldBorder,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  successText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.emerald,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
});

export default ProfileModal;
