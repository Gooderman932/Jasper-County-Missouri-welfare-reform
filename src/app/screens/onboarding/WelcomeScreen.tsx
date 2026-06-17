import React from 'react';
import { ScrollView } from 'react-native';
import { Body, Button, H1, Screen } from '@app/components/Common';

export function WelcomeScreen({ navigation }: any) {
  return (
    <Screen>
      <ScrollView>
        <H1>Family Rights</H1>
        <Body muted>
          Organize your case, understand the process, and prepare materials for licensed legal review.
        </Body>
        <Body style={{ marginTop: 14 }}>
          This app is built for parents and allies facing child welfare investigations, foster care
          placements, reunification plans, and termination-of-parental-rights proceedings.
        </Body>
      </ScrollView>
      <Button label="Get started" onPress={() => navigation.navigate('Mission')} />
      <Button label="I already have an account" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
    </Screen>
  );
}
