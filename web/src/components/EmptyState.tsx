type Props = {
  onSeal?: () => void
}

export function EmptyState({ onSeal }: Props) {
  return (
    <div className="empty-state">
      <p className="eyebrow" style={{ marginBottom: 24 }}>
        Your vault
      </p>
      <h1 className="h1">Nothing sealed yet.</h1>
      <p className="body">When you record a message and seal it, it will wait here.</p>
      <button
        className="link-primary"
        type="button"
        onClick={() => (onSeal ? onSeal() : console.log('TODO: seal flow'))}
      >
        Seal your first message <span className="arrow">→</span>
      </button>
    </div>
  )
}
