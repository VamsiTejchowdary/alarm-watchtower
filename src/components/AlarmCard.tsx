import { Alarm } from "@/store/alarms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Power } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  alarm: Alarm;
  onToggle: (id: string) => void;
  isLoading?: boolean;
}

export function AlarmCard({ alarm, onToggle, isLoading = false }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const i = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const activeSinceMs = useMemo(() => {
    if (alarm.status !== 1) return 0;
    const last = new Date(alarm.lastStatusChangeTime).getTime();
    return Date.now() - last;
  }, [alarm.status, alarm.lastStatusChangeTime, tick]);

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 border-2",
      alarm.status === 1 ? "alarm-active" : "alarm-normal",
      "professional-card"
    )}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full bg-gray-100 flex items-center justify-center">
              <div className={cn(
                "w-2 h-2 rounded-full",
                alarm.status === 1 ? "bg-red-500 animate-pulse" : "bg-green-500"
              )} />
            </div>
            <span className="font-bold text-lg text-gray-900">{alarm.id}</span>
          </div>
          <Badge 
            className={cn(
              "px-3 py-1 text-xs font-semibold border-0 rounded-full",
              alarm.status === 1 ? "status-badge-active" : "status-badge-inactive"
            )}
          >
            {alarm.status === 1 ? "🚨 ACTIVE" : "✅ NORMAL"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <p className="text-sm text-gray-700 leading-relaxed font-medium">{alarm.description}</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="text-xs text-blue-600 uppercase tracking-wide mb-2 font-semibold">Last Status Change</div>
            <div className="font-mono text-sm text-gray-900">{format(new Date(alarm.lastStatusChangeTime), "MMM dd, yyyy 'at' HH:mm:ss")}</div>
          </div>
          
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
            <div className="text-xs text-purple-600 uppercase tracking-wide mb-2 font-semibold">Active Duration</div>
            <div className="font-mono text-xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <span className={alarm.status === 1 ? "text-red-600" : "text-green-600"}>
                {alarm.status === 1 ? new Date(activeSinceMs).toISOString().substring(11, 19) : "00:00:00"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="pt-2">
          <Button 
            onClick={() => onToggle(alarm.id)} 
            disabled={isLoading}
            className={cn(
              "w-full font-semibold transition-all duration-300 shadow-lg",
              alarm.status === 1 ? "btn-red" : "btn-green",
              isLoading && "opacity-75 cursor-not-allowed"
            )}
            size="lg"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Processing...
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                {alarm.status === 1 ? "Deactivate" : "Activate"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
