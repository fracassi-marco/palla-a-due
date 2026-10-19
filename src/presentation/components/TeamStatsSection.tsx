import { StyleSheet, Text, View } from 'react-native';
import { RankedValue, TeamResult, TeamStats } from '../../domain/entities';
import { colors, fonts, radius } from '../theme';
import { formatDayMonth, one } from '../theme/format';
import { SectionTitle } from './SectionTitle';
import { StatTile } from './StatTile';

const rankHint = (r: RankedValue) => (r.position ? `${r.position}° IN LEGA` : undefined);
const record = (r: { wins: number; losses: number }) => `${r.wins}-${r.losses}`;
const pct = (v: number | null) => (v === null ? '–' : `${Math.round(v)}%`);
const signed = (v: number) => `${v > 0 ? '+' : ''}${one(v)}`;

export function TeamStatsSection({ stats: s }: { stats: TeamStats }) {
  const season = `${s.seasonYear}/${String(s.seasonYear + 1).slice(2)}`;
  return (
    <View>
      <SectionTitle title="STATISTICHE" accent={colors.yellow} right={`STAGIONE ${season}`} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label="POSIZIONE" value={s.position ? `${s.position}°` : '–'} accent={colors.yellow} />
          <StatTile big label="VINTE" value={String(s.wins)} accent={colors.green} />
          <StatTile big label="PERSE" value={String(s.losses)} accent={colors.red} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="IN CASA" value={record(s.home)} hint="V-P" accent={colors.orange} />
          <StatTile label="IN TRASFERTA" value={record(s.away)} hint="V-P" accent={colors.cyan} />
          <StatTile
            label="STRISCIA"
            value={s.streak ? `${s.streak.length}${s.streak.won ? 'V' : 'S'}` : '–'}
            hint={s.streak ? (s.streak.won ? 'POSITIVA' : 'NEGATIVA') : undefined}
            accent={s.streak?.won === false ? colors.red : colors.green}
          />
        </View>
        {s.form.length > 0 ? <Form results={s.form} /> : null}
      </View>

      <SectionTitle title="ATTACCO E DIFESA" accent={colors.orange} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label="PUNTI FATTI" value={one(s.avgPointsFor.value)} hint={rankHint(s.avgPointsFor)} accent={colors.orange} />
          <StatTile big label="PUNTI SUBITI" value={one(s.avgPointsAgainst.value)} hint={rankHint(s.avgPointsAgainst)} accent={colors.cyan} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="DIFF. MEDIA" value={signed(s.avgMargin)} accent={s.avgMargin >= 0 ? colors.green : colors.red} />
          <StatTile label="VALUTAZIONE" value={one(s.rating)} accent={colors.yellow} />
        </View>
      </View>

      <SectionTitle title="MEDIE A PARTITA" accent={colors.cyan} />
      <View style={styles.block}>
        <View style={styles.tiles}>
          <StatTile big label="RIMBALZI" value={one(s.totalRebounds.value)} hint={rankHint(s.totalRebounds)} accent={colors.cyan} />
          <StatTile big label="ASSIST" value={one(s.assists.value)} hint={rankHint(s.assists)} accent={colors.pink} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="RIMB. OFF" value={one(s.offensiveRebounds)} accent={colors.cyan} />
          <StatTile label="RIMB. DIF" value={one(s.defensiveRebounds)} accent={colors.cyan} />
          <StatTile label="FALLI" value={one(s.fouls)} accent={colors.textMuted} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="RUBATE" value={one(s.steals)} accent={colors.cyan} />
          <StatTile label="STOPPATE" value={one(s.blocks)} accent={colors.cyan} />
          <StatTile label="PERSE" value={one(s.turnovers)} accent={colors.red} />
        </View>
        <View style={styles.tiles}>
          <StatTile label="2P%" value={pct(s.twoPercent)} accent={colors.green} />
          <StatTile label="3P%" value={pct(s.threePercent)} accent={colors.green} />
          <StatTile label="TL%" value={pct(s.freeThrowPercent)} accent={colors.green} />
        </View>
      </View>

      <SectionTitle title="RECORD STAGIONE" accent={colors.pink} />
      <View style={styles.records}>
        <RecordRow label="MAGGIOR VITTORIA" result={s.biggestWin} />
        <RecordRow label="MAGGIOR SCONFITTA" result={s.biggestLoss} />
        <RecordRow label="PUNTEGGIO PIÙ ALTO" result={s.highestScore} />
      </View>
    </View>
  );
}

function Form({ results }: { results: TeamResult[] }) {
  return (
    <View style={styles.form}>
      <Text style={styles.formLabel}>ULTIME {results.length}</Text>
      {results.map((r) => (
        <View key={r.matchId} style={[styles.chip, { backgroundColor: r.won ? colors.green : colors.red }]}>
          <Text style={styles.chipText}>{r.won ? 'V' : 'S'}</Text>
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
          {result.isHome ? 'vs' : '@'} {result.opponentName} · {formatDayMonth(result.date)}
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
