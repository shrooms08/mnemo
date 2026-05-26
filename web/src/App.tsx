import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit'
import { VaultList } from './pages/VaultList'

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

function App() {
  const account = useCurrentAccount()
  if (!account) return <ConnectScreen />
  return <VaultList />
}

export default App
