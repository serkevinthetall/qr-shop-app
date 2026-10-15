import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { LanguageToggleChip } from '@/components/language-toggle-chip';
import { useAppStatus } from '@/contexts/app-status-context';
import { useLanguage } from '@/contexts/language-context';
import { useNetwork } from '@/contexts/network-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { exitAppProcess } from '@/utils/quit-app';

/**
 * Blocks the app when the API is unreachable, or when maintenance mode is on
 * (shop paused via backend app-config — announcement-style overlay).
 */
export function ServerDownNotice() {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh, language, setLanguage } = useLanguage();
  const { isOnline } = useNetwork();
  const {
    maintenance,
    serverDown,
    forceUpdateRequired,
    isChecking,
    refreshStatus,
  } = useAppStatus();
  const [isQuitting, setIsQuitting] = useState(false);
  const forcedMyanmarRef = useRef(false);

  const visible =
    !forceUpdateRequired && (maintenance || (serverDown && isOnline));
  const busy = isChecking || isQuitting;
  // iOS cannot kill the app process — hide Close so it does not look broken.
  const showQuitButton = Platform.OS !== 'ios';

  // Maintenance announcement always opens in Myanmar first; chip can switch after.
  useEffect(() => {
    if (!maintenance || !visible) {
      forcedMyanmarRef.current = false;
      return;
    }

    if (!forcedMyanmarRef.current) {
      forcedMyanmarRef.current = true;
      if (language !== 'my') {
        setLanguage('my');
      }
    }
  }, [maintenance, visible, language, setLanguage]);

  const handleRetry = async () => {
    if (busy || maintenance) {
      return;
    }

    await refreshStatus();
  };

  const handleQuit = () => {
    if (isQuitting) {
      return;
    }

    setIsQuitting(true);

    try {
      // Exit the app only — do not sign out / clear account.
      exitAppProcess();
    } finally {
      setIsQuitting(false);
    }
  };

  if (maintenance) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleQuit}>
        <View style={[styles.announceBackdrop, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.announceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}>
            <LanguageToggleChip
              style={[
                styles.languageChip,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            />

            <View style={[styles.announceIconWrap, { backgroundColor: colors.primaryMuted }]}>
              <MaterialCommunityIcons
                name="storefront-outline"
                size={rs(36)}
                color={colors.primary}
              />
            </View>

            <Text
              style={[
                styles.announceTitle,
                {
                  color: colors.text,
                  fontSize: fs(rs(16)),
                  lineHeight: lh(16),
                },
              ]}>
              {t('network.maintenanceTitle')}
            </Text>

            <Text
              style={[
                styles.announceBody,
                {
                  color: colors.textMuted,
                  fontSize: fs(rs(14)),
                  lineHeight: lh(14),
                },
              ]}>
              {t('network.maintenanceThanks')}
            </Text>

            <Text
              style={[
                styles.announceBody,
                {
                  color: colors.textMuted,
                  fontSize: fs(rs(14)),
                  lineHeight: lh(14),
                },
              ]}>
              {t('network.maintenanceWish')}
            </Text>

            <Text
              style={[
                styles.announceBody,
                {
                  color: colors.textMuted,
                  fontSize: fs(rs(14)),
                  lineHeight: lh(14),
                },
              ]}>
              {t('network.maintenanceMerit')}
            </Text>

            <Text
              style={[
                styles.announceSign,
                {
                  color: colors.primary,
                  fontSize: fs(rs(13)),
                  lineHeight: lh(13),
                },
              ]}>
              {t('network.maintenanceSign')}
            </Text>

            {showQuitButton ? (
              <Pressable
                onPress={handleQuit}
                disabled={isQuitting}
                style={[
                  styles.announceQuit,
                  {
                    backgroundColor: colors.primary,
                    opacity: isQuitting ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.announceQuitText,
                    { color: colors.onPrimary, fontSize: fs(14) },
                  ]}>
                  {isQuitting ? '...' : t('network.quit')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    );
  }

  const title = t('network.serverDownTitle');
  const body = t('network.serverDownBody');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleQuit}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.75)' : 'rgba(15,23,42,0.45)' },
        ]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.shadow,
            },
          ]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryMuted }]}>
            <MaterialCommunityIcons name="cloud-off-outline" size={rs(36)} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(17)), lineHeight: lh(17) }]}>
            {title}
          </Text>

          <Text
            style={[styles.body, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
            {body}
          </Text>

          <Text
            style={[
              styles.tip,
              { color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) },
            ]}>
            {t('network.serverDownDnsTip')}
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                handleRetry().catch(() => {});
              }}
              disabled={busy}
              style={[
                styles.actionButton,
                {
                  backgroundColor: colors.primary,
                  opacity: busy ? 0.7 : 1,
                },
              ]}
              accessibilityRole="button">
              <Text style={[styles.actionText, { color: colors.onPrimary, fontSize: fs(14) }]}>
                {isChecking ? '...' : t('network.retry')}
              </Text>
            </Pressable>

            {showQuitButton ? (
              <Pressable
                onPress={handleQuit}
                disabled={isQuitting}
                style={[
                  styles.actionButton,
                  styles.quitButton,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.inputBg,
                    opacity: isQuitting ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.actionText,
                    {
                      color: colors.text,
                      fontSize: fs(14),
                    },
                  ]}>
                  {isQuitting ? '...' : t('network.quit')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  announceBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  announceCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 22,
    borderWidth: 1,
    paddingTop: 36,
    paddingBottom: 28,
    paddingHorizontal: 28,
    alignItems: 'center',
    position: 'relative',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
  languageChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  announceIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  announceTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 18,
  },
  announceBody: {
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 16,
  },
  announceSign: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 24,
  },
  announceQuit: {
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: 'center',
  },
  announceQuitText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 20,
    borderWidth: 1,
    paddingTop: 32,
    paddingBottom: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 8,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
  },
  tip: {
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
  },
  actions: {
    width: '100%',
    gap: 10,
  },
  actionButton: {
    width: '100%',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
  },
  quitButton: {
    borderWidth: 1,
  },
  actionText: {
    fontWeight: '700',
  },
});
