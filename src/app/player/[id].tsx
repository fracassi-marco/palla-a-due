import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCases } from '../../di/container';
import { GameLogEntry, LeagueRanks, PlayerProfile, RankedStat } from '../../domain/entities';
import { resolveImageSource } from '../../infrastructure/images';
import { SectionTitle } from '../../presentation/components/SectionTitle';
import { Empty, ErrorView, Loading } from '../../presentation/components/StateViews';
import { StatTile } from '../../presentation/components/StatTile';
import { TeamLogo } from '../../presentation/components/TeamLogo';
import { useAsync } from '../../presentation/hooks/useAsync';
import { useStatsVersion } from '../../presentation/hooks/useSync';
import { colors, fonts, radius } from '../../presentation/theme';
import { ageFrom, formatDayMonth, one, percent } from '../../presentation/theme/format';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const statsVersion = useStatsVersion();
  const profile = useAsync(() => useCases.getPlayerProfile.execute(Number(id)), [id, statsVersion]);

  if (profile.loading) return <Loading label="Carico le statistiche…" />;
  if (profile.error || !profile.data) return <ErrorView onRetry={profile.reload} />;
  return <Profile profile={profile.data} />;
}

function Profile({ profile }: { profile: PlayerProfile }) {
  const { player, averages: a, highs, totals, ranks, gameLog } = profile;
  const router = useRouter();
  const rank = (stat: RankedStat) => ({
    hint: hint(ranks, stat),
    onPress: ranks[stat]
      ? () => router.push({ pathname: '/ranking/[stat]', params: { stat, player: String(player.id) } })
      : undefined,
  });
  const age = ageFrom(player.birthDate);
  const season = `${profile.seasonYear}/${String(profile.seasonYear + 1).slice(2)}`;

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <LinearGradient colors={[colors.orange, colors.orangeDeep]} style={styles.hero}>
        <Text style={styles.heroNumber}>{player.number}</Text>
        <View style={styles.heroText}>
          <Text style={styles.first}>{player.firstName}</Text>
          <Text style={styles.last}>{player.lastName.toUpperCase()}</Text>
          <Text style={styles.team}>{player.teamName}</Text>
          {player.role ? <Text style={styles.role}>{player.role.toUpperCase()}</Text> : null}
        </View>
        <View style={styles.photoWrap}>
          {player.photoUrl ? (
            <Image source={resolveImageSource(player.photoUrl)} style={styles.photo} contentFit="cover" contentPosition="top" />
          ) : (
            <Ionicons name="person" size={64} color={colors.surfaceAlt} />
          )}
        </View>
      </LinearGradient>

      <View style={styles.bio}>
        {player.heightCm ? <Bio icon="resize" text={`${player.heightCm} cm`} /> : null}
        {player.weightKg ? <Bio icon="barbell" text={`${player.weightKg} kg`} /> : null}
        {age !== null ? <Bio icon="calendar" text={`${age} anni`} /> : null}
        {player.country ? <Bio icon="flag" text={player.country} /> : null}
      </View>

      <SectionTitle title="MEDIE" accent={colors.yellow} right={`STAGIONE ${season}`} />
      {a ? (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <View style={styles.tiles}>
            <StatTile big label="PUNTI" value={one(a.points)} {...rank('points')} accent={colors.orange} />
            <StatTile big label="RIMBALZI" value={one(a.totalRebounds)} {...rank('totalRebounds')} accent={colors.cyan} />
            <StatTile big label="ASSIST" value={one(a.assists)} {...rank('assists')} accent={colors.pink} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="VAL" value={one(a.rating)} {...rank('rating')} accent={colors.yellow} />
            <StatTile label="MIN" value={one(a.minutes)} {...rank('minutes')} accent={colors.text} />
            <StatTile label="PARTITE" value={String(totals?.matches ?? a.matches)} accent={colors.text} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="2P%" value={percent(a.twoMade, a.twoAttempted)} {...rank('twoPercent')} accent={colors.green} />
            <StatTile label="3P%" value={percent(a.threeMade, a.threeAttempted)} {...rank('threePercent')} accent={colors.green} />
            <StatTile label="TL%" value={percent(a.freeThrowsMade, a.freeThrowsAttempted)} {...rank('freeThrowPercent')} accent={colors.green} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="RUBATE" value={one(a.steals)} {...rank('steals')} accent={colors.cyan} />
            <StatTile label="STOPPATE" value={one(a.blocks)} {...rank('blocks')} accent={colors.cyan} />
            <StatTile label="PERSE" value={one(a.turnovers)} {...rank('turnovers')} accent={colors.red} />
          </View>
        </View>
      ) : (
        <Empty text="Nessuna statistica per questa stagione." />
      )}

      {highs ? (
        <>
          <SectionTitle title="CAREER NIGHT" accent={colors.pink} right="MASSIMI STAGIONE" />
          <View style={[styles.tiles, { paddingHorizontal: 16 }]}>
            <StatTile label="PUNTI" value={String(highs.points)} accent={colors.orange} />
            <StatTile label="RIMB" value={String(highs.totalRebounds)} accent={colors.cyan} />
            <StatTile label="AST" value={String(highs.assists)} accent={colors.pink} />
            <StatTile label="VAL" value={String(highs.rating)} accent={colors.yellow} />
          </View>
        </>
      ) : null}

      <SectionTitle title="ULTIME PARTITE" accent={colors.cyan} />
      {gameLog.length > 0 ? gameLog.map((g) => <GameRow key={g.matchId} game={g} />) : <Empty text="Ancora nessuna partita giocata." />}
    </ScrollView>
  );
}

function hint(ranks: LeagueRanks, stat: RankedStat): string | undefined {
  const r = ranks[stat];
  return r ? `${r.position}° / ${r.of}` : undefined;
}

function Bio({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.bioChip}>
      <Ionicons name={icon} size={14} color={colors.orange} />
      <Text style={styles.bioText}>{text}</Text>
    </View>
  );
}

function GameRow({ game }: { game: GameLogEntry }) {
  const l = game.line;
  return (
    <View style={styles.game}>
      <View style={[styles.result, { backgroundColor: game.won ? colors.green : colors.red }]}>
        <Text style={styles.resultText}>{game.won ? 'V' : 'S'}</Text>
      </View>
      <TeamLogo uri={game.opponentLogoUrl} name={game.opponentName} size={32} />
      <View style={{ flex: 1 }}>
        <Text style={styles.gameOpp} numberOfLines={1}>{game.isHome ? 'vs' : '@'} {game.opponentName}</Text>
        <Text style={styles.gameMeta}>{formatDayMonth(game.date)} · {game.teamScore}-{game.opponentScore}</Text>
      </View>
      <View style={styles.gameStats}>
        <GameStat v={l.points} k="PT" color={colors.orange} />
        <GameStat v={l.totalRebounds} k="RB" color={colors.cyan} />
        <GameStat v={l.assists} k="AS" color={colors.pink} />
      </View>
    </View>
  );
}

function GameStat({ v, k, color }: { v: number; k: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', minWidth: 30 }}>
      <Text style={[styles.gsValue, { color }]}>{v}</Text>
      <Text style={styles.gsKey}>{k}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginHorizontal: 16, marginTop: 8, borderRadius: 28, padding: 20, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', minHeight: 170 },
  heroNumber: { position: 'absolute', left: 8, top: -18, fontFamily: fonts.display, fontSize: 150, color: 'rgba(11,16,32,0.18)' },
  heroText: { flex: 1, zIndex: 1 },
  first: { color: colors.bg, fontFamily: fonts.bodyBold, fontSize: 15 },
  last: { color: colors.text, fontFamily: fonts.display, fontSize: 38, lineHeight: 40, letterSpacing: 1 },
  team: { color: colors.bg, fontFamily: fonts.bodyBold, fontSize: 13, marginTop: 4 },
  role: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: colors.bg, color: colors.yellow, fontFamily: fonts.condensed, fontSize: 12, letterSpacing: 1.5, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, overflow: 'hidden' },
  photoWrap: { width: 110, height: 110, borderRadius: 55, backgroundColor: colors.bg, borderWidth: 3, borderColor: colors.yellow, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photo: { width: '100%', height: '100%' },
  bio: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 14 },
  bioChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5, borderColor: colors.border },
  bioText: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 13 },
  tiles: { flexDirection: 'row', gap: 10 },
  game: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 10, marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: colors.border },
  result: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resultText: { color: colors.bg, fontFamily: fonts.display, fontSize: 16 },
  gameOpp: { color: colors.text, fontFamily: fonts.bodyBold, fontSize: 14 },
  gameMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  gameStats: { flexDirection: 'row', gap: 8 },
  gsValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24 },
  gsKey: { color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 10, letterSpacing: 1 },
});
