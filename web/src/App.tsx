import { Navigate, Route, Routes } from 'react-router-dom'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { Landing } from './pages/Landing'
import { VaultList } from './pages/VaultList'
import { Inbox } from './pages/Inbox'
import { InboxDetail } from './pages/InboxDetail'
import { Playback } from './pages/Playback'
import { NewMessageWizard } from './pages/NewMessage/NewMessageWizard'
import { Capture } from './pages/NewMessage/Capture'
import { ConfigureStep } from './pages/NewMessage/ConfigureStep'
import { SealStep } from './pages/NewMessage/SealStep'

function RequireAccount({ children }: { children: React.ReactNode }) {
  const account = useCurrentAccount()
  if (!account) return <Navigate to="/" replace />
  return <>{children}</>
}

function Root() {
  const account = useCurrentAccount()
  if (account) return <Navigate to="/messages" replace />
  return <Landing />
}

function App() {
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
        path="/inbox"
        element={
          <RequireAccount>
            <Inbox />
          </RequireAccount>
        }
      />
      <Route
        path="/inbox/:vaultId"
        element={
          <RequireAccount>
            <InboxDetail />
          </RequireAccount>
        }
      />
      <Route
        path="/inbox/:vaultId/open"
        element={
          <RequireAccount>
            <Playback />
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
        <Route path="capture" element={<Capture />} />
        <Route path="configure" element={<ConfigureStep />} />
        <Route path="seal" element={<SealStep />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
