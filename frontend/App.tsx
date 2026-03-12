import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar, Text } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BleProvider }   from './context/BleContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';

import DashboardScreen from './screens/DashboardScreen';
import ConnectScreen   from './screens/ConnectScreen';
import LiveScreen      from './screens/LiveScreen';
import HistoryScreen   from './screens/HistoryScreen';
import SettingsScreen  from './screens/SettingsScreen';

// Tab navigator setup --------------------------------------------------------

export type RootTabParamList = {
  Dashboard: undefined;
  Connect:   undefined;
  Live:      undefined;
  History:   undefined;
  Settings:  undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const TAB_ICONS: Record<string, string> = {
  Dashboard: '⊞',
  Connect:   '⊙',
  Live:      '◈',
  History:   '≡',
  Settings:  '⚙',
};

// Inner app (needs access to theme + safe area) -------------------------------

function AppInner() {
  const insets          = useSafeAreaInsets();
  const { colours, isDark } = useTheme();

  const ACTIVE_COLOR   = colours.accent;
  const INACTIVE_COLOR = colours.textSub;

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colours.background}
      />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused }) => (
            <Text style={{ fontSize: 24, color: focused ? ACTIVE_COLOR : INACTIVE_COLOR }}>
              {TAB_ICONS[route.name] ?? '•'}
            </Text>
          ),
          tabBarActiveTintColor:   ACTIVE_COLOR,
          tabBarInactiveTintColor: INACTIVE_COLOR,
          tabBarLabelStyle: {
            fontSize: 12,
            marginBottom: 4,
          },
          tabBarStyle: {
            backgroundColor: colours.surface,
            borderTopColor:  colours.border,
            height: 64 + insets.bottom,
            paddingTop: 8,
            paddingBottom: insets.bottom,
          },
          headerStyle: {
            backgroundColor: colours.background,
          },
          headerTintColor: colours.text,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
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
        <Tab.Screen name="History"  component={HistoryScreen}  />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Root app -------------------------------------------------------------------

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BleProvider>
          <AppInner />
        </BleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
