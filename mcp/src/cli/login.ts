/**
 * npm run login – einmalige Anmeldung mit dem App-Konto (E-Mail-Code). Legt kein neues Konto an.
 * npm run login -- --logout – Sitzung auf diesem Rechner löschen.
 */
import { createInterface } from 'node:readline/promises'
import { clearSession, createUserClient, sessionDir } from '../auth/session.ts'

if (process.argv.includes('--logout')) {
  const client = createUserClient()
  await client.auth.signOut({ scope: 'local' }).catch(() => {})
  clearSession()
  console.log('Abgemeldet.')
  process.exit(0)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })
const client = createUserClient()

const email = (await rl.question('E-Mail-Adresse deines App-Kontos: ')).trim()
const sent = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })
if (sent.error) {
  console.error(`Code konnte nicht gesendet werden: ${sent.error.message}`)
  process.exit(1)
}

const token = (await rl.question('Code aus der E-Mail: ')).trim()
rl.close()
const { data, error } = await client.auth.verifyOtp({ email, token, type: 'email' })
if (error || !data.user) {
  console.error(`Anmeldung fehlgeschlagen: ${error?.message ?? 'unbekannter Fehler'}`)
  process.exit(1)
}

console.log(`Angemeldet als ${data.user.email}. Sitzung gespeichert in ${sessionDir}`)
process.exit(0)
