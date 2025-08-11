import { useEffect, useMemo, useState } from "react";
import { Alarm, TimeRange, activationCountForRange, formatDuration, totalActiveMsForRange } from "@/store/alarms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchAnalyticsFromDb, subscribeRealtime } from "@/services/supabaseAlarms";
import { RangePicker } from "@/components/RangePicker";
import { cn } from "@/lib/utils";

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
    <div className="space-y-8">
      <Card className="professional-card shadow-lg">
        <CardHeader className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">📊</span>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">Historical Analysis</CardTitle>
            </div>
            {csvUrl && <a href={csvUrl} download={`alarm-analytics.csv`}>
              <Button className="btn-green shadow-lg">
                📥 Export CSV
              </Button>
            </a>}
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="text-sm text-gray-600 uppercase tracking-wide mb-3 font-semibold">Time Range Selection</div>
            <RangePicker range={range} onChange={(r) => onChangeRange?.(r)} onPresetChange={(p) => setPreset(p)} activePreset={preset} />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border border-blue-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">🔢</span>
                </div>
                <div className="text-sm text-blue-700 uppercase tracking-wide font-semibold">Alarms Shown</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{alarmsCount}</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border border-purple-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">⚡</span>
                </div>
                <div className="text-sm text-purple-700 uppercase tracking-wide font-semibold">Total Activations</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{totalActivations}</div>
            </div>
            
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-6 border border-red-200 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white text-lg">🚨</span>
                </div>
                <div className="text-sm text-red-700 uppercase tracking-wide font-semibold">Currently Active</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">{activeAlarms}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="professional-card shadow-lg">
        <CardHeader className="border-b border-gray-200">
          <CardTitle className="text-xl font-bold text-gray-900">Detailed Analytics</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-200 bg-gray-50">
                  <TableHead className="text-gray-700 font-semibold py-4 px-6">Alarm ID</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4 px-6">Total Active Duration</TableHead>
                  <TableHead className="text-gray-700 font-semibold py-4 px-6">Number of Activations</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.map(r => {
                  const alarm = alarms.find(a => a.id === r.id);
                  const isActive = alarm?.status === 1;
                  return (
                    <TableRow 
                      key={r.id} 
                      className={cn(
                        "border-gray-200 hover:bg-gray-50 transition-colors",
                        isActive && "bg-red-50 border-red-200 hover:bg-red-100"
                      )}
                    >
                      <TableCell className={cn(
                        "font-bold py-4 px-6",
                        isActive ? "text-red-700" : "text-gray-900"
                      )}>
                        {isActive && <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2 animate-pulse"></span>}
                        {r.id}
                      </TableCell>
                      <TableCell className="font-mono text-blue-600 py-4 px-6 font-semibold">{r.total}</TableCell>
                      <TableCell className="text-purple-600 py-4 px-6 font-semibold">{r.activations}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="border-gray-300 bg-gray-100">
                  <TableCell className="font-bold text-gray-900 py-4 px-6 text-lg">TOTAL</TableCell>
                  <TableCell className="font-bold text-green-600 py-4 px-6 text-lg font-mono">{formatDuration(totalAll)}</TableCell>
                  <TableCell className="py-4 px-6"></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
