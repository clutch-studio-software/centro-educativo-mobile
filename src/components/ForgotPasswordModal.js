import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../theme/colors';

/**
 * Modal informativo para la recuperación y restablecimiento de contraseña.
 * Replica el diseño y contenido institucional de la plataforma web:
 * informa que no se recupera automáticamente desde la app sino que debe
 * gestionarse comunicándose o acercándose al establecimiento (Telefónica,
 * Correo Electrónico o Presencial en Secretaría).
 */
const ForgotPasswordModal = ({ visible, onClose }) => {
  const handleCall = () => {
    Linking.openURL('tel:+541148217934').catch(() => {});
  };

  const handleEmail = () => {
    Linking.openURL(
      'mailto:administracion@educ.ar?subject=Solicitud%20de%20Restablecimiento%20de%20Contrase%C3%B1a'
    ).catch(() => {});
  };

  return (
    <Modal
      visible={Boolean(visible)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.headerIconBox}>
                  <Ionicons name="key" size={22} color="#EA580C" />
                </View>
                <View style={styles.headerTitles}>
                  <Text style={styles.title}>Restablecer Contraseña</Text>
                  <Text style={styles.subtitle}>
                    Gestión de credenciales y seguridad institucional
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                accessibilityLabel="Cerrar modal"
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Texto informativo */}
            <View style={styles.infoBanner}>
              <Text style={styles.infoBannerText}>
                Por normativas de seguridad escolar y confidencialidad de legajos,
                el blanqueo de contraseñas se gestiona con verificación previa.
                Puedes solicitarlo acercándote al establecimiento o comunicándote
                por cualquiera de los siguientes canales:
              </Text>
            </View>

            {/* Tarjetas de contacto */}
            <View style={styles.cardsContainer}>
              {/* Opción 1: Telefónica */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCall}
                style={styles.contactCard}
              >
                <View style={[styles.cardIconBox, styles.amberIconBox]}>
                  <Ionicons name="call" size={19} color="#D97706" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTag, { color: '#92400E' }]}>
                    VÍA TELEFÓNICA
                  </Text>
                  <Text style={styles.cardPrimaryText}>+54 (011) 4821-7934</Text>
                  <Text style={styles.cardSecondaryText}>
                    Interno 102 (Secretaría General) · Lunes a Viernes de 08:00 a
                    17:30 hs.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Opción 2: Correo Electrónico */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleEmail}
                style={styles.contactCard}
              >
                <View style={[styles.cardIconBox, styles.blueIconBox]}>
                  <Ionicons name="mail" size={19} color="#2563EB" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTag, { color: '#1E40AF' }]}>
                    CORREO ELECTRÓNICO
                  </Text>
                  <Text style={styles.cardLinkText}>administracion@educ.ar</Text>
                  <Text style={styles.cardSecondaryText}>
                    Indicar en el mensaje nombre completo, DNI y rol o legajo
                    institucional.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Opción 3: Presencial en Secretaría */}
              <View style={styles.contactCard}>
                <View style={[styles.cardIconBox, styles.purpleIconBox]}>
                  <Ionicons name="business" size={19} color="#9333EA" />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTag, { color: '#6B21A8' }]}>
                    PRESENCIAL EN SECRETARÍA
                  </Text>
                  <Text style={styles.cardPrimaryText}>
                    Edificio Central · Planta Baja
                  </Text>
                  <Text style={styles.cardSecondaryText}>
                    Acercarse con documento de identidad para el blanqueo
                    presencial en el momento.
                  </Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.understoodBtn}
                onPress={onClose}
                activeOpacity={0.85}
              >
                <Text style={styles.understoodBtnText}>Entendido</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  dialog: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 10,
  },
  scrollContent: {
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFEDD5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  infoBanner: {
    backgroundColor: '#F8FAFC',
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoBannerText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  cardsContainer: {
    gap: 10,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: COLORS.white,
  },
  cardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  amberIconBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  blueIconBox: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  purpleIconBox: {
    backgroundColor: '#FAF5FF',
    borderColor: '#E9D5FF',
  },
  cardBody: {
    flex: 1,
  },
  cardTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  cardPrimaryText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  cardLinkText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2563EB',
    textDecorationLine: 'underline',
    marginTop: 2,
  },
  cardSecondaryText: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 16,
  },
  footer: {
    paddingTop: 4,
  },
  understoodBtn: {
    backgroundColor: '#EA580C',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  understoodBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '800',
  },
});

export default ForgotPasswordModal;
