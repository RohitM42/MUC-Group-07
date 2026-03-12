import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useBle } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { getRollCorrectness } from '../utils/imuMath';
import { ColourPalette } from '../constants/colours';
import { RootTabParamList } from '../App';

type NavProp = BottomTabNavigationProp<RootTabParamList, 'Dashboard'>;

// Metric card -----------------------------------------------------------------

function MetricCard({ label, value, unit, accent, colours }: {
  label:   string;
  value:   string | number;
  unit?:   string;
  accent?: string;
  colours: ColourPalette;
}) {
  const s = makeStyles(colours);
  return (
    <View style={s.card}>
      <Text style={s.cardLabel}>{label}</Text>
      <View style={s.cardValueRow}>
        <Text style={[s.cardValue, accent ? { color: accent } : null]}>{value}</Text>
        {unit && <Text style={s.cardUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

// Classification badge --------------------------------------------------------

function ClassificationBadge({ label, colours }: { label: string; colours: ColourPalette }) {
  const isPlaceholder = label === '—';
  const s = makeStyles(colours);
  return (
    <View style={[s.badge, isPlaceholder && s.badgePlaceholder]}>
      <Text style={s.badgeEyebrow}>ACTIVITY</Text>
      <Text style={[s.badgeLabel, isPlaceholder && { color: colours.textDim }]}>{label}</Text>
    </View>
  );
}

// Main screen -----------------------------------------------------------------

export default function DashboardScreen() {
  const navigation      = useNavigation<NavProp>();
  const { colours }     = useTheme();
  const s               = makeStyles(colours);
  const { isConnected, connectionStatus, stepCount, pace, derived } = useBle();

  const roll        = derived ? derived.roll.toFixed(1) : '—';
  const correctness = derived ? getRollCorrectness(derived.roll) : null;
  const paceDisplay = pace > 0 ? pace.toFixed(0) : '—';
  const stepDisplay = stepCount > 0 ? stepCount : '—';

  const correctnessColor =
    correctness === 'correct'   ? colours.accent   :
    correctness === 'warn'      ? colours.warning  :
    correctness === 'incorrect' ? colours.error    : colours.textSub;

  const correctnessLabel =
    correctness === 'correct'   ? 'Correct'         :
    correctness === 'warn'      ? 'Slight Deviation' :
    correctness === 'incorrect' ? 'Fix Foot Angle'   : '—';

  const statusColor = isConnected ? colours.accent : colours.textSub;

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

      {/* Connection status --------------------------------------------------- */}
      <View style={[s.connectionBanner, { borderLeftColor: statusColor }]}>
        <View>
          <Text style={s.eyebrow}>Sensor</Text>
          <Text style={[s.connectionStatus, { color: statusColor }]}>{connectionStatus}</Text>
        </View>
        {!isConnected ? (
          <TouchableOpacity style={s.connectButton} onPress={() => navigation.navigate('Connect')} activeOpacity={0.8}>
            <Text style={s.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <View style={[s.connectedDot, { backgroundColor: colours.accent }]} />
        )}
      </View>

      {/* Classification badge ------------------------------------------------ */}
      <ClassificationBadge label="—" colours={colours} />

      {/* Orientation correctness --------------------------------------------- */}
      <View style={[s.correctnessBar, { borderLeftColor: correctnessColor }]}>
        <Text style={s.eyebrow}>Foot Orientation</Text>
        <Text style={[s.correctnessLabel, { color: correctnessColor }]}>{correctnessLabel}</Text>
        {derived && <Text style={s.correctnessAngle}>Roll angle: {roll}°</Text>}
      </View>

      {/* Metrics grid -------------------------------------------------------- */}
      <Text style={s.sectionTitle}>Session Stats</Text>
      <View style={s.grid}>
        <MetricCard label="Steps"         value={stepDisplay}                                       colours={colours} />
        <MetricCard label="Pace"          value={paceDisplay}  unit="spm"                           colours={colours} />
        <MetricCard label="Roll Angle"    value={roll}         unit="°"   accent={derived ? correctnessColor : undefined} colours={colours} />
        <MetricCard label="Angular Speed" value={derived ? derived.angularSpeed.toFixed(1) : '—'} unit="°/s" colours={colours} />
      </View>

      {/* No connection nudge ------------------------------------------------- */}
      {!isConnected && (
        <TouchableOpacity style={s.nudge} onPress={() => navigation.navigate('Connect')} activeOpacity={0.8}>
          <Text style={s.nudgeText}>⊙  Scan for Nano33BLE_IMU to start tracking</Text>
        </TouchableOpacity>
      )}

    </ScrollView>
  );
}

// Styles ----------------------------------------------------------------------

function makeStyles(c: ColourPalette) {
  return StyleSheet.create({
    scroll:     { flex: 1, backgroundColor: c.background },
    container:  { padding: 16, gap: 14 },

    connectionBanner: {
      backgroundColor: c.surface,
      borderLeftWidth: 4,
      borderRadius: 10,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    eyebrow: {
      color: c.textSub,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    connectionStatus: { fontSize: 15, fontWeight: '600' },
    connectButton: {
      backgroundColor: c.accent,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    connectButtonText: { color: '#111', fontWeight: '700', fontSize: 14 },
    connectedDot: { width: 10, height: 10, borderRadius: 5 },

    badge: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: c.accent,
      alignItems: 'center',
    },
    badgePlaceholder: { borderColor: c.border },
    badgeEyebrow: {
      color: c.textSub,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1,
      marginBottom: 4,
    },
    badgeLabel: { color: c.accent, fontSize: 22, fontWeight: '700' },

    correctnessBar: {
      backgroundColor: c.surface,
      borderLeftWidth: 4,
      borderRadius: 10,
      padding: 14,
      gap: 2,
    },
    correctnessLabel: { fontSize: 18, fontWeight: '700' },
    correctnessAngle: { color: c.textSub, fontSize: 12, marginTop: 2 },

    sectionTitle: {
      color: c.textSub,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      width: '47.5%',
      borderWidth: 1,
      borderColor: c.border,
    },
    cardLabel: {
      color: c.textSub,
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    cardValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
    cardValue:    { color: c.text, fontSize: 26, fontWeight: '700' },
    cardUnit:     { color: c.textSub, fontSize: 13 },

    nudge: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.border,
      borderStyle: 'dashed',
    },
    nudgeText: { color: c.textSub, fontSize: 13 },
  });
}
