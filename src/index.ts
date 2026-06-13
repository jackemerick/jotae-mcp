#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const BASE_URL = process.env.JOTAE_BASE_URL ?? 'https://app.jotae.me'
const API_KEY  = process.env.JOTAE_API_KEY ?? ''

if (!API_KEY) {
  process.stderr.write('JOTAE_API_KEY não configurada. Defina a variável de ambiente.\n')
  process.exit(1)
}

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json() as Record<string, unknown>
  if (!res.ok) throw new Error((json.error as string) ?? `HTTP ${res.status}`)
  return json
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS = [
  // ── Diagnóstico ──
  {
    name: 'get_setup_status',
    description: 'Retorna o estado geral da conta: eventos recentes, integrações ativas, timelines configuradas e próximos passos recomendados. Chame sempre primeiro antes de qualquer outra ação.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event_id: { type: 'string', description: 'ID do evento para diagnóstico específico (opcional)' },
      },
    },
  },

  // ── Eventos ──
  {
    name: 'list_events',
    description: 'Lista todos os eventos do produtor com status, datas e configurações básicas.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'get_event',
    description: 'Retorna todos os detalhes de um evento específico.',
    inputSchema: {
      type: 'object' as const,
      properties: { event_id: { type: 'string', description: 'ID do evento' } },
      required: ['event_id'],
    },
  },
  {
    name: 'get_event_stats',
    description: 'Retorna métricas do evento: inscrições, presença, pitch, cliques no CTA e taxa de conversão.',
    inputSchema: {
      type: 'object' as const,
      properties: { event_id: { type: 'string', description: 'ID do evento' } },
      required: ['event_id'],
    },
  },
  {
    name: 'create_event',
    description: 'Cria um novo evento ao vivo. Campos obrigatórios: title. Recomendado preencher youtube_url, event_start e cta_url.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title:       { type: 'string',  description: 'Título do evento' },
        youtube_url: { type: 'string',  description: 'URL do vídeo no YouTube (ex: https://youtu.be/xxx)' },
        event_start: { type: 'string',  description: 'Data/hora de início ISO 8601 (ex: 2025-09-10T20:00:00-03:00)' },
        event_end:   { type: 'string',  description: 'Data/hora de encerramento ISO 8601' },
        pitch_start: { type: 'string',  description: 'Início do pitch de vendas ISO 8601' },
        pitch_end:   { type: 'string',  description: 'Fim do pitch ISO 8601' },
        cta_url:     { type: 'string',  description: 'URL do botão de compra/CTA' },
        cta_label:   { type: 'string',  description: 'Texto do botão CTA (ex: "Garantir minha vaga")' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_event',
    description: 'Edita campos de um evento existente. Passe apenas os campos que deseja alterar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event_id:    { type: 'string' },
        title:       { type: 'string' },
        youtube_url: { type: 'string' },
        event_start: { type: 'string' },
        event_end:   { type: 'string' },
        pitch_start: { type: 'string' },
        pitch_end:   { type: 'string' },
        cta_url:     { type: 'string' },
        cta_label:   { type: 'string' },
        cta_enabled: { type: 'boolean', description: 'Ativa ou desativa o CTA' },
        status:      { type: 'string',  enum: ['active', 'ended'] },
      },
      required: ['event_id'],
    },
  },

  // ── Comunicações ──
  {
    name: 'list_timelines',
    description: 'Lista todas as timelines de automação configuradas, com suas etapas.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'apply_timeline',
    description: 'Aplica uma timeline a um evento, criando todas as automações de uma vez. Use após criar o evento.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event_id:    { type: 'string', description: 'ID do evento' },
        timeline_id: { type: 'string', description: 'ID da timeline' },
      },
      required: ['event_id', 'timeline_id'],
    },
  },
  {
    name: 'list_automations',
    description: 'Lista automações de um evento. Filtre por event_id para ver o que está ativo.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event_id: { type: 'string', description: 'Filtra por evento (opcional)' },
      },
    },
  },
  {
    name: 'create_automation',
    description: 'Cria uma automação individual em um evento. Prefira apply_timeline para configurar tudo de uma vez.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        event_id:         { type: 'string' },
        label:            { type: 'string', description: 'Nome descritivo da automação' },
        channel:          { type: 'string', enum: ['whatsapp', 'email'] },
        trigger:          { type: 'string', enum: ['registration', 'event_start', 'event_end', 'attended', 'no_show', 'watched_pitch', 'clicked_cta', 'purchased', 'scheduled'] },
        delay_minutes:    { type: 'number', description: 'Minutos após o gatilho (negativo = antes)' },
        template_id:      { type: 'string', description: 'ID do template (obrigatório — use list_templates para obter o ID)' },
        destination:      { type: 'string', enum: ['individual', 'group'], description: 'Destino: individual (padrão) ou group. Obrigatório.' },
        group_id:         { type: 'string', description: 'ID do grupo WhatsApp (quando destination=group)' },
        scheduled_at:     { type: 'string', description: 'ISO 8601 — obrigatório quando trigger=scheduled' },
        audience_list_id: { type: 'string', description: 'ID da lista de destinatários (filtra quem recebe)' },
        exclude_list_id:  { type: 'string', description: 'ID da lista de exclusão (quem não recebe)' },
      },
      required: ['event_id', 'channel', 'trigger', 'template_id', 'destination'],
    },
  },
  {
    name: 'update_automation',
    description: 'Edita uma automação existente. Use para ativar/desativar ou ajustar timing.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        automation_id:    { type: 'string' },
        label:            { type: 'string' },
        channel:          { type: 'string', enum: ['whatsapp', 'email'] },
        trigger:          { type: 'string' },
        delay_minutes:    { type: 'number' },
        template_id:      { type: 'string' },
        destination:      { type: 'string', enum: ['individual', 'group'] },
        group_id:         { type: 'string' },
        scheduled_at:     { type: 'string' },
        audience_list_id: { type: 'string' },
        exclude_list_id:  { type: 'string' },
        active:           { type: 'boolean' },
      },
      required: ['automation_id'],
    },
  },
  {
    name: 'delete_automation',
    description: 'Remove uma automação de um evento.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        automation_id: { type: 'string' },
      },
      required: ['automation_id'],
    },
  },
  {
    name: 'list_templates',
    description: 'Lista templates disponíveis de WhatsApp e e-mail. Filtre por channel se necessário.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel: { type: 'string', enum: ['whatsapp', 'email'], description: 'Filtra por canal (opcional)' },
      },
    },
  },
  {
    name: 'get_template',
    description: 'Retorna o conteúdo completo de um template (body, subject, mídia). Use para ler o que está escrito antes de editar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template_id: { type: 'string', description: 'ID do template' },
      },
      required: ['template_id'],
    },
  },
  {
    name: 'create_template',
    description: 'Cria um novo template de WhatsApp ou e-mail com conteúdo.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        channel:      { type: 'string', enum: ['whatsapp', 'email'], description: 'Canal do template' },
        name:         { type: 'string', description: 'Nome do template' },
        body:         { type: 'string', description: 'Corpo da mensagem. Use {{nome}}, {{evento}} como variáveis.' },
        subject:      { type: 'string', description: 'Assunto (só e-mail)' },
        sender_name:  { type: 'string', description: 'Nome do remetente (só e-mail)' },
        destination:  { type: 'string', enum: ['individual', 'group'], description: 'Destino WhatsApp (padrão: individual)' },
        media_url:    { type: 'string', description: 'URL de mídia opcional (WhatsApp)' },
        media_type:   { type: 'string', enum: ['image', 'video', 'document'], description: 'Tipo de mídia (WhatsApp)' },
        folder_id:    { type: 'string', description: 'ID da pasta (use list_folders ou create_folder)' },
      },
      required: ['channel', 'name', 'body'],
    },
  },
  {
    name: 'update_template',
    description: 'Edita o conteúdo de um template existente. Passe apenas os campos que deseja alterar.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        template_id:  { type: 'string', description: 'ID do template' },
        name:         { type: 'string' },
        body:         { type: 'string', description: 'Novo corpo da mensagem' },
        subject:      { type: 'string', description: 'Novo assunto (e-mail)' },
        sender_name:  { type: 'string', description: 'Nome do remetente (e-mail)' },
        destination:  { type: 'string', enum: ['individual', 'group'] },
        media_url:    { type: 'string' },
        media_type:   { type: 'string', enum: ['image', 'video', 'document'] },
      },
      required: ['template_id'],
    },
  },

  // ── Pastas de templates ──
  {
    name: 'list_folders',
    description: 'Lista as pastas de templates criadas pelo produtor.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'create_folder',
    description: 'Cria uma pasta para organizar templates. Retorna o folder_id para usar em create_template.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Nome da pasta (ex: "Aquecimento", "Pós-live")' },
      },
      required: ['name'],
    },
  },

  // ── Dados ──
  {
    name: 'list_contacts',
    description: 'Lista contatos do produtor com paginação.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        limit:  { type: 'number', description: 'Máximo de resultados (padrão 100, máximo 500)' },
        offset: { type: 'number', description: 'Paginação' },
      },
    },
  },
  {
    name: 'list_contact_lists',
    description: 'Lista as listas de contatos geradas automaticamente após eventos (participantes, pitch, CTA, no-show).',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_integrations',
    description: 'Mostra quais integrações estão ativas (WhatsApp, e-mail, CRM, analytics) e as capacidades disponíveis.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
]

// ── Prompts (guias de fluxo) ─────────────────────────────────────────────────

const PROMPTS = [
  {
    name: 'setup_event',
    description: 'Guia completo para configurar um evento do zero: dados, CTA, automações.',
    arguments: [
      { name: 'event_name', description: 'Nome do evento a criar', required: true },
    ],
  },
  {
    name: 'post_event_followup',
    description: 'Configura automações de follow-up após um evento encerrado (no-show, participantes, compradores).',
    arguments: [
      { name: 'event_id', description: 'ID do evento encerrado', required: true },
    ],
  },
]

// ── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'jotae-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, prompts: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }))

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  if (name === 'setup_event') {
    const eventName = args?.event_name ?? 'novo evento'
    return {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Quero configurar o evento "${eventName}" no Jotae.

Siga estas etapas em ordem:
1. Chame get_setup_status para entender o estado atual da conta
2. Crie o evento com create_event (título, data, YouTube, CTA)
3. Chame list_integrations para saber quais canais estão disponíveis
4. Chame list_timelines para ver timelines existentes
5. Se houver timeline adequada, aplique com apply_timeline
6. Se não, chame list_templates e crie automações individuais com create_automation
7. Confirme o resultado com get_event e list_automations

Seja direto: pergunte apenas o que não consegue inferir.`,
        },
      }],
    }
  }

  if (name === 'post_event_followup') {
    const eventId = args?.event_id ?? ''
    return {
      messages: [{
        role: 'user' as const,
        content: {
          type: 'text' as const,
          text: `Quero configurar o follow-up pós-evento para o evento ${eventId}.

Etapas:
1. Chame get_event_stats para ver quem participou, quem viu o pitch e quem clicou no CTA
2. Chame list_contact_lists para ver as listas geradas (participantes, no-show, pitch, CTA)
3. Chame list_integrations para confirmar canais disponíveis
4. Chame list_templates para ver mensagens disponíveis
5. Crie automações segmentadas com create_automation:
   - Participantes que NÃO clicaram no CTA → lembrete de oferta
   - No-show → mensagem de replay ou segunda chance
   - Compradores (se tiver integração Hotmart) → boas-vindas
6. Confirme com list_automations

Não pergunte o que já sabe pelas chamadas.`,
        },
      }],
    }
  }

  throw new Error(`Prompt "${name}" não encontrado`)
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const a = (args ?? {}) as Record<string, unknown>

  try {
    let result: unknown

    switch (name) {
      case 'get_setup_status':
        result = await api('GET', `/setup-status${a.event_id ? `?event_id=${a.event_id}` : ''}`)
        break
      case 'list_events':
        result = await api('GET', '/events')
        break
      case 'get_event':
        result = await api('GET', `/events/${a.event_id}`)
        break
      case 'get_event_stats':
        result = await api('GET', `/events/${a.event_id}/stats`)
        break
      case 'create_event':
        result = await api('POST', '/events', a)
        break
      case 'update_event': {
        const { event_id, ...patch } = a
        result = await api('PATCH', `/events/${event_id}`, patch)
        break
      }
      case 'list_timelines':
        result = await api('GET', '/timelines')
        break
      case 'apply_timeline':
        result = await api('POST', `/events/${a.event_id}/apply-timeline`, { timeline_id: a.timeline_id })
        break
      case 'list_automations':
        result = await api('GET', `/automations${a.event_id ? `?event_id=${a.event_id}` : ''}`)
        break
      case 'create_automation': {
        // send_time e broadcast_template_id não existem na tabela whatsapp_automations
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { broadcast_template_id: _b, send_time: _s, ...autoBody } = a as Record<string, unknown>
        result = await api('POST', '/automations', autoBody)
        break
      }
      case 'update_automation': {
        const { automation_id, ...patch } = a
        result = await api('PATCH', `/automations/${automation_id}`, patch)
        break
      }
      case 'delete_automation':
        result = await api('DELETE', `/automations/${a.automation_id}`)
        break
      case 'list_templates':
        result = await api('GET', `/templates${a.channel ? `?channel=${a.channel}` : ''}`)
        break
      case 'get_template':
        result = await api('GET', `/templates/${a.template_id}`)
        break
      case 'create_template':
        result = await api('POST', '/templates', a)
        break
      case 'update_template': {
        const { template_id, ...patch } = a
        result = await api('PATCH', `/templates/${template_id}`, patch)
        break
      }
      case 'list_folders':
        result = await api('GET', '/folders')
        break
      case 'create_folder':
        result = await api('POST', '/folders', { name: a.name })
        break
      case 'list_contacts':
        result = await api('GET', `/contacts?limit=${a.limit ?? 100}&offset=${a.offset ?? 0}`)
        break
      case 'list_contact_lists':
        result = await api('GET', '/lists')
        break
      case 'list_integrations':
        result = await api('GET', '/integrations')
        break
      default:
        throw new Error(`Tool desconhecida: ${name}`)
    }

    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
    }
  } catch (e) {
    return {
      content: [{ type: 'text' as const, text: `Erro: ${(e as Error).message}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('Jotae MCP Server iniciado\n')
}

main().catch(e => {
  process.stderr.write(`Erro fatal: ${e}\n`)
  process.exit(1)
})
