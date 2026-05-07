import type { Verdict } from '../lib/scoring'
import { VetoIcon, WaitIcon, GoIcon } from './Icons'

interface Props {
  verdict: Verdict
  size?: 'sm' | 'lg'
  ghost?: boolean
}

const CONFIG: Record<Verdict, { label: string; badge: string; ghostBadge: string; Icon: () => JSX.Element }> = {
  veto: {
    label: 'Не покупай',
    badge: 'bg-secondary text-white',
    ghostBadge: 'bg-white/25 text-white backdrop-blur-sm',
    Icon: () => <VetoIcon size={12} />,
  },
  wait: {
    label: 'Подожди',
    badge: 'bg-[#FF9E30] text-white',
    ghostBadge: 'bg-white/25 text-white backdrop-blur-sm',
    Icon: () => <WaitIcon size={12} />,
  },
  go: {
    label: 'Купи',
    badge: 'bg-primary text-white',
    ghostBadge: 'bg-white/25 text-white backdrop-blur-sm',
    Icon: () => <GoIcon size={12} />,
  },
}

export default function VerdictBadge({ verdict, size = 'sm', ghost = false }: Props) {
  const cfg = CONFIG[verdict] ?? CONFIG.wait
  const cls = ghost ? cfg.ghostBadge : cfg.badge
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold rounded-full uppercase tracking-wide ${cls} ${size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2.5 py-1'}`}>
      <cfg.Icon />
      {cfg.label}
    </span>
  )
}
