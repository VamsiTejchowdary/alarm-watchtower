export type AlarmStatus = 0 | 1;

export interface ActivationPeriod {
  activatedAt: string;
  deactivatedAt?: string | null;
}

export interface Alarm {
  id: string;
  description: string;
  status: AlarmStatus;
  lastStatusChangeTime: string;
  activationHistory: ActivationPeriod[];
}

export type TimeRange = {
  start: Date;
  end: Date;
};

const STORAGE_KEY = 'alarm-tracker:v1:alarms';
const SIM_KEY = 'alarm-tracker:v1:simulation';

function nowIso() {
  return new Date().toISOString();
}

function createInitialAlarms(): Alarm[] {
  const alarms: Alarm[] = Array.from({ length: 10 }).map((_, i) => {
    const id = `ALM-${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      description: `Alarm ${i + 1} — Monitoring point`,
      status: 0 as AlarmStatus,
      lastStatusChangeTime: nowIso(),
      activationHistory: [],
    };
  });
  return alarms;
}

export function loadAlarms(): Alarm[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return createInitialAlarms();
  try {
    const parsed = JSON.parse(raw) as Alarm[];
    return parsed;
  } catch {
    return createInitialAlarms();
  }
}

export function saveAlarms(alarms: Alarm[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alarms));
}

export function toggleAlarm(alarms: Alarm[], id: string): Alarm[] {
  const updated = alarms.map((a) => {
    if (a.id !== id) return a;
    const newStatus: AlarmStatus = a.status === 1 ? 0 : 1;
    const ts = nowIso();

    if (newStatus === 1) {
      // Becoming active -> add new activation period
      return {
        ...a,
        status: newStatus,
        lastStatusChangeTime: ts,
        activationHistory: [...a.activationHistory, { activatedAt: ts }],
      };
    } else {
      // Becoming inactive -> close the last open period
      const history = [...a.activationHistory];
      for (let i = history.length - 1; i >= 0; i--) {
        if (!history[i].deactivatedAt) {
          history[i] = { ...history[i], deactivatedAt: ts };
          break;
        }
      }
      return {
        ...a,
        status: newStatus,
        lastStatusChangeTime: ts,
        activationHistory: history,
      };
    }
  });
  saveAlarms(updated);
  return updated;
}

export function totalActiveMsForRange(alarm: Alarm, range: TimeRange): number {
  const { start, end } = range;
  return alarm.activationHistory.reduce((sum, p) => {
    const startT = new Date(p.activatedAt);
    const endT = p.deactivatedAt ? new Date(p.deactivatedAt) : new Date();

    const overlapStart = startT > start ? startT : start;
    const overlapEnd = endT < end ? endT : end;
    const diff = overlapEnd.getTime() - overlapStart.getTime();
    return sum + Math.max(0, diff);
  }, 0);
}

export function activationCountForRange(alarm: Alarm, range: TimeRange): number {
  const { start, end } = range;
  return alarm.activationHistory.filter((p) => {
    const startT = new Date(p.activatedAt);
    const endT = p.deactivatedAt ? new Date(p.deactivatedAt) : new Date();
    return startT <= end && endT >= start; // overlaps
  }).length;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function isSimulationOn(): boolean {
  return localStorage.getItem(SIM_KEY) === '1';
}

export function setSimulation(on: boolean) {
  localStorage.setItem(SIM_KEY, on ? '1' : '0');
}
