import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alarm, loadAlarms, saveAlarms, setSimulation, TimeRange, toggleAlarm, isSimulationOn } from "@/store/alarms";
import { AlarmCard } from "@/components/AlarmCard";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { RangePicker } from "@/components/RangePicker";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms());
  const [sim, setSim] = useState<boolean>(isSimulationOn());

  useEffect(() => {
    const id = setInterval(() => {
      if (!sim) return;
      // randomly toggle 1-2 alarms
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
  }, [sim]);

  useEffect(() => saveAlarms(alarms), [alarms]);

  const onToggle = (id: string) => {
    setAlarms((prev) => toggleAlarm(prev, id));
    toast({ title: `Toggled ${id}` });
  };

  const [range, setRange] = useState<TimeRange>(() => ({ start: new Date(Date.now() - 3600_000), end: new Date() }));

  useEffect(() => {
    setSimulation(sim);
  }, [sim]);

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
        <Tabs defaultValue="monitor">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList>
              <TabsTrigger value="monitor">Monitor</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            <RangePicker range={range} onChange={setRange} />
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
            <AnalyticsPanel alarms={alarms} range={range} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Index;
