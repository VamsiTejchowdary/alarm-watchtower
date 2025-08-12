import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alarm, loadAlarms, saveAlarms, setSimulation, TimeRange, toggleAlarm, isSimulationOn } from "@/store/alarms";
import { AlarmCard } from "@/components/AlarmCard";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { fetchAllAlarms, subscribeRealtime, toggleAlarmInDb, createAlarmInDb } from "@/services/supabaseAlarms";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import RotatingIconButton from "@/components/RotatingIconButton";

const Index = () => {
  const supaEnabled = isSupabaseConfigured();
  const [alarms, setAlarms] = useState<Alarm[]>(() => (supaEnabled ? [] : loadAlarms()));
  const [sim, setSim] = useState<boolean>(supaEnabled ? false : isSimulationOn());
  const [isScrolled, setIsScrolled] = useState(false);

  
  useEffect(() => {
    if (supaEnabled) return; 
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
       
        try {
          const data = await fetchAllAlarms();
          setAlarms(data);
          const updated = data.find((a) => a.id === id);
          if (updated) {
            fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                alarmId: updated.id,
                description: updated.description,
                status: updated.status,
                lastStatusChangeTime: updated.lastStatusChangeTime,
              }),
            }).catch(() => {});
          }
        } catch (e) {
  
        }
        toast({ title: `Toggled ${id}` });
      } catch (e: any) {
        toast({ title: `Toggle failed`, description: String(e?.message ?? e), variant: "destructive" });
      }
    } else {
      let emailPayload: { id: string; description: string; status: number; lastStatusChangeTime: string } | null = null;
      setAlarms((prev) => {
        const updated = toggleAlarm(prev, id);
        const a = updated.find((x) => x.id === id);
        if (a) emailPayload = { id: a.id, description: a.description, status: a.status, lastStatusChangeTime: a.lastStatusChangeTime };
        return updated;
      });
      if (emailPayload) {
        fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alarmId: emailPayload.id,
            description: emailPayload.description,
            status: emailPayload.status,
            lastStatusChangeTime: emailPayload.lastStatusChangeTime,
          }),
        }).catch(() => {});
      }
    toast({ title: `Toggled ${id}` });
    }
  };

 
  const [range, setRange] = useState<TimeRange>(() => ({ start: new Date(Date.now() - 24 * 3600_000), end: new Date() }));
  const [activeTab, setActiveTab] = useState<"monitor" | "analytics">("monitor");
  const [analyticsPreset, setAnalyticsPreset] = useState<"lastHour" | "last24h" | "custom" | null>(null);

  
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
  const activeAlarms = useMemo(() => alarms.filter(a => a.status === 1), [alarms]);
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [recipientList, setRecipientList] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");

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
                Beltways Alarm Tracking 
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
              <Button className="btn-blue" onClick={() => setNotifyOpen(true)}>
                <Bell className="h-4 w-4 mr-2" /> Notify
              </Button>
              {supaEnabled && (
                <Button onClick={() => setAddOpen((o) => !o)} className="bg-gray-700 hover:bg-gray-800 text-white">
                  + Add Alarm
                </Button>
              )}
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
        {supaEnabled && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Alarm</DialogTitle>
                <DialogDescription>
                  Create a new alarm with an ID and description.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="md:col-span-1">
                  <label className="text-sm text-gray-600">ID</label>
                  <input
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    placeholder="ALM-011"
                    className="w-full border border-gray-300 rounded-md p-2"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm text-gray-600">Description</label>
                  <input
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Description"
                    className="w-full border border-gray-300 rounded-md p-2"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button
                  className="bg-gray-700 hover:bg-gray-800 text-white"
                  disabled={!newId || !newDesc}
                  onClick={async () => {
                    try {
                      await createAlarmInDb(newId, newDesc);
                      const data = await fetchAllAlarms();
                      setAlarms(data);
                      setNewId("");
                      setNewDesc("");
                      setAddOpen(false);
                      toast({ title: `Added ${newId}` });
                    } catch (e: any) {
                      toast({ title: "Failed", description: String(e?.message ?? e), variant: "destructive" });
                    }
                  }}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send Notification</DialogTitle>
              <DialogDescription>
                Select an active alarm and add recipient emails below.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="text-sm text-gray-600 mb-2">Active Alarms</div>
                <div className="max-h-56 overflow-auto border border-gray-200 rounded-md">
                  {activeAlarms.length === 0 ? (
                    <div className="p-3 text-sm text-gray-500">No active alarms</div>
                  ) : (
                    activeAlarms.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAlarmId(a.id)}
                        className={cn(
                          "w-full text-left p-2 border-b border-gray-100 hover:bg-gray-50",
                          selectedAlarmId === a.id && "bg-blue-50 border-blue-200"
                        )}
                      >
                        <div className="font-semibold">{a.id}</div>
                        <div className="text-xs text-gray-600 truncate">{a.description}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-gray-600">Recipients</div>
                  <div className="text-xs text-gray-500">Press Enter to add</div>
                </div>
                <div className="w-full border border-gray-300 rounded-md p-2">
                  <div className="flex flex-wrap gap-2">
                    {recipientList.map((email) => (
                      <span key={email} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-1 text-xs">
                        {email}
                        <button
                          className="hover:text-blue-900"
                          onClick={() => setRecipientList(list => list.filter(e => e !== email))}
                          aria-label={`Remove ${email}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                    <input
                      value={recipientInput}
                      onChange={(e) => setRecipientInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const trimmed = recipientInput.trim();
                          const valid = /.+@.+\..+/.test(trimmed);
                          if (valid && !recipientList.includes(trimmed)) {
                            setRecipientList((l) => [...l, trimmed]);
                            setRecipientInput('');
                          }
                        }
                      }}
                      placeholder="Type email and press Enter"
                      className="flex-1 min-w-[200px] outline-none text-sm"
                    />
                  </div>
                </div>
                {recipientInput && !/.+@.+\..+/.test(recipientInput) && (
                  <div className="text-xs text-red-600 mt-1">Enter a valid email and press Enter</div>
                )}
              </div>
            </div>
            {selectedAlarmId && (
              <div className="text-xs text-gray-500 mt-1">
                Selected: {selectedAlarmId}
                {(() => {
                  const a = alarms.find(x => x.id === selectedAlarmId);
                  return a ? ` — ${a.description}` : '';
                })()}
              </div>
            )}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setNotifyOpen(false)}>Cancel</Button>
              <Button
                className="btn-blue"
                disabled={!selectedAlarmId || recipientList.length === 0}
                onClick={async () => {
                  const alarm = alarms.find(a => a.id === selectedAlarmId!);
                  if (!alarm) return;
                  const body: any = {
                    alarmId: alarm.id,
                    description: alarm.description,
                    status: alarm.status,
                    lastStatusChangeTime: alarm.lastStatusChangeTime,
                  };
                  if (recipientList.length > 0) body.to = recipientList;
                  try {
                    await fetch('/api/send-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    });
                    setNotifyOpen(false);
                    setRecipientInput('');
                    setRecipientList([]);
                    setSelectedAlarmId(null);
                    toast({ title: `Email sent for ${alarm.id}` });
                  } catch {}
                }}
              >
                Send Email
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
            <AnalyticsPanel
              alarms={alarms}
              range={range}
              onChangeRange={(r) => setRange(r)}
              preset={analyticsPreset}
              onChangePreset={setAnalyticsPreset}
            />
          </TabsContent>
        </Tabs>
      </section>
    </main>
  );
};

export default Index;
