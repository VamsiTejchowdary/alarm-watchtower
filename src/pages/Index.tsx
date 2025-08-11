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
import { cn } from "@/lib/utils";

const Index = () => {
  const supaEnabled = isSupabaseConfigured();
  const [alarms, setAlarms] = useState<Alarm[]>(() => (supaEnabled ? [] : loadAlarms()));
  const [sim, setSim] = useState<boolean>(supaEnabled ? false : isSimulationOn());
  const [isScrolled, setIsScrolled] = useState(false);

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

  // Scroll detection for compact header
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


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
    <main className="min-h-screen bg-gray-50">
      <header className={cn(
        "sticky top-0 z-20 header-modern transition-all duration-300",
        isScrolled ? "py-3" : "py-6"
      )}>
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "bg-white rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 overflow-hidden",
                isScrolled ? "w-10 h-10" : "w-12 h-12"
              )}>
                <img 
                  src="/Beltways_Favicon.jpg" 
                  alt="Beltways Logo" 
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <div className={cn(
                "transition-all duration-300 overflow-hidden",
                isScrolled ? "w-0 opacity-0" : "w-auto opacity-100"
              )}>
                <h1 className="text-3xl font-bold text-gray-900 whitespace-nowrap">
                  Alarm Tracking Beltways
                </h1>
                <p className="text-sm text-gray-600 whitespace-nowrap">Real-time Monitoring & Analytics Dashboard</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-lg px-4 py-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    activeCount > 0 ? "bg-red-500 animate-pulse" : "bg-green-500"
                  )}></div>
                  <span className={cn(
                    "font-semibold transition-all duration-300",
                    isScrolled ? "text-sm" : "text-base",
                    "text-gray-900"
                  )}>
                    Active: <span className={activeCount > 0 ? "text-red-600" : "text-green-600"}>{activeCount}</span>/10
                  </span>
                </div>
              </div>
              {!supaEnabled && (
                <Button 
                  className={cn(
                    "font-semibold shadow-lg transition-all duration-300",
                    isScrolled ? "text-sm px-3 py-2" : "px-4 py-3",
                    sim ? "btn-blue" : "bg-gray-600 hover:bg-gray-700 text-white"
                  )}
                  onClick={() => setSim((s) => !s)}
                >
                  {sim ? "Stop Simulation" : "Start Simulation"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-6 py-8 space-y-8">
        <Tabs defaultValue="monitor" onValueChange={(v) => setActiveTab(v as any)}>
          <div className="flex items-center justify-center mb-8">
            <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-lg">
              <TabsList className="bg-gray-100">
                <TabsTrigger 
                  value="monitor" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 text-gray-700"
                >
                  🖥️ Alarm Overview
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="data-[state=active]:bg-purple-600 data-[state=active]:text-white font-semibold px-6 py-3 rounded-lg transition-all duration-300 text-gray-700"
                >
                  📊 Historical Analysis
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="monitor" className="animate-enter">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {alarms.map((a) => (
                <div key={a.id} className="hover-scale">
                  <AlarmCard alarm={a} onToggle={onToggle} />
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="animate-enter">
            <AnalyticsPanel alarms={alarms} range={range} onChangeRange={(r) => setRange(r)} />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Index;
