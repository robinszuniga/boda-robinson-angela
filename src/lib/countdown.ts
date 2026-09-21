export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  isPast: boolean
}

export function getCountdown(target: Date, now: Date = new Date()): Countdown {
  const diff = target.getTime() - now.getTime()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true }
  const totalSeconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    isPast: false,
  }
}
