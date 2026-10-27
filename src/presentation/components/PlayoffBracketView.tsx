import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { PlayoffBracket, PlayoffSeries, TeamRef } from '../../domain/entities';
import { useOpenTeam } from '../hooks/useOpenTeam';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth, formatTime, formatWeekday } from '../theme/format';
import { TeamLogo } from './TeamLogo';

const CARD_HEIGHT = 112;
const CARD_GAP = 16;
const COLUMN_GAP = 14;

/** Tabellone a colonne, dal primo turno alla finale: le serie dei turni successivi stanno al centro di quelle che le alimentano. */
export function PlayoffBracketView({ bracket }: { bracket: PlayoffBracket }) {
  const { width } = useWindowDimensions();
  const columnWidth = Math.min(width * 0.78, 280);
  const slots = bracket.rounds[0].series.length;
  const height = slots * CARD_HEIGHT + (slots - 1) * CARD_GAP;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={columnWidth + COLUMN_GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.columns}
    >
      {bracket.rounds.map((round) => (
        <View key={round.name} style={{ width: columnWidth }}>
          <Text style={styles.roundName}>{round.name}</Text>
          <View style={{ height, justifyContent: 'space-around' }}>
            {round.series.map((series, i) => (series ? <SeriesCard key={series.id} series={series} /> : <PendingCard key={i} />))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function SeriesCard({ series }: { series: PlayoffSeries }) {
  return (
    <View style={[styles.card, series.live && styles.cardLive]}>
      <TeamRow team={series.top} seed={series.topSeed} wins={series.topWins} state={rowState(series, series.top.id)} />
      <View style={styles.divider} />
      <TeamRow team={series.bottom} seed={series.bottomSeed} wins={series.bottomWins} state={rowState(series, series.bottom.id)} />
      <Text style={[styles.footer, series.live && { color: colors.red }]} numberOfLines={1}>
        {footer(series)}
      </Text>
    </View>
  );
}

function PendingCard() {
  return (
    <View style={[styles.card, styles.cardPending]}>
      <Text style={styles.pendingText}>DA DEFINIRE</Text>
    </View>
  );
}

type RowState = 'winner' | 'loser' | 'open';

const rowState = (series: PlayoffSeries, teamId: number): RowState =>
  series.winnerId === null ? 'open' : series.winnerId === teamId ? 'winner' : 'loser';

function TeamRow({ team, seed, wins, state }: { team: TeamRef; seed: number | null; wins: number; state: RowState }) {
  const openTeam = useOpenTeam();
  return (
    <Pressable style={[styles.row, state === 'loser' && { opacity: 0.45 }]} onPress={() => openTeam(team.id, team.name, team.logoUrl)}>
      <TeamLogo uri={team.logoUrl} name={team.name} size={30} />
      {seed ? <Text style={styles.seed}>{seed}</Text> : null}
      <Text style={styles.teamName} numberOfLines={1}>
        {team.name}
      </Text>
      <Text style={[styles.wins, state === 'winner' && { color: colors.green }]}>{wins}</Text>
    </Pressable>
  );
}

function footer(series: PlayoffSeries): string {
  if (series.winnerId !== null) return 'SERIE CONCLUSA';
  if (series.live) return 'IN CORSO';
  const format = `AL MEGLIO DELLE ${series.bestOf}`;
  if (!series.nextGameAt) return format;
  const at = series.nextGameAt;
  return `PROSSIMA ${formatWeekday(at)} ${formatDayMonth(at)} · ${formatTime(at)}`;
}

const styles = StyleSheet.create({
  columns: { paddingHorizontal: 16, gap: COLUMN_GAP, paddingBottom: 8 },
  roundName: { color: colors.cyan, fontFamily: fonts.display, fontSize: 24, letterSpacing: 1.2, marginBottom: 12 },
  card: { height: CARD_HEIGHT, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  cardLive: { borderColor: colors.red },
  cardPending: { alignItems: 'center', borderStyle: 'dashed', backgroundColor: 'transparent' },
  pendingText: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 15, letterSpacing: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  divider: { height: 1, backgroundColor: colors.border },
  seed: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 14, minWidth: 12 },
  teamName: { flex: 1, color: colors.text, fontFamily: fonts.bodyBold, fontSize: 15 },
  wins: { color: colors.text, fontFamily: fonts.display, fontSize: 26, minWidth: 20, textAlign: 'right' },
  footer: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1, textAlign: 'center', marginTop: 4 },
});
