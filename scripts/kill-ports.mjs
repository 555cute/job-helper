import { execSync } from 'node:child_process'

const ports = process.argv.slice(2).map(Number).filter(Boolean)
if (!ports.length) process.exit(0)

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' })
      const pids = new Set()
      for (const line of out.split(/\r?\n/)) {
        if (!line.includes('LISTENING')) continue
        const parts = line.trim().split(/\s+/)
        const pid = parts[parts.length - 1]
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
          console.log(`[kill-ports] freed :${port} (pid ${pid})`)
        } catch {
          /* ignore */
        }
      }
    } else {
      execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: 'ignore' })
      console.log(`[kill-ports] freed :${port}`)
    }
  } catch {
    /* nothing listening */
  }
}

for (const p of ports) killPort(p)
