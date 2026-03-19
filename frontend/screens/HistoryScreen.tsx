import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { ColourPalette } from '../constants/colours';
import { MOCK_SESSIONS, USE_MOCK_DATA, SessionRecord } from '../utils/mockSessions';

// Helpers ---------------------------------------------------------------------

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function correctnessColor(pct: number, c: ColourPalette): string {
  if (pct >= 80) return c.accent;
  if (pct >= 60) return c.warning;
  return c.error;
}

// Summary bar at the top ------------------------------------------------------

function SummaryBar({ sessions, colours }: { sessions: SessionRecord[]; colours: ColourPalette }) {
  const s = makeStyles(colours);
  if (sessions.length === 0) return null;

  const totalSteps  = sessions.reduce((sum, r) => sum + r.steps, 0);
  const avgCorrect  = Math.round(sessions.reduce((sum, r) => sum + r.percentCorrect, 0) / sessions.length);
  const totalSessions = sessions.length;

  return (
    <View style={s.summaryRow}>
      <View style={s.summaryCard}>
        <Text style={s.summaryValue}>{totalSessions}</Text>
        <Text style={s.summaryLabel}>Sessions</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={s.summaryValue}>{totalSteps.toLocaleString()}</Text>
        <Text style={s.summaryLabel}>Total Steps</Text>
      </View>
      <View style={s.summaryCard}>
        <Text style={[s.summaryValue, { color: correctnessColor(avgCorrect, colours) }]}>
          {avgCorrect}%
        </Text>
        <Text style={s.summaryLabel}>Avg Correct</Text>
      </View>
    </View>
  );
}

// Correctness bar inside session card -----------------------------------------

function CorrectnessBar({ pct, colours }: { pct: number; colours: ColourPalette }) {
  const colour = correctnessColor(pct, colours);
  return (
    <View style={{ marginTop: 10 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ color: colours.textSub, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Foot Correctness
        </Text>
        <Text style={{ color: colour, fontSize: 11, fontWeight: '700' }}>{pct}%</Text>
      </View>
      <View style={{ height: 5, backgroundColor: colours.border, borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ height: 5, width: `${pct}%`, backgroundColor: colour, borderRadius: 3 }} />
      </View>
    </View>
  );
}

// Session card ----------------------------------------------------------------

function SessionCard({ session, colours }: { session: SessionRecord; colours: ColourPalette }) {
  const [expanded, setExpanded] = useState(false);
  const s = makeStyles(colours);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={s.cardHeader}>
        <View>
          <Text style={s.cardDate}>{formatDate(session.date)}</Text>
          <Text style={s.cardTime}>{formatTime(session.date)}  ·  {formatDuration(session.durationSecs)}</Text>
        </View>
        <Text style={s.cardChevron}>{expanded ? '▲' : '▼'}</Text>
      </View>

      {/* Always-visible quick stats */}
      <View style={s.quickRow}>
        <View style={s.quickStat}>
          <Text style={s.quickValue}>{session.steps}</Text>
          <Text style={s.quickLabel}>Steps</Text>
        </View>
        <View style={s.quickStat}>
          <Text style={s.quickValue}>{session.avgPace}</Text>
          <Text style={s.quickLabel}>Avg Pace (spm)</Text>
        </View>
        <View style={s.quickStat}>
          <Text style={[s.quickValue, { color: correctnessColor(session.percentCorrect, colours) }]}>
            {session.percentCorrect}%
          </Text>
          <Text style={s.quickLabel}>Correct</Text>
        </View>
      </View>

      {/* Expanded detail */}
      {expanded && (
        <View style={s.expandedSection}>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Walking time</Text>
            <Text style={s.detailValue}>{session.walkingPct}% of session</Text>
          </View>
          <View style={s.detailRow}>
            <Text style={s.detailLabel}>Duration</Text>
            <Text style={s.detailValue}>{formatDuration(session.durationSecs)}</Text>
          </View>
          <CorrectnessBar pct={session.percentCorrect} colours={colours} />
        </View>
      )}
    </TouchableOpacity>
  );
}

// Main screen -----------------------------------------------------------------

export default function HistoryScreen() {
  const { colours } = useTheme();
  const s = makeStyles(colours);

  // Swap MOCK_SESSIONS for real AsyncStorage sessions once wired up
  const sessions: SessionRecord[] = USE_MOCK_DATA ? MOCK_SESSIONS : [];

  return (
    <FlatList
      style={s.list}
      contentContainerStyle={s.container}
      data={sessions}
      keyExtractor={item => item.id}
      ListHeaderComponent={
        <>
          <View style={s.headerRow}>
            <Text style={s.title}>History</Text>
            {USE_MOCK_DATA && (
              <View style={s.mockBadge}>
                <Text style={s.mockBadgeText}>MOCK DATA</Text>
              </View>
            )}
          </View>
          <SummaryBar sessions={sessions} colours={colours} />
          <Text style={s.sectionLabel}>Sessions</Text>
        </>
      }
      ListEmptyComponent={
        <View style={s.empty}>
          <Text style={s.emptyText}>No sessions recorded yet.</Text>
          <Text style={s.emptySubText}>Connect a sensor and start walking to log your first session.</Text>
        </View>
      }
      renderItem={({ item }) => <SessionCard session={item} colours={colours} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

// Styles ----------------------------------------------------------------------

function makeStyles(c: ColourPalette) {
  return StyleSheet.create({
    list:      { flex: 1, backgroundColor: c.background },
    container: { padding: 16, gap: 0 },

    headerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'space-between',
      marginBottom:   16,
    },
    title: { color: c.text, fontSize: 22, fontWeight: '700' },

    mockBadge: {
      backgroundColor: c.warning + '33',
      borderRadius:    6,
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderWidth: 1,
      borderColor: c.warning,
    },
    mockBadgeText: { color: c.warning, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },

    summaryRow: {
      flexDirection: 'row',
      gap:           10,
      marginBottom:  20,
    },
    summaryCard: {
      flex:            1,
      backgroundColor: c.surface,
      borderRadius:    10,
      padding:         12,
      alignItems:      'center',
      borderWidth:     1,
      borderColor:     c.border,
    },
    summaryValue: { color: c.text,    fontSize: 20, fontWeight: '700' },
    summaryLabel: { color: c.textSub, fontSize: 11, marginTop: 2 },

    sectionLabel: {
      color:         c.textSub,
      fontSize:      11,
      fontWeight:    '600',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom:  10,
    },

    card: {
      backgroundColor: c.surface,
      borderRadius:    10,
      padding:         14,
      borderWidth:     1,
      borderColor:     c.border,
    },
    cardHeader: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'flex-start',
      marginBottom:   12,
    },
    cardDate:    { color: c.text,    fontSize: 15, fontWeight: '600' },
    cardTime:    { color: c.textSub, fontSize: 12, marginTop: 2 },
    cardChevron: { color: c.textDim, fontSize: 12 },

    quickRow: {
      flexDirection: 'row',
      gap:           0,
    },
    quickStat: {
      flex:      1,
      alignItems: 'center',
    },
    quickValue: { color: c.text,    fontSize: 18, fontWeight: '700' },
    quickLabel: { color: c.textSub, fontSize: 11, marginTop: 2 },

    expandedSection: {
      marginTop:  12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: c.border,
      gap: 8,
    },
    detailRow: {
      flexDirection:  'row',
      justifyContent: 'space-between',
    },
    detailLabel: { color: c.textSub, fontSize: 13 },
    detailValue: { color: c.text,    fontSize: 13, fontWeight: '600' },

    empty: {
      alignItems: 'center',
      paddingTop: 60,
      gap:        8,
    },
    emptyText:    { color: c.textSub, fontSize: 15, fontWeight: '600' },
    emptySubText: { color: c.textDim, fontSize: 13, textAlign: 'center' },
  });
}
