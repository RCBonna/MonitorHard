# MonitorHard

Monitor de hardware em tempo real para notebooks e computadores Windows.

O projeto combina uma interface web em React com um agente local responsável por coletar métricas do equipamento. O protótipo atual contém a base visual inicial; a coleta, a API local e o dashboard serão implementados por etapas nas issues do repositório.

## Arquitetura planejada

- `frontend`: dashboard React e visualizações em tempo real.
- `backend`: API local e canal WebSocket.
- Agente Python: coleta de CPU, memória, discos, rede, bateria, processos, GPU e sensores disponíveis.

## Estado atual

Projeto em fase inicial. Consulte as issues para acompanhar o desenvolvimento.

## Segurança

O agente deverá escutar apenas em `127.0.0.1` por padrão. Informações do equipamento não devem ser publicadas na internet sem configuração e autenticação explícitas.

## Licença

Ainda não definida.
