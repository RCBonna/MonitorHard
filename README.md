# MonitorHard

Monitor de hardware em tempo real para notebooks e computadores Windows.

O projeto combina uma interface web em React com um agente local responsável por coletar métricas do equipamento. O protótipo atual contém a base visual inicial; a coleta, a API local e o dashboard serão implementados por etapas nas issues do repositório.

## Arquitetura planejada

- `frontend`: dashboard React e visualizações em tempo real.
- `backend`: API local e canal WebSocket.
- Agente Python: coleta de CPU, memória, discos, rede, bateria, processos, GPU e sensores disponíveis.

## Executar o dashboard

```powershell
pnpm install
pnpm dev
```

Sem o agente, o dashboard entra automaticamente em modo demonstração.

## Executar o agente

Consulte [`backend/README.md`](backend/README.md). Depois de iniciado, o dashboard passa a usar as métricas reais via `127.0.0.1:8765`.

## Segurança

O agente deverá escutar apenas em `127.0.0.1` por padrão. Informações do equipamento não devem ser publicadas na internet sem configuração e autenticação explícitas.

## Licença

Ainda não definida.
