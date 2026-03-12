import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useBle, BleDevice } from '../context/BleContext';
import { useTheme } from '../context/ThemeContext';
import { ColourPalette } from '../constants/colours';

// Device list item ------------------------------------------------------------

function DeviceItem({
  device,
  isConnected,
  isConnecting,
  onPress,
  colours,
}: {
  device:      BleDevice;
  isConnected: boolean;
  isConnecting: boolean;
  onPress:     () => void;
  colours:     ColourPalette;
}) {
  const s = makeStyles(colours);
  const rssiLabel = device.rssi ? `${device.rssi} dBm` : '—';
  const rssiColor =
    !device.rssi      ? colours.textSub :
    device.rssi > -60 ? colours.accent  :
    device.rssi > -80 ? colours.warning : colours.error;

  return (
    <TouchableOpacity
      style={[s.deviceRow, isConnected && s.deviceRowConnected]}
      onPress={onPress}
      disabled={isConnecting}
      activeOpacity={0.7}
    >
      <View style={s.deviceInfo}>
        <Text style={s.deviceName}>{device.name}</Text>
        <Text style={s.deviceId}>{device.id}</Text>
      </View>
      <View style={s.deviceRight}>
        <Text style={[s.rssi, { color: rssiColor }]}>{rssiLabel}</Text>
        {isConnected ? (
          <Text style={s.connectedBadge}>Connected</Text>
        ) : isConnecting ? (
          <ActivityIndicator size="small" color={colours.accent} />
        ) : (
          <Text style={s.connectHint}>Tap to connect</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Main screen -----------------------------------------------------------------

export default function ConnectScreen() {
  const { colours }   = useTheme();
  const s             = makeStyles(colours);
  const {
    isScanning, devices, connectedDeviceId, connectionStatus,
    isConnected, startScan, connect, disconnect,
  } = useBle();

  const [connectingId, setConnectingId] = React.useState<string | null>(null);

  async function handleConnect(deviceId: string) {
    setConnectingId(deviceId);
    await connect(deviceId);
    setConnectingId(null);
  }

  const statusColor =
    isConnected                            ? colours.accent :
    connectionStatus.startsWith('Failed')  ? colours.error  : colours.textSub;

  return (
    <View style={s.container}>

      {/* Status banner ------------------------------------------------------- */}
      <View style={[s.statusBanner, { borderLeftColor: statusColor }]}>
        <Text style={[s.statusText, { color: statusColor }]}>{connectionStatus}</Text>
      </View>

      {/* Scan button --------------------------------------------------------- */}
      <TouchableOpacity
        style={[s.scanButton, (isScanning || isConnected) && s.scanButtonDisabled]}
        onPress={startScan}
        disabled={isScanning || isConnected}
        activeOpacity={0.8}
      >
        {isScanning ? (
          <View style={s.scanningRow}>
            <ActivityIndicator size="small" color="#111" style={{ marginRight: 8 }} />
            <Text style={s.scanButtonText}>Scanning...</Text>
          </View>
        ) : (
          <Text style={s.scanButtonText}>
            {isConnected ? 'Already Connected' : 'Scan for Devices'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Disconnect button --------------------------------------------------- */}
      {isConnected && (
        <TouchableOpacity style={s.disconnectButton} onPress={disconnect} activeOpacity={0.8}>
          <Text style={s.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      )}

      {/* Device list / empty state ------------------------------------------ */}
      {devices.length === 0 && !isScanning ? (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>⊙</Text>
          <Text style={s.emptyText}>No devices found</Text>
          <Text style={s.emptyHint}>Press Scan to search for nearby BLE devices</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={d => d.id}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <DeviceItem
              device={item}
              isConnected={item.id === connectedDeviceId}
              isConnecting={item.id === connectingId}
              colours={colours}
              onPress={() =>
                item.id === connectedDeviceId ? disconnect() : handleConnect(item.id)
              }
            />
          )}
        />
      )}
    </View>
  );
}

// Styles ----------------------------------------------------------------------

function makeStyles(c: ColourPalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background, padding: 16 },

    statusBanner: {
      backgroundColor: c.surface,
      borderLeftWidth: 4,
      borderRadius: 8,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    statusText: { fontSize: 14, fontWeight: '500' },

    scanButton: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 10,
    },
    scanButtonDisabled: { backgroundColor: c.accentMuted },
    scanButtonText:     { color: '#111', fontWeight: '700', fontSize: 16 },
    scanningRow:        { flexDirection: 'row', alignItems: 'center' },

    disconnectButton: {
      borderWidth: 1,
      borderColor: c.error,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
      marginBottom: 10,
    },
    disconnectText: { color: c.error, fontWeight: '600', fontSize: 15 },

    listContent: { paddingTop: 8 },
    deviceRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 14,
      marginBottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: c.border,
    },
    deviceRowConnected: { borderColor: c.accent },
    deviceInfo:         { flex: 1, marginRight: 12 },
    deviceName:         { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
    deviceId:           { color: c.textSub, fontSize: 11, fontFamily: 'monospace' },
    deviceRight:        { alignItems: 'flex-end', gap: 4 },
    rssi:               { fontSize: 12, fontWeight: '500' },
    connectedBadge:     { color: c.accent, fontSize: 12, fontWeight: '600' },
    connectHint:        { color: c.textSub, fontSize: 11 },

    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyIcon:  { fontSize: 48, color: c.border, marginBottom: 8 },
    emptyText:  { color: c.textSub, fontSize: 16, fontWeight: '500' },
    emptyHint:  { color: c.textDim, fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  });
}
