import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { useExampleQuery } from '../hooks/use-example-query';

export function ExampleScreen() {
  const { data, isLoading } = useExampleQuery();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text>{data?.items?.[0]?.title ?? 'Hello mobile'}</Text>
    </View>
  );
}
