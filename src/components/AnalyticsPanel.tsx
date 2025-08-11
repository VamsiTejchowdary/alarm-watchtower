import { useEffect, useMemo, useState } from "react";
import { Alarm, TimeRange, activationCountForRange, formatDuration, totalActiveMsForRange } from "@/store/alarms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface Props {
  alarms: Alarm[];
  range: TimeRange;
}

export function AnalyticsPanel({ alarms, range }: Props) {
  const [csvUrl, setCsvUrl] = useState<string | null>(null);

  const rows = useMemo(() => alarms.map((a) => {
    const total = totalActiveMsForRange(a, range);
    const count = activationCountForRange(a, range);
    return { id: a.id, totalMs: total, total: formatDuration(total), activations: count };
  }), [alarms, range]);

  useEffect(() => {
    if (csvUrl) URL.revokeObjectURL(csvUrl);
    const header = ["Alarm ID", "Total Active (hh:mm:ss)", "Activations"].join(",");
    const lines = rows.map(r => [r.id, r.total, r.activations].join(","));
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    setCsvUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [rows]);

  const totalAll = useMemo(() => rows.reduce((s, r) => s + r.totalMs, 0), [rows]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Historical Analysis</CardTitle>
          {csvUrl && <a href={csvUrl} download={`alarm-analytics.csv`}>
            <Button variant="secondary">Export CSV</Button>
          </a>}
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
              {rows.map(r => (
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
