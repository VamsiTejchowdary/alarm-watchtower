import * as React from "react";
import { endOfDay, subHours } from "date-fns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon } from "lucide-react";
import RotatingIconButton from "@/components/RotatingIconButton";
import { TimeRange } from "@/store/alarms";

interface Props {
  range: TimeRange;
  onChange: (range: TimeRange) => void;
  onPresetChange?: (label: 'lastHour' | 'last24h' | 'custom' | null) => void;
  activePreset?: 'lastHour' | 'last24h' | 'custom' | null;
}

export function RangePicker({ range, onChange, onPresetChange, activePreset }: Props) {
  const setPreset = (label: 'lastHour' | 'last24h') => {
    const now = new Date();
    if (label === 'lastHour') onChange({ start: subHours(now, 1), end: now });
    if (label === 'last24h') onChange({ start: subHours(now, 24), end: now });
    onPresetChange?.(label);
  };

  const [open, setOpen] = React.useState(false);
  const [temp, setTemp] = React.useState<{ from?: Date; to?: Date }>({ from: range.start, to: range.end });

  // Keep the temporary selection in sync each time the popover opens
  React.useEffect(() => {
    if (open) {
      setTemp({ from: range.start, to: range.end });
    }
  }, [open, range.start, range.end]);

  const apply = () => {
    let from = temp.from;
    let to = temp.to;
    // Support single-day selection and reverse selections
    if (from && !to) to = from;
    if (!from && to) from = to;
    if (from && to && from > to) {
      const swap = from;
      from = to;
      to = swap;
    }
    if (from && to) {
      onChange({ start: from, end: endOfDay(to) });
      onPresetChange?.('custom');
    }
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button 
        className={cn(
          "font-semibold transition-all duration-300 shadow-lg",
          activePreset === 'lastHour' 
            ? 'btn-blue' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
        )}
        onClick={() => setPreset('lastHour')}
      >
        ⏰ Last Hour
      </Button>
      
      <Button 
        className={cn(
          "font-semibold transition-all duration-300 shadow-lg",
          activePreset === 'last24h' 
            ? 'btn-blue' 
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
        )}
        onClick={() => setPreset('last24h')}
      >
        📅 Last 24 Hours
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            className={cn(
              "font-semibold transition-all duration-300 shadow-lg flex items-center gap-2",
              activePreset === 'custom' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white border-0' 
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700 border border-gray-300'
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            📊 Custom Range
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-white border border-gray-200 shadow-xl rounded-lg" align="start">
          <div className="p-4">
            <Calendar
              mode="range"
              selected={{ from: temp.from, to: temp.to }}
              onSelect={(v) => setTemp(v ?? {})}
              initialFocus
              className="rounded-lg"
              // Prevent picking a future date range which can be confusing for analytics
              disabled={{ after: new Date() }}
            />
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 mt-4">
              <Button 
                size="sm" 
                className="bg-gray-500 hover:bg-gray-600 text-white border-0" 
                onClick={() => setTemp({ from: range.start, to: range.end })}
              >
                Reset
              </Button>
              <Button 
                size="sm" 
                className="bg-purple-600 hover:bg-purple-700 text-white border-0" 
                onClick={apply}
              >
                Apply
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <RotatingIconButton
        title="Reset"
        className="h-9 w-9"
        iconClassName="h-4 w-4"
        onClick={() => {
          const now = new Date();
          onChange({ start: new Date(0), end: now });
          onPresetChange?.(null);
        }}
      />
    </div>
  );
}
