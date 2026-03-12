import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ConnectScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Connect — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  text:      { color: '#fff', fontSize: 16 },
});
