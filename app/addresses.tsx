import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressDisplayText } from '@/components/address/address-display-text';
import { AddressFormModal } from '@/components/address/address-form-modal';
import { DetailHeaderBar } from '@/components/detail-header-bar';
import { InlineErrorBanner } from '@/components/inline-error-banner';
import { LiquidSurface } from '@/components/liquid-surface';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors, useThemeMode } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { deleteAddress, fetchAddresses } from '@/services/address-api';
import { getUserFacingError } from '@/services/auth-error';
import type { Address } from '@/types/address';
import { canEditAddress, getDeliveryAddresses, getMainAddress } from '@/types/address';
import { isLiquidUiEnabled, liquidGlassBorder } from '@/utils/liquid-ui';

export default function AddressesScreen() {
  const colors = useAppColors();
  const { isDark } = useThemeMode();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token } = useAuth();
  const { t, fs, lh } = useLanguage();
  const liquid = isLiquidUiEnabled();
  const cardBorder = liquid ? liquidGlassBorder(isDark) : colors.border;

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadAddresses = useCallback(async () => {
    if (!token) {
      return;
    }

    const list = await fetchAddresses(token);
    setAddresses(getDeliveryAddresses(list));
  }, [token]);

  const handleReload = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsRefreshing(true);
    setError('');
    try {
      await loadAddresses();
    } catch (err) {
      const message = getUserFacingError(err, t('errors.loadAddresses'), t);
      if (message) setError(message);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [loadAddresses, token, t]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    loadAddresses()
      .catch((err) => {
        const message = getUserFacingError(err, t('errors.loadAddresses'), t);
        if (message) setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [loadAddresses, token, t]);

  const mainAddress = getMainAddress(addresses);

  const handleDeleteAddress = (address: Address) => {
    if (!token || !canEditAddress(address, mainAddress)) {
      return;
    }

    Alert.alert(t('addresses.deleteTitle'), t('addresses.deleteConfirm', { name: String(address.name) }), [
      { text: t('addresses.cancel'), style: 'cancel' },
      {
        text: t('addresses.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAddress(token, address.id);
            await loadAddresses();
          } catch (err) {
            const message = getUserFacingError(err, t('errors.deleteAddress'), t);
            if (message) setError(message);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: colors.background }]}
      edges={liquid ? ['bottom'] : ['top', 'bottom']}>
      <DetailHeaderBar title={t('addresses.title')} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
          {t('addresses.subtitle')}
        </Text>

        {error ? (
          <InlineErrorBanner
            message={error}
            onRetry={() => {
              void handleReload();
            }}
            onDismiss={() => setError('')}
            retrying={isRefreshing}
            style={{ marginHorizontal: 0 }}
          />
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {addresses.map((address) => (
              <LiquidSurface
                key={address.id}
                style={[styles.card, { borderColor: cardBorder }]}
                backgroundColor={colors.card}
                cornerRadius={16}
                glassStyle="regular"
                interactive>
                <AddressDisplayText
                  address={address}
                  nameSize={rs(16)}
                  metaSize={rs(13)}
                  textColor={colors.text}
                  mutedColor={colors.textMuted}
                />
                <View style={styles.cardActions}>
                  {canEditAddress(address, mainAddress) ? (
                    <>
                      <Button
                        mode="outlined"
                        compact
                        onPress={() => {
                          setEditingAddress(address);
                          setFormMode('edit');
                        }}>
                        {t('addresses.edit')}
                      </Button>
                      <Button mode="text" textColor={colors.danger} onPress={() => handleDeleteAddress(address)}>
                        {t('addresses.delete')}
                      </Button>
                    </>
                  ) : (
                    <Text style={{ color: colors.textMuted, fontSize: fs(rs(12)), lineHeight: lh(12) }}>{t('addresses.mainAccountAddress')}</Text>
                  )}
                </View>
              </LiquidSurface>
            ))}

            {!addresses.length ? (
              <LiquidSurface
                style={[styles.card, { borderColor: cardBorder }]}
                backgroundColor={colors.card}
                cornerRadius={16}
                glassStyle="regular">
                <Text style={{ color: colors.textMuted, lineHeight: lh(14) }}>{t('addresses.noSaved')}</Text>
              </LiquidSurface>
            ) : null}

            <Button
              mode="contained"
              icon="plus"
              onPress={() => {
                setEditingAddress(null);
                setFormMode('add');
              }}
              style={styles.addButton}>
              {t('addresses.addNew')}
            </Button>
          </>
        )}
      </ScrollView>

      {token ? (
        <AddressFormModal
          visible={formMode !== null}
          mode={formMode === 'edit' ? 'edit' : 'add'}
          token={token}
          address={editingAddress}
          onDismiss={() => {
            setFormMode(null);
            setEditingAddress(null);
          }}
          onSaved={async () => {
            setFormMode(null);
            setEditingAddress(null);
            await loadAddresses();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  subtitle: {
    marginBottom: 16,
    lineHeight: 20,
  },
  loader: {
    marginVertical: 24,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  addButton: {
    marginTop: 4,
    marginBottom: 12,
  },
});
