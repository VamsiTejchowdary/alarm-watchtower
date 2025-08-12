import { useEffect, useMemo, useState } from "react";
import { Alarm, TimeRange, activationCountForRange, formatDuration, totalActiveMsForRange } from "@/store/alarms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { fetchAnalyticsFromDb, subscribeRealtime } from "@/services/supabaseAlarms";
import { RangePicker } from "@/components/RangePicker";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { format } from "date-fns";

interface Props {
  alarms: Alarm[];
  range: TimeRange;
  onChangeRange?: (r: TimeRange) => void;
  filterInactive?: boolean;
  preset?: "lastHour" | "last24h" | "custom" | null;
  onChangePreset?: (p: "lastHour" | "last24h" | "custom" | null) => void;
}

export function AnalyticsPanel({ alarms, range, onChangeRange, filterInactive = false, preset = null, onChangePreset }: Props) {
  const [csvUrl, setCsvUrl] = useState<string | null>(null);
  const supaEnabled = isSupabaseConfigured();
  const [rows, setRows] = useState<Array<{ id: string; totalMs: number; total: string; activations: number }>>([]);
  const [tick, setTick] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isLiveRange = useMemo(() => {
    const endDiffMs = Date.now() - range.end.getTime();
    const nearNow = endDiffMs >= -500 && endDiffMs <= 5 * 60 * 1000;
    return preset === 'lastHour' || preset === 'last24h' || nearNow;
  }, [range.end, preset]);

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

  function getOverlappingPeriods(alarmId: string) {
    const alarm = alarms.find(a => a.id === alarmId);
    if (!alarm) return [] as { start: Date; end: Date | null; durationMs: number }[];
    const effectiveRange = isLiveRange ? { start: range.start, end: new Date() } : range;
    const list = alarm.activationHistory
      .map(p => {
        const start = new Date(p.activatedAt);
        const end = p.deactivatedAt ? new Date(p.deactivatedAt) : null;
        const overlapStart = start > effectiveRange.start ? start : effectiveRange.start;
        const overlapEnd = (end ?? new Date()) < effectiveRange.end ? (end ?? new Date()) : effectiveRange.end;
        const durationMs = Math.max(0, overlapEnd.getTime() - overlapStart.getTime());
        return { start, end, durationMs, overlaps: overlapEnd > overlapStart };
      })
      .filter(x => x.overlaps)
      .sort((a, b) => b.start.getTime() - a.start.getTime())
      .map(({ start, end, durationMs }) => ({ start, end, durationMs }));
    return list;
  }

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
            <RangePicker
              range={range}
              onChange={(r) => onChangeRange?.(r)}
              onPresetChange={(p) => onChangePreset?.(p)}
              activePreset={preset}
            />
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
                  <TableHead className="w-0"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedRows.map(r => {
                  const alarm = alarms.find(a => a.id === r.id);
                  const isActive = alarm?.status === 1;
                  const hasLogs = (r.activations ?? 0) > 0 || (r.totalMs ?? 0) > 0;
                  const expanded = expandedId === r.id;
                  const periods = expanded ? getOverlappingPeriods(r.id) : [];
                  return (
                    <>
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
                        <TableCell className="py-0 pr-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn("h-8 w-8 p-0", !hasLogs && "opacity-30 pointer-events-none")}
                            onClick={() => setExpandedId(expanded ? null : r.id)}
                            aria-label="Toggle logs"
                          >
                            <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow key={r.id + "-details"} className="bg-gray-50/60 border-gray-200">
                          <TableCell colSpan={4} className="py-4 px-6">
                            {periods.length === 0 ? (
                              <div className="text-sm text-gray-600">No logs in selected range.</div>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-gray-600">
                                      <th className="text-left font-semibold pb-2">Activated At</th>
                                      <th className="text-left font-semibold pb-2">Deactivated At</th>
                                      <th className="text-left font-semibold pb-2">Duration</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {periods.map((p, idx) => (
                                      <tr key={idx} className="border-t border-gray-200">
                                        <td className="py-2 pr-4 text-gray-900 font-mono">{format(p.start, "PP p")}</td>
                                        <td className="py-2 pr-4 text-gray-700 font-mono">{p.end ? format(p.end, "PP p") : "Active"}</td>
                                        <td className="py-2 pr-4 font-mono text-blue-700">{formatDuration(p.durationMs)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                <TableRow className="border-gray-300 bg-gray-100">
                  <TableCell className="font-bold text-gray-900 py-4 px-6 text-lg">TOTAL</TableCell>
                  <TableCell className="font-bold text-green-600 py-4 px-6 text-lg font-mono">{formatDuration(totalAll)}</TableCell>
                  <TableCell className="py-4 px-6"></TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
