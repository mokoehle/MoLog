/**
 * Start als lokaler MCP-Server über stdio (z. B. für Claude Code / Claude Desktop).
 * Wichtig: stdout gehört dem MCP-Protokoll – Meldungen nur auf stderr.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createUserClient, ensureUser } from './auth/session.ts'
import { createServer } from './core/server.ts'
import { supabaseSource } from './source/supabase.ts'

const client = createUserClient()
const server = createServer(supabaseSource(client, async () => void (await ensureUser(client))))
await server.connect(new StdioServerTransport())
console.error('molog-coach läuft (stdio)')
