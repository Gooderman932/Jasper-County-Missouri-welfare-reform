import React from 'react';
import { ScrollView } from 'react-native';
import { Body, Button, Card, H2, Screen } from '@app/components/Common';
import { PRIMARY_DISCLAIMER, SAFETY_NOTE } from '@shared/constants/disclaimers';

export function MissionScreen({ navigation }: any) {
  return (
    <Screen>
      <ScrollView>
        <Card>
          <H2>What this app does</H2>
          <Body>• Preserve and organize facts before they are lost.</Body>
          <Body>• Convert chaotic case history into a structured, dated timeline.</Body>
          <Body>• Surface process concerns that may deserve attorney or advocate review.</Body>
          <Body>• Identify recurring patterns across similarly situated families.</Body>
          <Body>• Create exportable, lawyer-readable case packets.</Body>
        </Card>
        <Card>
          <H2>What this app does not do</H2>
          <Body>{PRIMARY_DISCLAIMER}</Body>
          <Body style={{ marginTop: 8 }}>{SAFETY_NOTE}</Body>
        </Card>
      </ScrollView>
      <Button label="Continue" onPress={() => navigation.navigate('PrivacyConsent')} />
    </Screen>
  );
}
