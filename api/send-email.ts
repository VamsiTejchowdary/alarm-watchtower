import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY as string);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { alarmId, description, status, lastStatusChangeTime, to } = req.body || {};
    if (!alarmId) return res.status(400).json({ error: 'alarmId required' });

    const recipients = Array.isArray(to) && to.length > 0
      ? to.map((s: string) => s.trim()).filter(Boolean)
      : (process.env.ALERT_TO || 'd.vamsitej333@gmail.com')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

    const eventType = Number(status) === 1 ? 'activated' : 'deactivated';
    const subject = `Alarm ${alarmId} ${eventType.toUpperCase()}`;
    const html = `
      <div style="font-family: Inter, Arial, sans-serif; line-height:1.6;">
        <h2>Alarm ${alarmId} ${eventType}</h2>
        <p><strong>Description:</strong> ${description ?? ''}</p>
        <p><strong>Time:</strong> ${lastStatusChangeTime ?? new Date().toISOString()}</p>
        <p><strong>New Status:</strong> ${Number(status) === 1 ? 'ACTIVE' : 'INACTIVE'}</p>
      </div>
    `;

    await resend.emails.send({
      from: process.env.ALERT_FROM || 'Beltways Alarm <alerts@vamsitejchowdary.com>',
      to: recipients,
      subject,
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ error: String(e?.message ?? e) });
  }
}


