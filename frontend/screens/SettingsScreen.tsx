import React from 'react';
import { View, Text, Switch, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// Section wrapper -------------------------------------------------------------

function Section({ title, children, colours }: {
  title: string;
  children: React.ReactNode;
  colours: ReturnType<typeof useTheme>['colours'];
}) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={[styles.sectionTitle, { color: colours.textSub }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colours.surface, borderColor: colours.border }]}>
        {children}
      </View>
    </View>
  );
}

// Row with a label and right-side content -------------------------------------

function SettingsRow({ label, sub, right, colours, last = false }: {
  label: string;
  sub?: string;
  right: React.ReactNode;
  colours: ReturnType<typeof useTheme>['colours'];
  last?: boolean;
}) {
  return (
    <View style={[
      styles.row,
      !last && { borderBottomWidth: 1, borderBottomColor: colours.border },
    ]}>
      <View style={styles.rowLeft}>
        <Text style={[styles.rowLabel, { color: colours.text }]}>{label}</Text>
        {sub && <Text style={[styles.rowSub, { color: colours.textSub }]}>{sub}</Text>}
      </View>
      {right}
    </View>
  );
}

// Main screen -----------------------------------------------------------------

export default function SettingsScreen() {
  const { colours, isDark, toggleTheme } = useTheme();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colours.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >

      {/* Appearance --------------------------------------------------------- */}
      <Section title="APPEARANCE" colours={colours}>
        <SettingsRow
          label="Dark Mode"
          sub="Switch between dark and light theme"
          colours={colours}
          last
          right={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colours.border, true: colours.accentMuted }}
              thumbColor={isDark ? colours.accent : colours.textSub}
            />
          }
        />
      </Section>

      {/* About -------------------------------------------------------------- */}
      <Section title="ABOUT" colours={colours}>
        <SettingsRow
          label="App"
          colours={colours}
          right={<Text style={[styles.rowValue, { color: colours.textSub }]}>Foot Tracker</Text>}
        />
        <SettingsRow
          label="Team"
          colours={colours}
          right={<Text style={[styles.rowValue, { color: colours.textSub }]}>MUC Group 07</Text>}
        />
        <SettingsRow
          label="Version"
          colours={colours}
          last
          right={<Text style={[styles.rowValue, { color: colours.textSub }]}>1.0.0</Text>}
        />
      </Section>

    </ScrollView>
  );
}

// Styles ----------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flex: 1,
    marginRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
  },
});
