import { StyleSheet, Text, View } from 'react-native';
import { RankedValue, TeamResult, TeamStats } from '../../domain/entities';
import { ordinal, t } from '../../i18n';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth, one } from '../theme/format';
import { SectionTitle } from './SectionTitle';
import { StatTile } from './StatTile';

const rankHint = (r: RankedValue) => (r.position ? t('teamStats.inLeague', { pos: ordinal(r.position) }) : undefined);
const record = (r: { wins: number; losses: number }) => `${r.wins}-${r.losses}`;
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v)}%`);
const signed = (v: number) => `${v > 0 ? '+' : ''}${one(v)}`;

export function TeamStatsSection({ stats: s }: { stats: TeamStats }) {
  const season = `${s.seasonYear}/${String(s.seasonYear + 1).slice(2)}`;
  return (
    <View>
      <SectionTitle title={t('teamStats.title')} accent={colors.yellow} right={t('player.season', { season })} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label={t('teamStats.position')} value={s.position ? ordinal(s.position) : '–'} accent={colors.yellow} />
          <StatTile big label={t('teamStats.wins')} value={String(s.wins)} accent={colors.green} />
          <StatTile big label={t('teamStats.losses')} value={String(s.losses)} accent={colors.red} />
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('teamStats.home')} value={record(s.home)} hint={t('teamStats.record')} accent={colors.orange} />
          <StatTile label={t('teamStats.away')} value={record(s.away)} hint={t('teamStats.record')} accent={colors.cyan} />
          <StatTile
            label={t('teamStats.streak')}
            value={s.streak ? `${s.streak.length}${t(s.streak.won ? 'teamStats.streakWin' : 'teamStats.streakLoss')}` : '–'}
            hint={s.streak ? t(s.streak.won ? 'teamStats.streakPositive' : 'teamStats.streakNegative') : undefined}
            accent={s.streak?.won === false ? colors.red : colors.green}
          />
        </View>
        {s.form.length > 0 ? <Form results={s.form} /> : null}
      </View>

      <SectionTitle title={t('teamStats.offenseDefense')} accent={colors.orange} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label={t('teamStats.pointsFor')} value={one(s.avgPointsFor.value)} hint={rankHint(s.avgPointsFor)} accent={colors.orange} />
          <StatTile big label={t('teamStats.pointsAgainst')} value={one(s.avgPointsAgainst.value)} hint={rankHint(s.avgPointsAgainst)} accent={colors.cyan} />
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('teamStats.avgMargin')} value={signed(s.avgMargin)} accent={s.avgMargin >= 0 ? colors.green : colors.red} />
          <StatTile label={t('teamStats.rating')} value={one(s.rating)} accent={colors.yellow} />
        </View>
      </View>

      <SectionTitle title={t('teamStats.perGame')} accent={colors.cyan} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label={t('teamStats.rebounds')} value={one(s.totalRebounds.value)} hint={rankHint(s.totalRebounds)} accent={colors.cyan} />
          <StatTile big label={t('teamStats.assists')} value={one(s.assists.value)} hint={rankHint(s.assists)} accent={colors.pink} />
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('teamStats.offensiveRebounds')} value={one(s.offensiveRebounds)} accent={colors.cyan} />
          <StatTile label={t('teamStats.defensiveRebounds')} value={one(s.defensiveRebounds)} accent={colors.cyan} />
          <StatTile label={t('teamStats.fouls')} value={one(s.fouls)} accent={colors.textMuted} />
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('teamStats.steals')} value={one(s.steals)} accent={colors.cyan} />
          <StatTile label={t('teamStats.blocks')} value={one(s.blocks)} accent={colors.cyan} />
          <StatTile label={t('teamStats.turnovers')} value={one(s.turnovers)} accent={colors.red} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="2P%" value={pct(s.twoPercent)} accent={colors.green} />
          <StatTile label="3P%" value={pct(s.threePercent)} accent={colors.green} />
          <StatTile label={t('teamStats.freeThrowPercent')} value={pct(s.freeThrowPercent)} accent={colors.green} />
        </View>
      </View>

      <SectionTitle title={t('teamStats.records')} accent={colors.pink} />
      <View style={styles.records}>
        <RecordRow label={t('teamStats.biggestWin')} result={s.biggestWin} />
        <RecordRow label={t('teamStats.biggestLoss')} result={s.biggestLoss} />
        <RecordRow label={t('teamStats.highestScore')} result={s.highestScore} />
      </View>
    </View>
  );
}

function Form({ results }: { results: TeamResult[] }) {
  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>{t('teamStats.form', { n: results.length })}</Text>
      {results.map((r) => (
        <View key={r.matchId} style={[styles.chip, { backgroundColor: r.won ? colors.green : colors.red }]}>
          <Text style={styles.chipText}>{t(r.won ? 'teamStats.streakWin' : 'teamStats.streakLoss')}</Text>
        </View>
      ))}
    </View>
  );
}

function RecordRow({ label, result }: { label: string; result: TeamResult | null }) {
  if (!result) return null;
  return (
    <View style={styles.record}>
      <View style={{ flex: 1 }}>
        <Text style={styles.recordLabel}>{label}</Text>
        <Text style={styles.recordOpp}>
          {result.isHome ? t('player.versus') : t('player.at')} {result.opponentName} · {formatDayMonth(result.date)}
        </Text>
      </View>
      <Text style={styles.recordScore}>
        {result.teamScore}-{result.opponentScore}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: 16, gap: 10 },
  tiles: { flexDirection: 'row', gap: 10 },
  form: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  formLabel: { flex: 1, color: colors.textMuted, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.2 },
  chip: { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: colors.bg, fontFamily: fonts.display, fontSize: 18 },
  records: { paddingHorizontal: 16, gap: 8 },
  record: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14 },
  recordLabel: { color: colors.pink, fontFamily: fonts.condensed, fontSize: 13, letterSpacing: 1.2 },
  recordOpp: { color: colors.text, fontFamily: fonts.body, fontSize: 14, marginTop: 2 },
  recordScore: { color: colors.text, fontFamily: fonts.display, fontSize: 28 },
});
