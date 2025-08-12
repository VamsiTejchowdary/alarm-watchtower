import { useState } from "react";
import { Alarm } from "@/store/alarms";
import { cn } from "@/lib/utils";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface Props {
  alarms: Alarm[];
  onAlarmClick?: (alarmId: string) => void;
}

export function ActiveAlarmNotification({ alarms, onAlarmClick }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const activeAlarms = alarms.filter(a => a.status === 1);
  
  if (activeAlarms.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Hazard symbol with count badge when collapsed */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="relative transition-all duration-200 hover:scale-110"
        >
          <AlertTriangle className="h-12 w-12 text-red-500 drop-shadow-lg" />
          {/* Count badge closer to triangle */}
          <div className="absolute -top-1 -right-1 bg-red-600 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center border-2 border-white shadow-lg">
            {activeAlarms.length}
          </div>
        </button>
      )}

      {/* Expanded popup */}
      {isExpanded && (
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-sm animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-bold text-sm">
                {activeAlarms.length} Active Alarm{activeAlarms.length > 1 ? 's' : ''}
              </span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="hover:bg-red-600 rounded-full p-1 transition-colors"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Expanded Content */}
          <div>
            <div className="max-h-80 overflow-y-auto">
              {activeAlarms.map((alarm, index) => (
                <div
                  key={alarm.id}
                  className={cn(
                    "px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer border-b border-gray-100",
                    index === activeAlarms.length - 1 && "border-b-0"
                  )}
                  onClick={() => onAlarmClick?.(alarm.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-red-800 text-sm mb-1">
                        {alarm.id}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-2">
                        {alarm.description}
                      </p>
                      <p className="text-xs text-red-600 font-medium">
                        Since {format(new Date(alarm.lastStatusChangeTime), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 px-4 py-2 text-center border-t border-gray-100">
              <div className="text-xs text-gray-500">
                Click any alarm to scroll to it
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}