import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Linking } from 'react-native';
import { Body, Button, Card, H1, H2, Screen } from '@app/components/Common';
import { useApp } from '@app/hooks/useApp';
import { SUBSCRIPTION_DISCLOSURE } from '@shared/constants/disclaimers';
import { PREMIUM_PRICE_FORMATTED } from '@shared/constants/billing';
import { SubscriptionPlan } from '@domain/entities';

export function PaywallScreen() {
  const { container, refreshEntitlement } = useApp();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setPlans(await container.billing.getAvailablePlans());
      } catch (err) {
        console.warn('[paywall] could not fetch plans', err);
      }
    })();
  }, [container]);

  const purchase = async () => {
    setBusy(true);
    try {
      await container.billing.purchasePremiumMonthly();
      await refreshEntitlement();
      Alert.alert('Subscription started', 'Your premium subscription is active.');
    } catch (err: any) {
      Alert.alert('Could not start subscription', err?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      await container.billing.restorePurchases();
      await refreshEntitlement();
      Alert.alert('Purchases restored');
    } catch (err: any) {
      Alert.alert('Could not restore', err?.message ?? 'Try again.');
    }
  };

  const openManage = () => {
    Linking.openURL('https://play.google.com/store/account/subscriptions');
  };

  const headline = plans[0]
    ? `1 month free, then ${plans[0].priceFormatted}/month`
    : `1 month free, then ${PREMIUM_PRICE_FORMATTED}/month`;

  return (
    <Screen>
      <ScrollView>
        <H1>Premium</H1>
        <Card>
          <H2>{headline}</H2>
          <Body>{SUBSCRIPTION_DISCLOSURE}</Body>
        </Card>
        <Card>
          <H2>What's included</H2>
          <Body>• Unlimited cases & documents</Body>
          <Body>• All guided rights review modules</Body>
          <Body>• Pattern matching across opt-in cohorts</Body>
          <Body>• Attorney / advocate intake packets</Body>
          <Body>• OCR-assisted document extraction</Body>
          <Body>• Hearing & deadline reminders</Body>
        </Card>
        <Button label={busy ? 'Starting…' : 'Start free trial'} onPress={purchase} disabled={busy} />
        <Button label="Restore purchases" variant="ghost" onPress={restore} />
        <Button label="Manage subscription in Google Play" variant="ghost" onPress={openManage} />
      </ScrollView>
    </Screen>
  );
}
