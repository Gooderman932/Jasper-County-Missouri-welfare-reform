import React from 'react';
import { ScrollView } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { SUBSCRIPTION_DISCLOSURE } from '@shared/constants/disclaimers';
import { PREMIUM_PRICE_FORMATTED } from '@shared/constants/billing';

export function SubscriptionPreviewScreen({ navigation }: any) {
  return (
    <Screen>
      <ScrollView>
        <Card>
          <H2>Premium subscription</H2>
          <Body style={{ fontSize: 18, fontWeight: '700' }}>
            1 month free, then {PREMIUM_PRICE_FORMATTED}/month.
          </Body>
          <Body muted>Auto-renews unless canceled in Google Play.</Body>
        </Card>
        <Card>
          <H2>Free tier</H2>
          <Body>• 1 active case</Body>
          <Body>• Limited document uploads</Body>
          <Body>• Basic timeline + 2 review modules</Body>
        </Card>
        <Card>
          <H2>Premium tier</H2>
          <Body>• Unlimited cases & documents</Body>
          <Body>• All guided review modules</Body>
          <Body>• Pattern matching & coalition discovery</Body>
          <Body>• Attorney/advocate intake packets</Body>
          <Body>• OCR-assisted document extraction</Body>
          <Body>• Reminders & deadlines</Body>
        </Card>
        <Card>
          <Body muted>{SUBSCRIPTION_DISCLOSURE}</Body>
        </Card>
      </ScrollView>
      <Button label="Create my account" onPress={() => navigation.navigate('SignUp')} />
      <Button label="I already have an account" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
    </Screen>
  );
}
