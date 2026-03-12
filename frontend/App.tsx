import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BleProvider } from './context/BleContext';

import DashboardScreen from './screens/DashboardScreen';
import ConnectScreen   from './screens/ConnectScreen';
import LiveScreen      from './screens/LiveScreen';
import HistoryScreen   from './screens/HistoryScreen';

// Tab navigator setup --------------------------------------------------------

export type RootTabParamList = {
  Dashboard: undefined;
  Connect:   undefined;
  Live:      undefined;
  History:   undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

// Tab bar icons (text-based for now, swap for vector icons later) ------------

function tabIcon(label: string, focused: boolean) {
  const icons: Record<string, string> = {
    Dashboard: '⊞',
    Connect:   '⊙',
    Live:      '◈',
    History:   '≡',
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
      {icons[label] ?? '•'}
    </Text>
  );
}

// App ------------------------------------------------------------------------

export default function App() {
  return (
    <SafeAreaProvider>
      <BleProvider>
        <NavigationContainer>
          <StatusBar barStyle="light-content" backgroundColor="#111" />
          <Tab.Navigator
            screenOptions={({ route }) => ({
              tabBarIcon: ({ focused }) => tabIcon(route.name, focused),
              tabBarActiveTintColor:   '#22c55e',
              tabBarInactiveTintColor: '#888',
              tabBarStyle: {
                backgroundColor: '#1a1a1a',
                borderTopColor:  '#2a2a2a',
              },
              headerStyle: {
                backgroundColor: '#111',
              },
              headerTintColor:      '#fff',
              headerTitleStyle: {
                fontWeight: '600',
              },
            })}
          >
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen name="Connect"   component={ConnectScreen}   />
            <Tab.Screen
              name="Live"
              component={LiveScreen}
              options={{ title: 'Live Tracking' }}
            />
            <Tab.Screen name="History"   component={HistoryScreen}   />
          </Tab.Navigator>
        </NavigationContainer>
      </BleProvider>
    </SafeAreaProvider>
  );
}
