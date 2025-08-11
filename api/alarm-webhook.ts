import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY as string);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  if (req.headers['x-webhook-secret'] !== process.env.SUPABASE_WEBHOOK_SECRET)
    return res.status(401).json({ error: 'unauthorized' });

  try {
    const evt = req.body as { record?: any; old_record?: any; new?: any; old?: any };
    const rec = evt.record ?? (evt as any).new;
    const oldRec = evt.old_record ?? (evt as any).old;
    if (!rec || !oldRec || rec.status === oldRec.status) return res.status(200).json({ ok: true });

    const alarmId = rec.id ?? 'Unknown';
    const description = rec.description ?? 'Alarm';
    const ts = rec.last_status_change_time ?? new Date().toISOString();
    const eventType = rec.status === 1 ? 'activated' : 'deactivated';

    const to = (process.env.ALERT_TO || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (to.length === 0) return res.status(500).json({ error: 'ALERT_TO not set' });

    await resend.emails.send({
      from: process.env.ALERT_FROM || 'Alarm <alerts@vamsitejchowdary.com>',
      to,
      subject: `Alarm ${alarmId} ${eventType.toUpperCase()}`,
      html: `
        <div style="font-family: Inter, Arial, sans-serif; line-height:1.6;">
          <h2>Alarm ${alarmId} ${eventType}</h2>
          <p><strong>Description:</strong> ${description}</p>
          <p><strong>Time:</strong> ${ts}</p>
          <p><strong>New Status:</strong> ${rec.status === 1 ? 'ACTIVE' : 'INACTIVE'}</p>
        </div>
      `,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}


