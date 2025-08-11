import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alarm, loadAlarms, saveAlarms, setSimulation, TimeRange, toggleAlarm, isSimulationOn } from "@/store/alarms";
import { AlarmCard } from "@/components/AlarmCard";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { fetchAllAlarms, subscribeRealtime, toggleAlarmInDb } from "@/services/supabaseAlarms";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

const Index = () => {
  const supaEnabled = isSupabaseConfigured();
  const [alarms, setAlarms] = useState<Alarm[]>(() => (supaEnabled ? [] : loadAlarms()));
  const [sim, setSim] = useState<boolean>(supaEnabled ? false : isSimulationOn());

  // Local simulation (only when Supabase is not configured)
  useEffect(() => {
    if (supaEnabled) return; // Supabase mode; no local sim timer
    const id = setInterval(() => {
      if (!sim) return;
      const count = Math.random() < 0.6 ? 1 : 2;
      setAlarms((prev) => {
        let updated = prev;
        for (let i = 0; i < count; i++) {
          const pick = prev[Math.floor(Math.random() * prev.length)];
          updated = toggleAlarm(updated, pick.id);
        }
        return updated;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [sim, supaEnabled]);

  useEffect(() => {
    if (!supaEnabled) saveAlarms(alarms);
  }, [alarms, supaEnabled]);

  const onToggle = async (id: string) => {
    if (supaEnabled) {
      const current = alarms.find((a) => a.id === id);
      if (!current) return;
      try {
        await toggleAlarmInDb(current);
        // Immediate refetch to reflect change even if Realtime is not enabled
        try {
          const data = await fetchAllAlarms();
          setAlarms(data);
        } catch (e) {
          // ignore, realtime may still update
        }
        toast({ title: `Toggled ${id}` });
      } catch (e: any) {
        toast({ title: `Toggle failed`, description: String(e?.message ?? e), variant: "destructive" });
      }
    } else {
      setAlarms((prev) => toggleAlarm(prev, id));
      toast({ title: `Toggled ${id}` });
    }
  };

  // Default analytics range: entire day so far → but we will not filter until a preset/custom is selected
  const [range, setRange] = useState<TimeRange>(() => ({ start: new Date(Date.now() - 24 * 3600_000), end: new Date() }));
  const [activeTab, setActiveTab] = useState<"monitor" | "analytics">("monitor");
  const [preset, setPreset] = useState<"lastHour" | "today" | "last24h" | null>(null);

  useEffect(() => {
    if (!supaEnabled) setSimulation(sim);
  }, [sim, supaEnabled]);

  // Supabase: initial fetch + realtime
  useEffect(() => {
    if (!supaEnabled) return;
    let unsub: (() => void) | null = null;
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAllAlarms();
        if (!cancelled) setAlarms(data);
      } catch (e) {
        console.error(e);
      }
      unsub = subscribeRealtime(async () => {
        try {
          const data = await fetchAllAlarms();
          if (!cancelled) setAlarms(data);
        } catch (e) {
          console.error(e);
        }
      });
    })();
    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [supaEnabled]);

  const activeCount = useMemo(() => alarms.filter(a => a.status === 1).length, [alarms]);

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Alarm Tracking System</h1>
          <div className="flex items-center gap-3">
            <Badge variant="secondary">Active: {activeCount}/10</Badge>
            <Button variant={sim ? "default" : "secondary"} onClick={() => setSim((s) => !s)}>
              {sim ? "Stop Simulation" : "Start Simulation"}
            </Button>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-8 space-y-6">
        <Tabs defaultValue="monitor" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="monitor" className="mt-6 animate-enter">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {alarms.map((a) => (
                <div key={a.id} className="hover-scale">
                  <AlarmCard alarm={a} onToggle={onToggle} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6 animate-enter">
            <AnalyticsPanel alarms={alarms} range={range} onChangeRange={(r) => setRange(r)} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Index;
