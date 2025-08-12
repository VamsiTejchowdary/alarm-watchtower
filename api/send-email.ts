export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  try {
    const { alarmId, description, status, lastStatusChangeTime, to } = await req.json();
    if (!alarmId) return new Response(JSON.stringify({ error: 'alarmId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

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

    const apiKey = process.env.RESEND_API_KEY as string;
    const from = process.env.ALERT_FROM || 'Beltways Alarm <hireme@vamsitejchowdary.com>';

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: recipients, subject, html }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}