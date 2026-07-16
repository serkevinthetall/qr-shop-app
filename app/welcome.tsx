import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { markWelcomeSeen } from '@/constants/onboarding';
import { useLanguage } from '@/contexts/language-context';
import { useAppColors } from '@/contexts/theme-context';
import { useResponsive } from '@/hooks/use-responsive';

const FEATURES = [
  {
    id: 'products',
    icon: 'inventory-2' as const,
    titleKey: 'welcome.featureProductsTitle',
    descriptionKey: 'welcome.featureProductsDescription',
  },
  {
    id: 'coupons',
    icon: 'card-giftcard' as const,
    titleKey: 'welcome.featureCouponsTitle',
    descriptionKey: 'welcome.featureCouponsDescription',
  },
  {
    id: 'orders',
    icon: 'receipt-long' as const,
    titleKey: 'welcome.featureOrdersTitle',
    descriptionKey: 'welcome.featureOrdersDescription',
  },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = useAppColors();
  const { rs, contentMaxWidth, horizontalPadding } = useResponsive();
  const { t, lh, language } = useLanguage();

  const titleSize = language === 'my' ? rs(22) : rs(26);
  const subtitleSize = language === 'my' ? rs(12) : rs(14);
  const featureTitleSize = language === 'my' ? rs(12) : rs(14);
  const featureDescSize = language === 'my' ? rs(11) : rs(12);
  const buttonSize = language === 'my' ? rs(14) : rs(15);

  const handleGetStarted = async () => {
    await markWelcomeSeen();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingHorizontal: horizontalPadding, maxWidth: contentMaxWidth }]}>
        <View style={[styles.heroIcon, { backgroundColor: colors.primaryMuted }]}>
          <MaterialIcons name="storefront" size={rs(48)} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text, fontSize: titleSize, lineHeight: lh(titleSize) }]}>
          {t('welcome.title')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textMuted, fontSize: subtitleSize, lineHeight: lh(subtitleSize) }]}>
          {t('welcome.subtitle')}
        </Text>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View
              key={feature.id}
              style={[styles.featureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primaryMuted }]}>
                <MaterialIcons name={feature.icon} size={rs(22)} color={colors.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text, fontSize: featureTitleSize, lineHeight: lh(featureTitleSize) }]}>
                  {t(feature.titleKey)}
                </Text>
                <Text
                  style={[
                    styles.featureDescription,
                    { color: colors.textMuted, fontSize: featureDescSize, lineHeight: lh(featureDescSize) },
                  ]}>
                  {t(feature.descriptionKey)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleGetStarted}
          contentStyle={styles.buttonContent}
          labelStyle={{ fontSize: buttonSize, fontWeight: '700' }}>
          {t('welcome.getStarted')}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 28,
  },
  features: {
    gap: 12,
    marginBottom: 32,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontWeight: '700',
    marginBottom: 2,
  },
  featureDescription: {
    fontWeight: '500',
  },
  buttonContent: {
    paddingVertical: 8,
  },
});
