# jotae-mcp

MCP Server oficial do [Jotae](https://app.jotae.me) para Claude Desktop e Claude.ai.

Conecta o Claude ao Jotae para criar eventos, configurar automações de WhatsApp e e-mail, e ler métricas — tudo por texto ou voz.

## O que o agente consegue fazer

- Criar e editar eventos ao vivo
- Configurar data, link do YouTube, pitch e CTA
- Aplicar timelines de automação completas a um evento
- Criar automações individuais segmentadas (participantes, no-show, compradores)
- Ler métricas: presença, pitch, cliques no CTA, taxa de conversão
- Ver integrações ativas (WhatsApp, e-mail, CRM)
- Acessar contatos e listas geradas por evento

## Instalação

### 1. Gere sua chave de API

Acesse **Configurações > Integrações > Claude AI (MCP)** no Jotae e gere uma chave `jotae_sk_...`.

### 2. Configure o Claude Desktop

Edite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "jotae": {
      "command": "npx",
      "args": ["jotae-mcp"],
      "env": {
        "JOTAE_API_KEY": "jotae_sk_SUA_CHAVE_AQUI"
      }
    }
  }
}
```

Reinicie o Claude Desktop. O ícone de ferramentas aparece nas conversas.

### 3. (Opcional) URL customizada

Se você usa domínio próprio:

```json
"env": {
  "JOTAE_API_KEY": "jotae_sk_...",
  "JOTAE_BASE_URL": "https://app.seudominio.com"
}
```

## Como usar

Abra o Claude Desktop e use os prompts prontos:

- **"Configurar novo evento"** — guia completo do zero
- **"Follow-up pós-evento"** — automações segmentadas pós-live

Ou chame diretamente:

> "Cria um evento chamado 'Masterclass de Vendas' para 15 de setembro às 20h com CTA para minha página de vendas"

> "Quais eventos tenho cadastrados e qual a taxa de conversão do último?"

> "Aplica a timeline 'Lançamento Padrão' no evento X"

## Ferramentas disponíveis

| Tool | O que faz |
|---|---|
| `get_setup_status` | Diagnóstico completo da conta |
| `list_events` | Lista eventos |
| `get_event` | Detalhes de um evento |
| `get_event_stats` | Métricas de presença e conversão |
| `create_event` | Cria evento |
| `update_event` | Edita evento |
| `list_timelines` | Lista timelines com etapas |
| `apply_timeline` | Aplica timeline a um evento |
| `list_automations` | Lista automações de um evento |
| `create_automation` | Cria automação individual |
| `update_automation` | Edita/ativa/desativa automação |
| `delete_automation` | Remove automação |
| `list_templates` | Lista templates WhatsApp e e-mail |
| `list_contacts` | Lista contatos |
| `list_contact_lists` | Lista de segmentos pós-evento |
| `list_integrations` | Integrações ativas e capacidades |

## Desenvolvimento local

```bash
git clone https://github.com/jackemerick/jotae-mcp
cd jotae-mcp
npm install
JOTAE_API_KEY=jotae_sk_... npm run dev
```

## Licença

MIT
