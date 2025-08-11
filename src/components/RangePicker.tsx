import * as React from "react";
import { addHours, endOfDay, startOfDay, subHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import { TimeRange } from "@/store/alarms";

interface Props {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function RangePicker({ range, onChange }: Props) {
  const setPreset = (label: 'lastHour' | 'today' | 'last24h') => {
    const now = new Date();
    if (label === 'lastHour') onChange({ start: subHours(now, 1), end: now });
    if (label === 'today') onChange({ start: startOfDay(now), end: now });
    if (label === 'last24h') onChange({ start: subHours(now, 24), end: now });
  };

  const [open, setOpen] = React.useState(false);
  const [temp, setTemp] = React.useState<{ from?: Date; to?: Date }>({ from: range.start, to: range.end });

  const apply = () => {
    if (temp.from && temp.to) onChange({ start: temp.from, end: addHours(temp.to, 0) });
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button variant="secondary" onClick={() => setPreset('lastHour')}>Last Hour</Button>
      <Button variant="secondary" onClick={() => setPreset('today')}>Today</Button>
      <Button variant="secondary" onClick={() => setPreset('last24h')}>Last 24 Hours</Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Custom Range
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3 pointer-events-auto">
            <Calendar
              mode="range"
              selected={{ from: temp.from, to: temp.to }}
              onSelect={(v) => setTemp(v ?? {})}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex justify-end gap-2 p-2 pt-0">
              <Button size="sm" variant="secondary" onClick={() => setTemp({ from: range.start, to: range.end })}>Reset</Button>
              <Button size="sm" onClick={apply}>Apply</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
