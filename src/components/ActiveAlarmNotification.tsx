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
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-w-sm">
        {/* Collapsed Header - Always Visible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full bg-red-500 hover:bg-red-600 text-white px-4 py-3 flex items-center justify-between transition-colors"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-bold text-sm">
              {activeAlarms.length} Active
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="animate-in slide-in-from-top-2 duration-200">
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
        )}
      </div>
    </div>
  );
}