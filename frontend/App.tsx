import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Activity, BatteryCharging, Cpu, Database, Fan, Gauge, HardDrive, Network, Thermometer } from 'lucide-react'
import type { Metrics } from './types'

const API_URL = 'http://127.0.0.1:8765/api/v1/status'
const WS_URL = 'ws://127.0.0.1:8765/api/v1/metrics'

const clamp = (value: number) => Math.min(100, Math.max(0, value))
const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`
}

function demoMetrics(): Metrics {
  const now = Date.now() / 1000
  const wave = (offset: number, amplitude: number, base: number) => clamp(base + Math.sin(now / 4 + offset) * amplitude)
  return {
    protocolVersion: 1,
    timestamp: new Date().toISOString(),
    hostname: 'NOTEBOOK-DEMO',
    uptimeSeconds: 152403,
    cpu: { usagePercent: wave(0, 12, 34), frequencyMhz: 3280, cores: Array.from({ length: 8 }, (_, i) => wave(i, 18, 30)) },
    memory: { usagePercent: wave(1, 2, 58), usedBytes: 9.3 * 1024 ** 3, totalBytes: 16 * 1024 ** 3 },
    disk: { usagePercent: 63, readBytesPerSecond: wave(2, 8, 12) * 1024 ** 2, writeBytesPerSecond: wave(4, 4, 6) * 1024 ** 2 },
    network: { downloadBytesPerSecond: wave(3, 9, 11) * 1024 ** 2, uploadBytesPerSecond: wave(5, 2, 2.5) * 1024 ** 2 },
    battery: { percent: 78, plugged: true, secondsLeft: null },
    temperatures: { cpuCelsius: wave(0, 4, 61), gpuCelsius: wave(2, 3, 54), storageCelsius: 42 },
    gpu: { name: 'GPU de demonstração', usagePercent: wave(2, 15, 22), memoryUsedMb: 680, memoryTotalMb: 2048, temperatureCelsius: wave(2, 3, 54) },
    fans: [{ name: 'Ventoinha principal', rpm: 2250, source: 'Demonstração' }],
    capabilities: { hardwareSensors: true, sensorSource: 'Demonstração', sensorCount: 18, sensorError: null },
  }
}

function Meter({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'orange' | 'green' }) {
  return <div className="meter" aria-label={`${Math.round(value)}%`}><span className={tone} style={{ width: `${clamp(value)}%` }} /></div>
}

function History({ values }: { values: number[] }) {
  const points = values.map((value, index) => ({
    x: (index / Math.max(1, values.length - 1)) * 100,
    y: 44 - clamp(value) * 0.38,
  }))
  const path = points.reduce((result, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`
    const previous = points[index - 1]
    const before = points[Math.max(0, index - 2)]
    const after = points[Math.min(points.length - 1, index + 1)]
    const tension = 0.18
    const control1 = {
      x: previous.x + (point.x - before.x) * tension,
      y: previous.y + (point.y - before.y) * tension,
    }
    const control2 = {
      x: point.x - (after.x - previous.x) * tension,
      y: point.y - (after.y - previous.y) * tension,
    }
    return `${result} C ${control1.x} ${control1.y}, ${control2.x} ${control2.y}, ${point.x} ${point.y}`
  }, '')
  const guides = [0, 25, 50, 75, 100]

  return (
    <div className="history-wrap">
      <svg className="history" viewBox="0 0 100 48" preserveAspectRatio="none" role="img" aria-label="Histórico de utilização da CPU com referências em 0, 25, 50, 75 e 100 por cento">
        <g className="history-guides">
          {guides.map((guide) => <line key={guide} x1="0" x2="100" y1={44 - guide * 0.38} y2={44 - guide * 0.38} />)}
        </g>
        <path className="history-line" d={path} />
      </svg>
      <div className="history-labels" aria-hidden="true">
        {guides.map((guide) => <span key={guide} style={{ bottom: `${8.33 + guide * 0.792}%` }}>{guide}%</span>)}
      </div>
    </div>
  )
}

export default function App() {
  const [metrics, setMetrics] = useState<Metrics>(() => demoMetrics())
  const [connected, setConnected] = useState(false)
  const [history, setHistory] = useState<number[]>(() => Array(30).fill(28))
  const demoTimer = useRef<number | null>(null)

  useEffect(() => {
    let socket: WebSocket | null = null
    let cancelled = false
    const startDemo = () => {
      if (demoTimer.current) return
      demoTimer.current = window.setInterval(() => setMetrics(demoMetrics()), 1000)
    }
    const connect = async () => {
      try {
        const response = await fetch(API_URL, { signal: AbortSignal.timeout(1200) })
        if (!response.ok) throw new Error('Agente indisponível')
        if (!cancelled) setMetrics(await response.json() as Metrics)
        socket = new WebSocket(WS_URL)
        socket.onopen = () => { setConnected(true); if (demoTimer.current) window.clearInterval(demoTimer.current); demoTimer.current = null }
        socket.onmessage = (event) => setMetrics(JSON.parse(event.data) as Metrics)
        socket.onclose = () => { setConnected(false); startDemo() }
        socket.onerror = () => socket?.close()
      } catch { startDemo() }
    }
    void connect()
    return () => { cancelled = true; socket?.close(); if (demoTimer.current) window.clearInterval(demoTimer.current) }
  }, [])

  useEffect(() => setHistory((current) => [...current.slice(-39), metrics.cpu.usagePercent]), [metrics.cpu.usagePercent])
  const uptime = useMemo(() => `${Math.floor(metrics.uptimeSeconds / 86400)}d ${Math.floor((metrics.uptimeSeconds % 86400) / 3600)}h`, [metrics.uptimeSeconds])

  return (
    <main className="shell">
      <header>
        <div className="brand"><span><Activity size={18} /></span><div><strong>MonitorHard</strong><small>{metrics.hostname}</small></div></div>
        <div className={`status ${connected ? 'online' : ''}`}><i />{connected ? 'Agente conectado' : 'Modo demonstração'}</div>
      </header>

      <section className="intro">
        <div><p>Visão geral</p><h1>Seu notebook, agora.</h1><span>Atualizado {new Date(metrics.timestamp).toLocaleTimeString('pt-BR')} · ligado há {uptime}</span></div>
        <div className="temperature"><Thermometer /><span>CPU</span><strong>{metrics.temperatures.cpuCelsius?.toFixed(0) ?? '—'}°</strong></div>
      </section>

      <section className="primary-grid">
        <article className="cpu-panel">
          <div className="panel-heading"><span><Cpu /> Processador</span><strong>{metrics.cpu.usagePercent.toFixed(0)}%</strong></div>
          <History values={history} />
          <div className="cpu-meta"><span>{metrics.cpu.cores.length} núcleos lógicos</span><span>{metrics.cpu.frequencyMhz ? `${(metrics.cpu.frequencyMhz / 1000).toFixed(2)} GHz` : 'Frequência indisponível'}</span></div>
          <div className="core-grid">{metrics.cpu.cores.map((core, index) => <div key={index}><span>{index + 1}</span><Meter value={core} /></div>)}</div>
        </article>

        <article className="memory-panel">
          <div className="panel-heading"><span><Database /> Memória</span><strong>{metrics.memory.usagePercent.toFixed(0)}%</strong></div>
          <div className="memory-ring" style={{ '--value': `${metrics.memory.usagePercent * 3.6}deg` } as CSSProperties}><div><strong>{formatBytes(metrics.memory.usedBytes)}</strong><span>de {formatBytes(metrics.memory.totalBytes)}</span></div></div>
          <Meter value={metrics.memory.usagePercent} tone="orange" />
        </article>
      </section>

      <section className="detail-strip">
        <article><HardDrive /><div><span>Armazenamento</span><strong>{metrics.disk.usagePercent.toFixed(0)}% ocupado</strong><small>↓ {formatBytes(metrics.disk.readBytesPerSecond)}/s · ↑ {formatBytes(metrics.disk.writeBytesPerSecond)}/s</small></div></article>
        <article><Network /><div><span>Rede</span><strong>↓ {formatBytes(metrics.network.downloadBytesPerSecond)}/s</strong><small>↑ {formatBytes(metrics.network.uploadBytesPerSecond)}/s</small></div></article>
        <article className="battery-detail"><BatteryCharging /><div><span>Bateria</span><strong>{metrics.battery ? `${metrics.battery.percent.toFixed(0)}%` : 'Não detectada'}</strong>{metrics.battery && <Meter value={metrics.battery.percent} tone="green" />}<small>{metrics.battery?.plugged ? 'Conectado à energia' : 'Usando bateria'}</small></div></article>
      </section>

      <section className="sensor-strip">
        <article><Thermometer /><div><span>Armazenamento</span><strong>{metrics.temperatures.storageCelsius != null ? `${metrics.temperatures.storageCelsius.toFixed(0)}°C` : '—'}</strong><small>{metrics.capabilities?.sensorSource ?? 'Aguardando provedor'}</small></div></article>
        <article><Gauge /><div><span>GPU</span><strong>{metrics.gpu?.usagePercent != null ? `${metrics.gpu.usagePercent.toFixed(0)}%` : 'Não disponível'}</strong><small>{metrics.gpu?.name ?? 'Intel Iris Xe · sensor não exposto'}</small></div></article>
        <article><Fan /><div><span>Ventoinhas</span><strong>{metrics.fans?.length ? `${metrics.fans[0].rpm} RPM` : 'Não expostas'}</strong><small>{metrics.fans?.[0]?.name ?? `${metrics.capabilities?.sensorCount ?? 0} sensores encontrados`}</small></div></article>
      </section>

      {!connected && <aside><strong>Dados de demonstração</strong><span>Inicie o agente local para visualizar as métricas reais deste notebook.</span></aside>}
    </main>
  )
}
