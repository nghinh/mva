import React from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useExampleQuery } from '../hooks/use-example-query';

export function ExampleScreen() {
  const { data, isLoading, isRefetching, error, refetch } = useExampleQuery();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center">Failed to load data.</Text>
      </View>
    );
  }

  if (!data || data.items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-center">No data available.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
      contentContainerStyle={{ padding: 16 }}
    >
      {data.items.map((item) => (
        <Text key={item.id}>{item.title}</Text>
      ))}
    </ScrollView>
  );
}
