import { useState, useEffect } from 'react'

type CountdownProps = {
  targetISO: string
  onComplete?: () => void
}

export function Countdown({ targetISO, onComplete }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const calculateTimeLeft = () => {
      const target = new Date(targetISO).getTime()
      const now = new Date().getTime()
      const difference = target - now

      if (difference <= 0) {
        setTimeLeft('00:00')
        if (!isComplete) {
          setIsComplete(true)
          onComplete?.()
        }
        return
      }

      const hours = Math.floor(difference / (1000 * 60 * 60))
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((difference % (1000 * 60)) / 1000)

      const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      setTimeLeft(formatted)
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [targetISO, onComplete, isComplete])

  return (
    <div className="flex items-center space-x-2">
      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="font-mono text-lg font-semibold">{timeLeft || '00:00:00'}</span>
    </div>
  )
}
