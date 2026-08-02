# Agente local

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
```

O agente escuta apenas em `127.0.0.1:8765`. Acesse `http://127.0.0.1:8765/health` para verificar o serviço.
