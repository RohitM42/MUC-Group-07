import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../context/ThemeContext';

export default function LiveScreen() {
  const { colours } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colours.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colours.textSub, fontSize: 16 }}>Live Tracking — coming soon</Text>
    </View>
  );
}
