import { getDiseaseInfo } from '../lib/diseaseInfo'

type DiseaseExplanationProps = {
  className?: string | null
  disease?: string | null
  tone?: 'default' | 'dark'
}

// Renders a plain-language explanation (and scientific name) for a diagnosis,
// so users aren't left Googling a technical label like "corn cercospora leaf
// spot" (see user interviews: Yusei, Jaylen). Renders nothing when there is no
// matching disease or when the leaf is healthy — keeping result UIs uncluttered.
function DiseaseExplanation({
  className,
  disease,
  tone = 'default',
}: DiseaseExplanationProps) {
  const info = getDiseaseInfo(className, disease)
  if (!info) return null
  if (info.label.trim().toLowerCase() === 'healthy') return null

  const bodyClass = tone === 'dark' ? 'text-canvas/90' : 'text-forest-700'
  const sciClass = tone === 'dark' ? 'text-canvas/70' : 'text-muted'

  return (
    <p className={`text-sm leading-6 ${bodyClass}`}>
      {info.explanation}
      {info.scientificName ? (
        <span className={`italic ${sciClass}`}> ({info.scientificName})</span>
      ) : null}
    </p>
  )
}

export default DiseaseExplanation
