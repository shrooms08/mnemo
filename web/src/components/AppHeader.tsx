import { NavLink } from 'react-router-dom'
import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit'
import { truncateAddress } from '../lib/format'

export function AppHeader() {
  const account = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()

  return (
    <header className="app-header">
      <NavLink to="/messages" className="wordmark">
        Mn<em>e</em>mo
      </NavLink>
      <nav className="nav-links">
        <NavLink to="/messages" end>
          Your vault
        </NavLink>
        <NavLink to="/inbox">Inbox</NavLink>
      </nav>
      <div className="app-header-right">
        <span className="hairline-sep" aria-hidden="true" />
        <span className="addr">{truncateAddress(account?.address)}</span>
        <span className="sep" />
        <button className="link-quiet" type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    </header>
  )
}
