import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Alarm,
  loadAlarms,
  saveAlarms,
  setSimulation,
  TimeRange,
  toggleAlarm,
  isSimulationOn,
} from "@/store/alarms";
import { AlarmCard } from "@/components/AlarmCard";
import { AnalyticsPanel } from "@/components/AnalyticsPanel";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  fetchAllAlarms,
  subscribeRealtime,
  toggleAlarmInDb,
  createAlarmInDb,
} from "@/services/supabaseAlarms";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner, LoadingButton } from "@/components/ui/loading-spinner";
import { AlarmCardSkeleton } from "@/components/AlarmCardSkeleton";
import { ActiveAlarmNotification } from "@/components/ActiveAlarmNotification";
import { format } from "date-fns";

const Index = () => {
  const supaEnabled = isSupabaseConfigured();
  const [alarms, setAlarms] = useState<Alarm[]>(() =>
    supaEnabled ? [] : loadAlarms()
  );
  const [sim, setSim] = useState<boolean>(
    supaEnabled ? false : isSimulationOn()
  );
  const [isScrolled, setIsScrolled] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(supaEnabled);
  const [toggleLoadingIds, setToggleLoadingIds] = useState<Set<string>>(
    new Set()
  );
  const [isEmailSending, setIsEmailSending] = useState(false);
  const [isAddingAlarm, setIsAddingAlarm] = useState(false);

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
    setToggleLoadingIds((prev) => new Set(prev).add(id));

    try {
      if (supaEnabled) {
        const current = alarms.find((a) => a.id === id);
        if (!current) return;

        await toggleAlarmInDb(current);

        try {
          const data = await fetchAllAlarms();
          setAlarms(data);
          const updated = data.find((a) => a.id === id);
          if (updated) {
            // Send email notification in background
            fetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                alarmId: updated.id,
                description: updated.description,
                status: updated.status,
                lastStatusChangeTime: updated.lastStatusChangeTime,
              }),
            }).catch(() => {});
          }
        } catch (e) {
          console.error("Failed to refresh alarms:", e);
        }
        toast({ title: `Toggled ${id}` });
      } else {
        let emailPayload: {
          id: string;
          description: string;
          status: number;
          lastStatusChangeTime: string;
        } | null = null;
        setAlarms((prev) => {
          const updated = toggleAlarm(prev, id);
          const a = updated.find((x) => x.id === id);
          if (a)
            emailPayload = {
              id: a.id,
              description: a.description,
              status: a.status,
              lastStatusChangeTime: a.lastStatusChangeTime,
            };
          return updated;
        });

        if (emailPayload) {
          fetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
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
    } catch (e: any) {
      toast({
        title: `Toggle failed`,
        description: String(e?.message ?? e),
        variant: "destructive",
      });
    } finally {
      setToggleLoadingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const [range, setRange] = useState<TimeRange>(() => ({
    start: new Date(Date.now() - 24 * 3600_000),
    end: new Date(),
  }));

  const [analyticsPreset, setAnalyticsPreset] = useState<
    "lastHour" | "last24h" | "custom" | null
  >(null);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setIsScrolled(scrollPosition > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
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
        setIsInitialLoading(true);
        const data = await fetchAllAlarms();
        if (!cancelled) {
          setAlarms(data);
          setIsInitialLoading(false);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setIsInitialLoading(false);
          toast({
            title: "Failed to load alarms",
            description: "Please check your connection and try again.",
            variant: "destructive",
          });
        }
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

  const activeCount = useMemo(
    () => alarms.filter((a) => a.status === 1).length,
    [alarms]
  );
  const activeAlarms = useMemo(
    () => alarms.filter((a) => a.status === 1),
    [alarms]
  );
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [selectedAlarmId, setSelectedAlarmId] = useState<string | null>(null);
  const [recipientInput, setRecipientInput] = useState<string>("");
  const [recipientList, setRecipientList] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");

  return (
    <main className="min-h-screen bg-gray-50">
      <header
        className={cn(
          "sticky top-0 z-20 header-modern transition-all duration-300",
          isScrolled ? "py-3" : "py-6"
        )}
      >
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "bg-white rounded-xl flex items-center justify-center shadow-lg transition-all duration-300 overflow-hidden",
                  isScrolled ? "w-10 h-10" : "w-12 h-12"
                )}
              >
                <img
                  src="/Beltways_Favicon.jpg"
                  alt="Beltways Logo"
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              <div
                className={cn(
                  "transition-all duration-300 overflow-hidden",
                  isScrolled ? "w-0 opacity-0" : "w-auto opacity-100"
                )}
              >
                <h1 className="text-3xl font-bold text-gray-900 whitespace-nowrap">
                  Beltways Alarm Tracking
                </h1>
                <p className="text-sm text-gray-600 whitespace-nowrap">
                  Real-time Monitoring & Analytics Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white rounded-lg px-4 py-3 border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      isInitialLoading
                        ? "bg-gray-400 animate-pulse"
                        : activeCount > 0
                        ? "bg-red-500 animate-pulse"
                        : "bg-green-500"
                    )}
                  ></div>
                  <span
                    className={cn(
                      "font-semibold transition-all duration-300",
                      isScrolled ? "text-sm" : "text-base",
                      "text-gray-900"
                    )}
                  >
                    {isInitialLoading ? (
                      "Loading..."
                    ) : (
                      <>
                        Active:{" "}
                        <span
                          className={
                            activeCount > 0 ? "text-red-600" : "text-green-600"
                          }
                        >
                          {activeCount}
                        </span>
                        /{alarms.length}
                      </>
                    )}
                  </span>
                </div>
              </div>
              <Button
                className="btn-blue shadow-lg"
                onClick={() => setNotifyOpen(true)}
              >
                <Bell className="h-4 w-4 mr-2" />
                Notify
              </Button>
              {supaEnabled && (
                <Button
                  onClick={() => setAddOpen(true)}
                  className="bg-gray-700 hover:bg-gray-800 text-white shadow-lg font-semibold"
                >
                  + Add Alarm
                </Button>
              )}
              {!supaEnabled && (
                <Button
                  className={cn(
                    "font-semibold shadow-lg transition-all duration-300",
                    isScrolled ? "text-sm px-3 py-2" : "px-4 py-3",
                    sim
                      ? "btn-blue"
                      : "bg-gray-600 hover:bg-gray-700 text-white"
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
            <DialogContent className="sm:max-w-md dialog-content bg-white rounded-2xl border-0 shadow-2xl">
              <DialogHeader className="text-center pb-6">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                  <span className="text-2xl">➕</span>
                </div>
                <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
                  Add New Alarm
                </DialogTitle>
                <DialogDescription className="text-gray-600 text-base">
                  Create a new alarm monitoring point for your system.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <label className="text-sm font-bold text-gray-800 mb-3 block flex items-center gap-2">
                      🏷️ Alarm ID
                    </label>
                    <input
                      value={newId}
                      onChange={(e) => setNewId(e.target.value)}
                      placeholder="ALM-011"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm font-bold text-gray-800 mb-3 block flex items-center gap-2">
                      📝 Description
                    </label>
                    <input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Enter detailed alarm description"
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                    />
                  </div>
                </div>

                {(!newId || !newDesc) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-amber-800 text-sm">
                      <span>⚠️</span>
                      <span className="font-medium">
                        Please fill in both Alarm ID and Description to
                        continue.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-4 pt-6">
                <Button
                  variant="secondary"
                  onClick={() => setAddOpen(false)}
                  className="px-8 py-3 font-semibold rounded-xl border-2 hover:bg-gray-100 transition-all duration-200"
                >
                  Cancel
                </Button>
                <LoadingButton
                  className="btn-green px-8 py-3 font-bold shadow-xl rounded-xl text-base"
                  disabled={!newId || !newDesc}
                  isLoading={isAddingAlarm}
                  onClick={async () => {
                    setIsAddingAlarm(true);
                    try {
                      await createAlarmInDb(newId, newDesc);
                      const data = await fetchAllAlarms();
                      setAlarms(data);
                      const addedId = newId;
                      // Small delay to allow smooth dialog close animation
                      setTimeout(() => {
                        setNewId("");
                        setNewDesc("");
                      }, 150);
                      setAddOpen(false);
                      toast({
                        title: `✅ Successfully added ${addedId}`,
                        description: "New alarm is now being monitored.",
                      });
                    } catch (e: any) {
                      toast({
                        title: "❌ Failed to add alarm",
                        description: String(e?.message ?? e),
                        variant: "destructive",
                      });
                    } finally {
                      setIsAddingAlarm(false);
                    }
                  }}
                >
                  ✨ Create Alarm
                </LoadingButton>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        <Dialog open={notifyOpen} onOpenChange={setNotifyOpen}>
          <DialogContent className="sm:max-w-3xl dialog-content bg-white rounded-2xl border-0 shadow-2xl">
            <DialogHeader className="text-center pb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
                <span className="text-2xl">📧</span>
              </div>
              <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">
                Send Notification
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Select an active alarm and notify your team via email.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 md:grid-cols-5">
              <div className="md:col-span-2">
                <div className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  🚨 Active Alarms
                </div>
                <div className="max-h-64 overflow-auto border-2 border-gray-200 rounded-xl bg-gray-50">
                  {isInitialLoading ? (
                    <div className="p-4 text-sm text-gray-500 flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      Loading alarms...
                    </div>
                  ) : activeAlarms.length === 0 ? (
                    <div className="p-4 text-center">
                      <div className="text-gray-400 text-4xl mb-2">✅</div>
                      <div className="text-sm text-gray-500 font-medium">
                        No active alarms
                      </div>
                      <div className="text-xs text-gray-400">
                        All systems normal
                      </div>
                    </div>
                  ) : (
                    activeAlarms.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAlarmId(a.id)}
                        className={cn(
                          "w-full text-left p-4 border-b border-gray-200 last:border-b-0 hover:bg-white transition-all duration-200",
                          selectedAlarmId === a.id &&
                            "bg-blue-100 border-blue-300 shadow-sm"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                          <div className="font-bold text-red-800">{a.id}</div>
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          {a.description}
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          Active since{" "}
                          {format(new Date(a.lastStatusChangeTime), "HH:mm")}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    👥 Email Recipients
                  </div>
                  <div className="text-xs text-blue-600 bg-blue-100 px-3 py-1 rounded-full font-medium">
                    Press Enter to add
                  </div>
                </div>
                <div className="w-full border-2 border-gray-200 rounded-xl p-4 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all duration-200 bg-gray-50 focus-within:bg-white">
                  <div className="flex flex-wrap gap-2">
                    {recipientList.map((email) => (
                      <span
                        key={email}
                        className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-full px-4 py-2 text-sm font-medium shadow-sm"
                      >
                        {email}
                        <button
                          className="hover:bg-blue-600 rounded-full p-1 transition-colors duration-150"
                          onClick={() =>
                            setRecipientList((list) =>
                              list.filter((e) => e !== email)
                            )
                          }
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
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const trimmed = recipientInput.trim();
                          const valid = /.+@.+\..+/.test(trimmed);
                          if (valid && !recipientList.includes(trimmed)) {
                            setRecipientList((l) => [...l, trimmed]);
                            setRecipientInput("");
                          }
                        }
                      }}
                      placeholder="Type email and press Enter"
                      className="flex-1 min-w-[200px] outline-none text-sm py-2 bg-transparent"
                    />
                  </div>
                </div>
                {recipientInput && !/.+@.+\..+/.test(recipientInput) && (
                  <div className="text-xs text-red-600 mt-2 flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg">
                    <span className="text-red-500">⚠️</span>
                    <span className="font-medium">
                      Enter a valid email and press Enter
                    </span>
                  </div>
                )}
              </div>
            </div>
            {selectedAlarmId && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <span>✅</span>
                  <span className="font-bold">Selected: {selectedAlarmId}</span>
                </div>
                <div className="text-sm text-blue-700 mt-1">
                  {(() => {
                    const a = alarms.find((x) => x.id === selectedAlarmId);
                    return a ? a.description : "";
                  })()}
                </div>
              </div>
            )}

            {(!selectedAlarmId || recipientList.length === 0) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mt-4">
                <div className="flex items-center gap-2 text-amber-800 text-sm">
                  <span>⚠️</span>
                  <span className="font-medium">
                    {!selectedAlarmId && recipientList.length === 0
                      ? "Please select an alarm and add at least one email recipient."
                      : !selectedAlarmId
                      ? "Please select an active alarm to notify about."
                      : "Please add at least one email recipient."}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter className="gap-4 pt-6">
              <Button
                variant="secondary"
                onClick={() => setNotifyOpen(false)}
                className="px-8 py-3 font-semibold rounded-xl border-2 hover:bg-gray-100 transition-all duration-200"
              >
                Cancel
              </Button>
              <LoadingButton
                className="btn-blue px-8 py-3 font-bold shadow-xl rounded-xl text-base"
                disabled={!selectedAlarmId || recipientList.length === 0}
                isLoading={isEmailSending}
                onClick={async () => {
                  const alarm = alarms.find((a) => a.id === selectedAlarmId!);
                  if (!alarm) return;

                  setIsEmailSending(true);
                  const body: any = {
                    alarmId: alarm.id,
                    description: alarm.description,
                    status: alarm.status,
                    lastStatusChangeTime: alarm.lastStatusChangeTime,
                  };
                  if (recipientList.length > 0) body.to = recipientList;

                  try {
                    const response = await fetch("/api/send-email", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                    });

                    if (!response.ok) {
                      throw new Error("Failed to send email");
                    }

                    // Small delay to allow smooth dialog close animation
                    setTimeout(() => {
                      setRecipientInput("");
                      setRecipientList([]);
                      setSelectedAlarmId(null);
                    }, 150);
                    setNotifyOpen(false);
                    toast({
                      title: `📧 Email sent for ${alarm.id}`,
                      description: `Notification sent to ${
                        recipientList.length
                      } recipient${recipientList.length > 1 ? "s" : ""}.`,
                    });
                  } catch (e: any) {
                    toast({
                      title: "❌ Failed to send email",
                      description: String(e?.message ?? e),
                      variant: "destructive",
                    });
                  } finally {
                    setIsEmailSending(false);
                  }
                }}
              >
                🚀 Send Notification
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Tabs defaultValue="monitor">
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
            {isInitialLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="hover-scale">
                    <AlarmCardSkeleton />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {alarms.map((a) => (
                  <div
                    key={a.id}
                    id={`alarm-${a.id}`}
                    className="hover-scale transition-all duration-300"
                  >
                    <AlarmCard
                      alarm={a}
                      onToggle={onToggle}
                      isLoading={toggleLoadingIds.has(a.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="animate-enter">
            {isInitialLoading && supaEnabled ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center">
                  <LoadingSpinner size="lg" className="mx-auto mb-4" />
                  <p className="text-gray-600">Loading analytics...</p>
                </div>
              </div>
            ) : (
              <AnalyticsPanel
                alarms={alarms}
                range={range}
                onChangeRange={(r) => setRange(r)}
                preset={analyticsPreset}
                onChangePreset={setAnalyticsPreset}
              />
            )}
          </TabsContent>
        </Tabs>
      </section>

      {/* Active Alarm Notification */}
      <ActiveAlarmNotification
        alarms={alarms}
        onAlarmClick={(alarmId) => {
          const element = document.getElementById(`alarm-${alarmId}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            // Add a brief highlight effect
            element.classList.add("ring-4", "ring-blue-400", "ring-opacity-75");
            setTimeout(() => {
              element.classList.remove(
                "ring-4",
                "ring-blue-400",
                "ring-opacity-75"
              );
            }, 2000);
          }
        }}
      />
    </main>
  );
};

export default Index;
