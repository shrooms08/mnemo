import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import { VaultList } from './pages/VaultList'
import { NewMessageWizard } from './pages/NewMessage/NewMessageWizard'
import { CaptureStep } from './pages/NewMessage/CaptureStep'
import { ConfigureStep } from './pages/NewMessage/ConfigureStep'
import { SealStep } from './pages/NewMessage/SealStep'

function ConnectScreen() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--s7)',
        padding: 'var(--s7)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--serif)',
          fontWeight: 400,
          fontSize: 76,
          letterSpacing: '-0.026em',
          margin: 0,
        }}
      >
        Mn<em style={{ color: 'var(--midnight)', fontStyle: 'italic' }}>e</em>mo
      </h1>
      <p className="body" style={{ maxWidth: '36ch', textAlign: 'center' }}>
        A vault for messages that wait.
      </p>
      <ConnectButton />
    </main>
  )
}

function RequireAccount({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount()
  if (!account) return <Navigate to="/" replace />
  return <>{children}</>
}

function Root() {
  const account = useCurrentAccount()
  if (account) return <Navigate to="/messages" replace />
  return <ConnectScreen />
}

function App() {
  const navigate = useNavigate()
  void navigate
  return (
    <Routes>
      <Route path="/" element={<Root />} />
      <Route
        path="/messages"
        element={
          <RequireAccount>
            <VaultList />
          </RequireAccount>
        }
      />
      <Route
        path="/new"
        element={
          <RequireAccount>
            <NewMessageWizard />
          </RequireAccount>
        }
      >
        <Route index element={<Navigate to="/new/capture" replace />} />
        <Route path="capture" element={<CaptureStep />} />
        <Route path="configure" element={<ConfigureStep />} />
        <Route path="seal" element={<SealStep />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
