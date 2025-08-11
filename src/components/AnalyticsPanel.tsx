import { useEffect, useMemo, useState } from "react";
import { Alarm, TimeRange, activationCountForRange, formatDuration, totalActiveMsForRange } from "@/store/alarms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchAnalyticsFromDb, subscribeRealtime } from "@/services/supabaseAlarms";
import { RangePicker } from "@/components/RangePicker";

interface Props {
  alarms: Alarm[];
  range: TimeRange;
  onChangeRange?: (r: TimeRange) => void;
  filterInactive?: boolean; // external control; also auto-enables when a preset is used inside
}

export function AnalyticsPanel({ alarms, range, onChangeRange, filterInactive = false }: Props) {
  const [csvUrl, setCsvUrl] = useState<string | null>(null);
  const supaEnabled = isSupabaseConfigured();
  const [rows, setRows] = useState<Array<{ id: string; totalMs: number; total: string; activations: number }>>([]);
  const [tick, setTick] = useState(0);
  const [preset, setPreset] = useState<"lastHour" | "last24h" | "custom" | null>(null);

  const isLiveRange = useMemo(() => {
    const endDiffMs = Date.now() - range.end.getTime();
    const nearNow = endDiffMs >= -500 && endDiffMs <= 5 * 60 * 1000; // within last 5 minutes
    const anyActive = alarms.some(a => a.status === 1);
    return (preset === 'lastHour' || preset === 'last24h') ? true : (nearNow || anyActive);
  }, [range.end, alarms, preset]);

  useEffect(() => {
    if (!isLiveRange) return;
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, [isLiveRange]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const effectiveRange = isLiveRange ? { start: range.start, end: new Date() } : range;
      if (supaEnabled) {
        try {
          const data = await fetchAnalyticsFromDb(effectiveRange);
          if (!cancelled) setRows(data.map(r => ({ ...r, total: formatDuration(r.totalMs) })));
        } catch {
          if (!cancelled) setRows([]);
        }
      } else {
        const computed = alarms.map((a) => {
          const total = totalActiveMsForRange(a, effectiveRange);
          const count = activationCountForRange(a, effectiveRange);
          return { id: a.id, totalMs: total, total: formatDuration(total), activations: count };
        });
        if (!cancelled) setRows(computed);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [alarms, range, supaEnabled, tick, isLiveRange]);

  // Also refresh immediately on any DB change via realtime (Supabase mode)
  useEffect(() => {
    if (!supaEnabled) return;
    let cancelled = false;
    const unsub = subscribeRealtime(async () => {
      if (cancelled) return;
      const effectiveRange = isLiveRange ? { start: range.start, end: new Date() } : range;
      try {
        const data = await fetchAnalyticsFromDb(effectiveRange);
        if (!cancelled) setRows(data.map(r => ({ ...r, total: formatDuration(r.totalMs) })));
      } catch {
        /* noop */
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [supaEnabled, range, isLiveRange]);

  useEffect(() => {
    if (csvUrl) URL.revokeObjectURL(csvUrl);
    const header = ["Alarm ID", "Total Active (hh:mm:ss)", "Activations"].join(",");
    const dataRows = filterInactive ? rows.filter(r => r.totalMs > 0 || r.activations > 0) : rows;
    const lines = dataRows.map(r => [r.id, r.total, r.activations].join(","));
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    setCsvUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [rows, filterInactive]);

  const applyFilter = filterInactive || preset !== null;
  const displayedRows = useMemo(() => (applyFilter ? rows.filter(r => r.totalMs > 0 || r.activations > 0) : rows), [rows, applyFilter]);
  const totalAll = useMemo(() => displayedRows.reduce((s, r) => s + r.totalMs, 0), [displayedRows]);
  const totalActivations = useMemo(() => displayedRows.reduce((s, r) => s + r.activations, 0), [displayedRows]);
  const activeAlarms = useMemo(() => alarms.filter(a => a.status === 1).length, [alarms]);
  const alarmsCount = useMemo(() => displayedRows.length, [displayedRows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Historical Analysis</CardTitle>
          {csvUrl && <a href={csvUrl} download={`alarm-analytics.csv`}>
            <Button variant="secondary">Export CSV</Button>
          </a>}
        </div>
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div>
              <div className="text-sm text-muted-foreground">Time Range</div>
              <RangePicker range={range} onChange={(r) => onChangeRange?.(r)} onPresetChange={(p) => setPreset(p)} activePreset={preset} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="border rounded-md p-4">
              <div className="text-sm text-muted-foreground">Number of Alarms</div>
              <div className="text-2xl font-semibold">{alarmsCount}</div>
            </div>
            <div className="border rounded-md p-4">
              <div className="text-sm text-muted-foreground">Total Activations</div>
              <div className="text-2xl font-semibold">{totalActivations}</div>
            </div>
            <div className="border rounded-md p-4">
              <div className="text-sm text-muted-foreground">Active Alarms</div>
              <div className="text-2xl font-semibold">{activeAlarms}</div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alarm ID</TableHead>
                <TableHead>Total Active Duration</TableHead>
                <TableHead>Number of Activations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedRows.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.total}</TableCell>
                  <TableCell>{r.activations}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="font-semibold">{formatDuration(totalAll)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
