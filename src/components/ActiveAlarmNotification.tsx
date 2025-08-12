import { useEffect, useState, useCallback } from "react";
import { Alarm } from "@/store/alarms";
import { cn } from "@/lib/utils";
import { X, AlertTriangle, Clock, BellOff } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Props {
  alarms: Alarm[];
  onAlarmClick?: (alarmId: string) => void;
}

type DismissalType = 'individual' | 'remind' | 'permanent';

interface DismissedAlarm {
  id: string;
  dismissedAt: number;
  type: DismissalType;
}

export function ActiveAlarmNotification({ alarms, onAlarmClick }: Props) {
  const [dismissedAlarms, setDismissedAlarms] = useState<Map<string, DismissedAlarm>>(new Map());
  const [isVisible, setIsVisible] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [remindTimer, setRemindTimer] = useState<number | null>(null);
  const [isReminder, setIsReminder] = useState(false);

  // Filter active alarms based on dismissal status
  const activeAlarms = alarms.filter(a => {
    if (a.status !== 1) return false;
    
    const dismissed = dismissedAlarms.get(a.id);
    if (!dismissed) return true;
    
    // If permanently dismissed, don't show
    if (dismissed.type === 'permanent') return false;
    
    // If reminded and 30 seconds have passed, show again
    if (dismissed.type === 'remind') {
      const timeSinceDismissal = Date.now() - dismissed.dismissedAt;
      return timeSinceDismissal >= 30000; // 30 seconds
    }
    
    return false;
  });

  // Auto-show notification when there are active alarms
  useEffect(() => {
    setIsVisible(activeAlarms.length > 0);
  }, [activeAlarms.length]);

  // Clean up dismissed alarms that are no longer active
  useEffect(() => {
    const activeAlarmIds = new Set(alarms.filter(a => a.status === 1).map(a => a.id));
    setDismissedAlarms(prev => {
      const updated = new Map(prev);
      for (const [alarmId] of prev) {
        if (!activeAlarmIds.has(alarmId)) {
          updated.delete(alarmId);
        }
      }
      return updated;
    });
  }, [alarms]);

  const [countdown, setCountdown] = useState<number>(0);

  // Set up reminder timer with countdown
  useEffect(() => {
    if (remindTimer) {
      const startTime = Date.now();
      const endTime = startTime + remindTimer;
      
      const updateCountdown = () => {
        const remaining = Math.max(0, endTime - Date.now());
        setCountdown(Math.ceil(remaining / 1000));
        
        if (remaining <= 0) {
          setRemindTimer(null);
          setCountdown(0);
          setIsReminder(true);
          // Force re-evaluation of active alarms
          setDismissedAlarms(prev => new Map(prev));
          
          // Show reminder toast
          toast({
            title: "🔔 Alarm Reminder",
            description: "You asked to be reminded about active alarms.",
          });
          
          // Optional: Play notification sound (if user has enabled it)
          try {
            // Create a subtle notification sound
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
          } catch (e) {
            // Ignore audio errors - not critical
          }
          
          // Reset reminder flag after animation
          setTimeout(() => setIsReminder(false), 3000);
        }
      };
      
      updateCountdown();
      const interval = setInterval(updateCountdown, 1000);
      
      return () => clearInterval(interval);
    } else {
      setCountdown(0);
    }
  }, [remindTimer]);

  const dismissAlarm = useCallback((alarmId: string, type: DismissalType = 'individual') => {
    const dismissedAlarm: DismissedAlarm = {
      id: alarmId,
      dismissedAt: Date.now(),
      type
    };
    
    setDismissedAlarms(prev => new Map(prev).set(alarmId, dismissedAlarm));
    
    if (type === 'remind') {
      setRemindTimer(30000); // 30 seconds
    }
  }, []);

  const dismissAllWithOptions = useCallback(() => {
    setShowActions(true);
  }, []);

  const handleDismissAll = useCallback((type: DismissalType) => {
    activeAlarms.forEach(alarm => {
      dismissAlarm(alarm.id, type);
    });
    setShowActions(false);
    
    if (type === 'remind') {
      setRemindTimer(30000); // 30 seconds
      toast({
        title: "⏰ Reminder Set",
        description: `Will remind you about ${activeAlarms.length} active alarm${activeAlarms.length > 1 ? 's' : ''} in 30 seconds.`,
      });
    } else if (type === 'permanent') {
      toast({
        title: "🔕 Notifications Disabled",
        description: `Won't show notifications for these ${activeAlarms.length} alarm${activeAlarms.length > 1 ? 's' : ''} until they're deactivated and reactivated.`,
      });
    }
  }, [activeAlarms, dismissAlarm]);

  const handleIndividualDismiss = useCallback((e: React.MouseEvent, alarmId: string) => {
    e.stopPropagation();
    dismissAlarm(alarmId, 'individual');
  }, [dismissAlarm]);

  if (!isVisible || activeAlarms.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm">
      <div className={cn(
        "bg-red-50 border-2 border-red-200 rounded-xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300",
        isReminder && "ring-4 ring-orange-400 ring-opacity-75 reminder-glow"
      )}>
        {/* Header */}
        <div className="bg-red-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
            <span className="font-bold text-sm">
              {activeAlarms.length} Active Alarm{activeAlarms.length > 1 ? 's' : ''}
            </span>
            {remindTimer && countdown > 0 && (
              <div className="flex items-center gap-1 text-xs bg-red-600 px-2 py-1 rounded-full animate-pulse">
                <Clock className="h-3 w-3" />
                <span>{countdown}s</span>
              </div>
            )}
          </div>
          <button
            onClick={dismissAllWithOptions}
            className="hover:bg-red-600 rounded-full p-1 transition-colors"
            aria-label="Dismiss options"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Dismissal Actions */}
        {showActions && (
          <div className="bg-red-400 text-white px-4 py-3 border-b border-red-300">
            <div className="text-xs font-medium mb-2">Choose dismissal option:</div>
            <div className="flex gap-2">
              <button
                onClick={() => handleDismissAll('remind')}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <Clock className="h-3 w-3" />
                Remind in 30s
              </button>
              <button
                onClick={() => handleDismissAll('permanent')}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-colors flex items-center justify-center gap-1"
              >
                <BellOff className="h-3 w-3" />
                Don't show again
              </button>
            </div>
            <button
              onClick={() => setShowActions(false)}
              className="w-full mt-2 text-xs text-red-100 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Alarm List */}
        <div className="max-h-64 overflow-y-auto">
          {activeAlarms.slice(0, 3).map((alarm) => (
            <div
              key={alarm.id}
              className="px-4 py-3 border-b border-red-100 last:border-b-0 hover:bg-red-100 transition-colors cursor-pointer"
              onClick={() => onAlarmClick?.(alarm.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="font-bold text-red-800 text-sm">{alarm.id}</span>
                  </div>
                  <p className="text-xs text-red-700 truncate mb-1">
                    {alarm.description}
                  </p>
                  <p className="text-xs text-red-600">
                    Active since {format(new Date(alarm.lastStatusChangeTime), "HH:mm:ss")}
                  </p>
                </div>
                <button
                  onClick={(e) => handleIndividualDismiss(e, alarm.id)}
                  className="hover:bg-red-200 rounded-full p-1 transition-colors flex-shrink-0"
                  aria-label={`Dismiss ${alarm.id}`}
                >
                  <X className="h-3 w-3 text-red-600" />
                </button>
              </div>
            </div>
          ))}
          
          {activeAlarms.length > 3 && (
            <div className="px-4 py-2 bg-red-100 text-center">
              <span className="text-xs text-red-700 font-medium">
                +{activeAlarms.length - 3} more active alarms
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-red-100 px-4 py-2 text-center">
          <div className="text-xs text-red-700">
            <div>Click alarms to scroll to them</div>
            {remindTimer && countdown > 0 && (
              <div className="mt-1 text-orange-700 font-medium">
                Will remind again in {countdown} seconds
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}