# Agente local

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

O agente escuta apenas em `127.0.0.1:8765`. Acesse `http://127.0.0.1:8765/health` para verificar o serviço.

## Sensores de temperatura, GPU e ventoinhas

O helper usa a biblioteca oficial LibreHardwareMonitor. Compile uma vez:

```powershell
dotnet publish sensors/MonitorHard.Sensors.csproj -c Release -r win-x64
```

Reinicie o agente depois da compilação. Alguns sensores de baixo nível podem exigir que o terminal seja aberto como administrador. A API informa a disponibilidade e a origem em `capabilities`.
