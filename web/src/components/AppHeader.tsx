import { useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit'
import { truncateAddress } from '../lib/format'

export function AppHeader() {
  const account = useCurrentAccount()
  const { mutate: disconnect } = useDisconnectWallet()

  return (
    <header className="app-header">
      <span className="wordmark">
        Mn<em>e</em>mo
      </span>
      <nav className="app-header-right">
        <span className="addr">{truncateAddress(account?.address)}</span>
        <span className="sep" />
        <button className="link-quiet" type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      </nav>
    </header>
  )
}
