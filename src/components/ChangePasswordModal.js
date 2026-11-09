import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

const ChangePasswordModal = ({
  visible,
  isMandatory = false,
  onClose,
  onSubmitPasswordChange,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSave = async () => {
    setError('');
    setSuccessMsg('');

    const cleanNew = String(newPassword || '').trim();
    const cleanConfirm = String(confirmPassword || '').trim();

    if (cleanNew.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (cleanNew !== cleanConfirm) {
      setError('Las contraseñas ingresadas no coinciden.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmitPasswordChange(cleanNew);
      setSuccessMsg('Contraseña actualizada correctamente.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setSuccessMsg('');
        if (onClose) onClose();
      }, 900);
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar la contraseña.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={isMandatory ? () => {} : onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="key-outline" size={20} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {isMandatory ? 'Cambio de Contraseña Obligatorio' : 'Actualizar Contraseña'}
              </Text>
              <Text style={styles.subtitle}>
                {isMandatory
                  ? 'Por seguridad institucional, debe reemplazar su clave inicial (DNI) antes de continuar.'
                  : 'Ingrese su nueva clave de acceso para el portal móvil y web.'}
              </Text>
            </View>
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

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Nueva Contraseña (mín. 6 caracteres)</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPwd}
                placeholder="Ingrese nueva contraseña"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPwd(!showPwd)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPwd ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={COLORS.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Confirmar Nueva Contraseña</Text>
            <TextInput
              style={styles.inputSingle}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPwd}
              placeholder="Repita la nueva contraseña"
              placeholderTextColor={COLORS.textMuted}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.actionsRow}>
            {!isMandatory && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={submitting}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>Guardar Nueva Clave</Text>
              )}
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
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 3,
    lineHeight: 17,
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
  fieldGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  eyeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputSingle: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  submitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});

export default ChangePasswordModal;
