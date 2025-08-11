import { Alarm } from "@/store/alarms";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Clock, Power } from "lucide-react";

interface Props {
  alarm: Alarm;
  onToggle: (id: string) => void;
}

export function AlarmCard({ alarm, onToggle }: Props) {
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
      "relative overflow-hidden border",
      alarm.status === 1 ? "ring-1 ring-primary/30" : ""
    )}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: alarm.status === 1 ? "var(--gradient-surface)" : undefined
      }} />

      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="font-semibold">{alarm.id}</span>
          <Badge variant={alarm.status === 1 ? "default" : "secondary"} className={alarm.status === 1 ? "bg-primary text-primary-foreground" : ""}>
            {alarm.status === 1 ? "Active" : "Inactive"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{alarm.description}</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Last Change</div>
            <div className="font-medium">{format(new Date(alarm.lastStatusChangeTime), "PP p")}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Live Active</div>
            <div className="font-medium flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {alarm.status === 1 ? new Date(activeSinceMs).toISOString().substring(11, 19) : "00:00:00"}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => onToggle(alarm.id)} className="hover-scale" variant="default">
            <Power className="h-4 w-4 mr-2" />
            Toggle
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
