type HelpTipProps = {
  label: string
  children: string
}

function HelpTip({ label, children }: HelpTipProps) {
  return (
    <details className="relative inline-block">
      <summary className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full bg-leaf-300/20 text-xs font-black text-forest-700 ring-1 ring-stroke transition hover:bg-leaf-300/30 [&::-webkit-details-marker]:hidden">
        ?
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-stroke bg-white p-3 text-left shadow-xl shadow-[#16351f]/10">
        <p className="text-xs font-black uppercase text-leaf-500">{label}</p>
        <p className="mt-1 text-sm leading-5 text-muted">{children}</p>
      </div>
    </details>
  )
}

export default HelpTip
