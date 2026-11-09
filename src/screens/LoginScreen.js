import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const INSTITUTION_LOGO_URL =
  'https://firebasestorage.googleapis.com/v0/b/centro-educativo-f5cc5.firebasestorage.app/o/logo.png?alt=media&token=6eb92627-deee-4396-94c8-a8bd3920c0f4';

const LoginScreen = () => {
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleLoginSubmit = async () => {
    setLoginError('');
    setIsSubmitting(true);
    try {
      await login(identifier, password, 'Estudiante/Tutor');
    } catch (err) {
      if (
        err?.code === 'auth/invalid-credential' ||
        err?.message?.includes('invalid-credential')
      ) {
        setLoginError('Usuario o contraseña incorrectos. Por favor revise sus credenciales.');
      } else {
        setLoginError(
          err?.message || 'Usuario o contraseña incorrectos. Por favor revise sus credenciales.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          {/* Logo e Identidad */}
          <View style={styles.logoContainer}>
            <View style={styles.logoBox}>
              {!logoError ? (
                <Image
                  source={{ uri: INSTITUTION_LOGO_URL }}
                  style={styles.logoImage}
                  resizeMode="contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Ionicons name="school" size={36} color="#EA580C" />
              )}
            </View>
          </View>

          {/* Campo Correo / Legajo */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Legajo de estudiante o Correo del Tutor
            </Text>
            <View style={styles.inputWrapper}>
              <Ionicons
                name="person-circle-outline"
                size={20}
                color="#94A3B8"
              />
              <TextInput
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                placeholder="EST-2027-1234 o tutor@correo.com"
                placeholderTextColor="#94A3B8"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Campo Contraseña */}
          <View style={styles.fieldGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabelNoMargin}>Contraseña</Text>
              <TouchableOpacity
                onPress={() => setIsForgotPasswordOpen(true)}
                activeOpacity={0.75}
              >
                <Text style={styles.forgotPasswordLink}>
                  ¿Olvidaste tu contraseña?
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94A3B8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.visibilityBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Botón Iniciar Sesión */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              isSubmitting && styles.submitBtnDisabled,
            ]}
            onPress={handleLoginSubmit}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <View style={styles.submitBtnInner}>
                <Text style={styles.submitBtnText}>Iniciar Sesión</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Mensaje de Error */}
          {loginError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{loginError}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Modal de Contacto a Soporte ante pérdida de contraseña */}
      <ForgotPasswordModal
        visible={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#232C51',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 4,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  logoImage: {
    width: '120',
    height: '120',
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  fieldLabelNoMargin: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  forgotPasswordLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EA580C',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14.5,
    color: '#1E293B',
  },
  visibilityBtn: {
    padding: 4,
  },
  submitBtn: {
    marginTop: 6,
    backgroundColor: '#EA580C',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
  },
  errorBanner: {
    marginTop: 16,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 11,
  },
  errorBannerText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default LoginScreen;
