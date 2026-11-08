// Supabase Edge Function "rest-push": verschickt die Push-Nachrichten fälliger Pausen-Timer.
//
// Wird alle paar Sekunden vom Cron-Job aus supabase/rest-timer.sql aufgerufen (nur wenn etwas fällig ist).
// Benötigte Secrets (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (z. B. mailto:deine@adresse)
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
//
// "Verify JWT" ist für diese Function ausgeschaltet: Ein Aufruf verschickt nur, was ohnehin fällig ist.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

Deno.serve(async () => {
  // Fällige Timer abholen und gleichzeitig löschen – so wird jeder genau einmal verschickt
  const { data: due, error } = await db.from('rest_timers').delete().lte('fire_at', new Date().toISOString()).select()
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const timer of due ?? []) {
    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', timer.user_id)
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title: timer.title, body: timer.body }),
            { TTL: 60, urgency: 'high' },
          )
          sent++
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode
          // Gerät hat sich abgemeldet (App gelöscht, Erlaubnis entzogen) → Eintrag entfernen
          if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          else console.error('Push fehlgeschlagen', status, (e as Error).message)
        }
      }),
    )
  }
  return Response.json({ due: due?.length ?? 0, sent })
})
