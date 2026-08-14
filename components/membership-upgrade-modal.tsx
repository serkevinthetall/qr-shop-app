import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

export type UpgradePlan = 'premium' | 'pro';

export type UpgradeContactInfo = {
  name: string;
  phone: string;
  email: string;
};

type MembershipUpgradeModalProps = {
  visible: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onSelectPlan: (plan: UpgradePlan) => void;
};

export function MembershipUpgradeModal({
  visible,
  isSubmitting = false,
  onClose,
  onSelectPlan,
}: MembershipUpgradeModalProps) {
  const colors = useAppColors();
  const { rs } = useResponsive();
  const { t, fs, lh } = useLanguage();
  const [previewPlan, setPreviewPlan] = useState<UpgradePlan>('pro');

  useEffect(() => {
    if (visible) {
      setPreviewPlan('pro');
    }
  }, [visible]);

  const activePlan = previewPlan;

  const planPrice =
    activePlan === 'pro'
      ? t('account.upgradeProBenefitPrice')
      : t('account.upgradePremiumBenefitPrice');

  const benefits = useMemo(() => {
    if (activePlan === 'pro') {
      return [
        t('account.upgradeProBenefitMinPrice'),
        t('account.upgradeProBenefitCoupon'),
        t('account.upgradeProBenefitCommission'),
      ];
    }

    return [
      t('account.upgradePremiumBenefitMinPrice'),
      t('account.upgradePremiumBenefitCoupon'),
      t('account.upgradePremiumBenefitCommission'),
    ];
  }, [activePlan, t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.backdrop,
          { backgroundColor: colors.isDark ? 'rgba(0,0,0,0.72)' : 'rgba(15,23,42,0.4)' },
        ]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              shadowColor: colors.shadow,
            },
          ]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text, fontSize: fs(rs(17)), lineHeight: lh(17) }]}>
              {t('account.upgradeChooseTitle')}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              disabled={isSubmitting}
              accessibilityRole="button"
              style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.plansBody}>
            <View style={[styles.segment, { backgroundColor: colors.inputBg }]}>
              <Pressable
                onPress={() => setPreviewPlan('pro')}
                disabled={isSubmitting}
                style={[
                  styles.segmentItem,
                  activePlan === 'pro' ? { backgroundColor: colors.primary } : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: activePlan === 'pro' }}>
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: activePlan === 'pro' ? colors.onPrimary : colors.text,
                      fontSize: fs(rs(14)),
                      lineHeight: lh(14),
                    },
                  ]}>
                  {t('account.memberStatusPro')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setPreviewPlan('premium')}
                disabled={isSubmitting}
                style={[
                  styles.segmentItem,
                  activePlan === 'premium' ? { backgroundColor: colors.primary } : null,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: activePlan === 'premium' }}>
                <Text
                  style={[
                    styles.segmentText,
                    {
                      color: activePlan === 'premium' ? colors.onPrimary : colors.text,
                      fontSize: fs(rs(14)),
                      lineHeight: lh(14),
                    },
                  ]}>
                  {t('account.memberStatusPremium')}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.planBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.planBoxTitle, { color: colors.text, fontSize: fs(rs(16)), lineHeight: lh(16) }]}>
                {activePlan === 'pro' ? t('account.upgradeProTitle') : t('account.upgradePremiumTitle')}
              </Text>

              <View style={[styles.priceChip, { backgroundColor: colors.primaryMuted }]}>
                <Text
                  style={[
                    styles.priceChipText,
                    { color: colors.primary, fontSize: fs(rs(13)), lineHeight: lh(13) },
                  ]}>
                  {planPrice}
                </Text>
              </View>

              {benefits.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} style={styles.benefitIcon} />
                  <Text
                    style={[
                      styles.benefitText,
                      { color: colors.text, fontSize: fs(rs(13)), lineHeight: lh(13) ?? rs(22) },
                    ]}>
                    {benefit}
                  </Text>
                </View>
              ))}
            </View>

            <Button
              mode="contained"
              icon="arrow-right"
              onPress={() => onSelectPlan(activePlan)}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              labelStyle={[styles.submitLabel, { fontSize: fs(rs(15)), lineHeight: lh(15) }]}>
              {t('account.upgradeSubmit')}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingTop: 20,
    paddingBottom: 22,
    paddingHorizontal: 18,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    flex: 1,
    fontWeight: '800',
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansBody: {
    gap: 0,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    fontWeight: '700',
  },
  planBox: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 26,
    minHeight: 240,
  },
  planBoxTitle: {
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  priceChip: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
  },
  priceChipText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 16,
    paddingVertical: 2,
  },
  benefitIcon: {
    marginTop: 2,
  },
  benefitText: {
    flex: 1,
    fontWeight: '500',
  },
  submitButton: {
    marginTop: 20,
    borderRadius: 999,
  },
  submitButtonContent: {
    height: 50,
    flexDirection: 'row-reverse',
  },
  submitLabel: {
    fontWeight: '700',
  },
});
