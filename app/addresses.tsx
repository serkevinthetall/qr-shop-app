import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator, Button, HelperText } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddressDisplayText } from '@/components/address/address-display-text';
import { AddressFormModal } from '@/components/address/address-form-modal';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';
import { deleteAddress, fetchAddresses } from '@/services/address-api';
import type { Address } from '@/types/address';
import { canEditAddress, getDeliveryAddresses, getMainAddress } from '@/types/address';

export default function AddressesScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs, horizontalPadding, contentMaxWidth } = useResponsive();
  const { token } = useAuth();
  const { t, fs, lh } = useLanguage();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  const loadAddresses = useCallback(async () => {
    if (!token) {
      return;
    }

    const list = await fetchAddresses(token);
    setAddresses(getDeliveryAddresses(list));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    loadAddresses()
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load addresses.');
      })
      .finally(() => setIsLoading(false));
  }, [loadAddresses, token]);

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
            setError(err instanceof Error ? err.message : 'Failed to delete address.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingHorizontal: horizontalPadding,
          },
        ]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text, fontSize: fs(rs(20)), lineHeight: lh(20) }]}>{t('addresses.title')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth, alignSelf: 'center', width: '100%' },
        ]}>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: fs(rs(14)), lineHeight: lh(14) }]}>
          {t('addresses.subtitle')}
        </Text>

        {error ? <HelperText type="error">{error}</HelperText> : null}

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            {addresses.map((address) => (
              <View
                key={address.id}
                style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              </View>
            ))}

            {!addresses.length ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted, lineHeight: lh(14) }}>{t('addresses.noSaved')}</Text>
              </View>
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '700',
  },
  headerSpacer: {
    width: 40,
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
