export type Metrics = {
  protocolVersion: 1
  timestamp: string
  hostname: string
  uptimeSeconds: number
  cpu: { usagePercent: number; frequencyMhz: number | null; cores: number[] }
  memory: { usagePercent: number; usedBytes: number; totalBytes: number }
  disk: { usagePercent: number; readBytesPerSecond: number; writeBytesPerSecond: number }
  network: { downloadBytesPerSecond: number; uploadBytesPerSecond: number }
  battery: { percent: number; plugged: boolean; secondsLeft: number | null } | null
  temperatures: { cpuCelsius: number | null; gpuCelsius: number | null }
}
