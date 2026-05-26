import { ConnectModal } from '@mysten/dapp-kit'
import { useState } from 'react'

export function Landing() {
  const [modalOpen, setModalOpen] = useState(false)

  function scrollToUseCases() {
    document
      .getElementById('how-it-works')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <ConnectModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        trigger={<TriggerHidden />}
      />
      <main>
        <header className="app-header landing-header">
          <span className="wordmark">
            Mn<em>e</em>mo
          </span>
          <nav className="landing-nav">
            <button type="button" className="link-quiet" onClick={scrollToUseCases}>
              How it works
            </button>
            <span className="sep" />
            <button
              type="button"
              className="link-quiet"
              onClick={() => setModalOpen(true)}
            >
              Connect wallet
            </button>
          </nav>
        </header>

        <section className="s1-hero">
          <div>
            <p className="eyebrow">01 · A vault for messages that wait</p>
            <h1>
              Leave a message for someone — in a year, in a decade, in a{' '}
              <em>lifetime</em>.
            </h1>
            <p className="body">
              Record a video, a voice note, or a letter. Choose who it is for, and when it
              should open. Mnemo holds it, encrypted, until its time. Some messages are
              read tomorrow. Some are read in 2065.
            </p>
            <button
              type="button"
              className="link-primary"
              onClick={() => setModalOpen(true)}
            >
              Connect your wallet to begin <span className="arrow">→</span>
            </button>
          </div>
          <div className="figure" aria-hidden="true">
            <div className="corner-l">Sealed · Edition 01</div>
            <div className="corner-r">No. 0017</div>
            <div className="hair top" />
            <div className="hair bot" />
            <div className="seal-mark">
              <span className="year">MMXXVI</span>M
            </div>
          </div>
        </section>

        <section className="s1-three" id="how-it-works">
          <div className="col">
            <span className="glyph">τ</span>
            <h3>Time-locked messages</h3>
            <p>
              Choose a date — a birthday, an anniversary, a year — and seal a message that
              cannot be opened until then.
            </p>
          </div>
          <div className="col">
            <span className="glyph brass">§</span>
            <h3>Posthumous releases</h3>
            <p>
              Set a quiet check-in. If you stop responding, your messages release
              themselves — to the people you chose.
            </p>
          </div>
          <div className="col">
            <span className="glyph sage">△</span>
            <h3>Conditional unlocks</h3>
            <p>
              Tie a message to a milestone — a wedding day, a graduation, a child's
              eighteenth birthday. It opens when the day arrives.
            </p>
          </div>
        </section>

        <section className="s1-quote">
          <p className="eyebrow midnight" style={{ marginBottom: 32 }}>
            The promise
          </p>
          <p className="h2">
            Once a message is sealed, it cannot be edited or opened until its appointed
            time. You can change who receives it; you cannot change <em>what it says</em>.
          </p>
        </section>

        <footer className="s1-footer">
          <div>
            Mnemo &nbsp;·&nbsp; <span style={{ color: 'var(--ink)' }}>An archive for tomorrow.</span>
          </div>
          <div className="right">
            <span>Built on Sui</span>
            <span>Stored on Walrus</span>
            <span>Powered by Tatum</span>
          </div>
        </footer>
      </main>
    </>
  )
}

// ConnectModal requires a `trigger` ReactNode. We control open state programmatically
// (via the two visible buttons above), so the trigger is a hidden span.
function TriggerHidden() {
  return <span hidden aria-hidden="true" />
}
