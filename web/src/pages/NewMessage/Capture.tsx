import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWizard } from './hooks'
import { TextCapture } from './captures/TextCapture'
import { AudioCapture } from './captures/AudioCapture'
import { VideoCapture } from './captures/VideoCapture'

type Tab = 'video' | 'audio' | 'letter'

function tabFromPlaintext(kind: 'text' | 'audio' | 'video' | undefined): Tab {
  if (kind === 'audio') return 'audio'
  if (kind === 'video') return 'video'
  return 'letter'
}

export function Capture() {
  const { state } = useWizard()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>(tabFromPlaintext(state.plaintext?.kind))

  const canContinue = state.plaintext !== null

  const headerCopy = (() => {
    if (tab === 'letter') {
      return {
        h1: 'Write your message.',
        sub: 'Take your time. This will be encrypted on your device before it leaves.',
      }
    }
    return {
      h1: 'Record your message.',
      sub: 'Take your time. This will be encrypted on your device before it leaves.',
    }
  })()

  function onContinue() {
    if (!canContinue) return
    navigate('/new/configure')
  }

  return (
    <>
      <div className="flow-head">
        <div>
          <p className="eyebrow brass">Step 1 of 3 · Capture</p>
          <h1 className="h1">{headerCopy.h1}</h1>
          <p className="body">{headerCopy.sub}</p>
        </div>
        <div className="right">
          <p className="eyebrow">Recipient (TBD)</p>
          <p className="small" style={{ marginTop: 8 }}>
            You'll choose who this is for next.
          </p>
        </div>
      </div>

      <div className="flow-body">
        <div className="tabs" role="tablist">
          <button
            className={`tab${tab === 'video' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('video')}
            role="tab"
            aria-selected={tab === 'video'}
          >
            Video
          </button>
          <button
            className={`tab${tab === 'audio' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('audio')}
            role="tab"
            aria-selected={tab === 'audio'}
          >
            Audio
          </button>
          <button
            className={`tab${tab === 'letter' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setTab('letter')}
            role="tab"
            aria-selected={tab === 'letter'}
          >
            Letter
          </button>
        </div>

        {tab === 'letter' && <TextCapture />}
        {tab === 'audio' && <AudioCapture />}
        {tab === 'video' && <VideoCapture />}

        <p className="privacy-note">Encrypted on this device. Never seen by us.</p>
      </div>

      <div className="flow-footer">
        <button className="btn-ghost" type="button" onClick={() => navigate('/messages')}>
          ← Back
        </button>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
        >
          Continue
        </button>
      </div>
    </>
  )
}
