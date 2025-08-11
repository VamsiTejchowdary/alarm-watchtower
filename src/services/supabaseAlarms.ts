import { getSupabaseClient } from "@/lib/supabaseClient";
import type { Alarm, AlarmStatus, ActivationPeriod, TimeRange } from "@/store/alarms";

type DbAlarm = {
  id: string;
  description: string;
  status: number;
  last_status_change_time: string;
};

type DbActivation = {
  id: string;
  alarm_id: string;
  activated_at: string;
  deactivated_at: string | null;
};

export async function fetchAllAlarms(): Promise<Alarm[]> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");

  const [alarmsRes, activationsRes] = await Promise.all([
    supabase.from("alarms").select("id, description, status, last_status_change_time").order("id"),
    supabase.from("alarm_activations").select("id, alarm_id, activated_at, deactivated_at").order("activated_at", { ascending: true }),
  ]);

  if (alarmsRes.error) throw alarmsRes.error;
  if (activationsRes.error) throw activationsRes.error;

  const byAlarm: Record<string, ActivationPeriod[]> = {};
  (activationsRes.data as DbActivation[]).forEach((row) => {
    if (!byAlarm[row.alarm_id]) byAlarm[row.alarm_id] = [];
    byAlarm[row.alarm_id].push({
      activatedAt: row.activated_at,
      deactivatedAt: row.deactivated_at,
    });
  });

  const result: Alarm[] = (alarmsRes.data as DbAlarm[]).map((a) => ({
    id: a.id,
    description: a.description,
    status: (a.status as 0 | 1) satisfies AlarmStatus,
    lastStatusChangeTime: a.last_status_change_time,
    activationHistory: byAlarm[a.id] ?? [],
  }));
  return result;
}

export async function toggleAlarmInDb(current: Alarm): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const nextStatus: AlarmStatus = current.status === 1 ? 0 : 1;
  const ts = new Date().toISOString();
  const { error } = await supabase
    .from("alarms")
    .update({ status: nextStatus, last_status_change_time: ts })
    .eq("id", current.id);
  if (error) throw error;
}

export function subscribeRealtime(onChange: () => void): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};

  const channel = supabase
    .channel("alarms-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "alarms" },
      () => onChange()
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "alarm_activations" },
      () => onChange()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function fetchAnalyticsFromDb(range: TimeRange): Promise<Array<{ id: string; totalMs: number; activations: number }>> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("alarm_analytics", {
    start_ts: range.start.toISOString(),
    end_ts: range.end.toISOString(),
  });
  if (error) throw error;
  return (data as Array<{ id: string; total_ms: number; activations: number }>).map(r => ({
    id: r.id,
    totalMs: Number(r.total_ms ?? 0) * 1000, // seconds -> ms
    activations: Number(r.activations ?? 0),
  }));
}


