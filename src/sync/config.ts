/**
 * Supabase-Zugang. Beide Werte sind dafür gedacht, öffentlich im App-Code zu stehen:
 * Wer welche Daten sehen darf, regeln die Zugriffsregeln (Row Level Security) in der Datenbank.
 * Den Secret Key / service_role niemals hier eintragen!
 *
 * Solange die Werte leer sind, läuft die App wie bisher nur lokal.
 */
export const SUPABASE_URL: string = 'https://efaflnwpraspvwgyanxt.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY: string = 'sb_publishable_ppKjwUIZtRo5KdXKc8Meyw_xvWgm8Ef'

export const cloudConfigured = SUPABASE_URL !== '' && SUPABASE_PUBLISHABLE_KEY !== ''
