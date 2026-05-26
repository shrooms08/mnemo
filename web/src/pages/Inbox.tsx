import { useCurrentAccount } from '@mysten/dapp-kit'
import { useMyVaults } from '../hooks/useMyVaults'
import { AppHeader } from '../components/AppHeader'
import { VaultCard } from '../components/VaultCard'
import { addrEq } from '../lib/vaults'

export function Inbox() {
  const { data: vaults, isLoading, isError, refetch } = useMyVaults()
  const account = useCurrentAccount()

  const received = (vaults ?? []).filter(
    (v) => addrEq(v.recipient, account?.address) && v.status !== 'CANCELLED',
  )

  return (
    <>
      <AppHeader />

      <section className="vault-head">
        <div>
          <p className="eyebrow">For you</p>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Messages waiting.
          </h1>
          <p className="body">Sealed for you. Some are open. Some are still waiting.</p>
        </div>
      </section>

      {isLoading && <div className="list-state">Reading the vault…</div>}

      {!isLoading && isError && (
        <div className="list-state">
          Could not reach the vault.
          <button className="try-again" type="button" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      )}

      {!isLoading && !isError && received.length === 0 && (
        <div className="inbox-empty">
          <h1 className="h1">Nothing for you yet.</h1>
          <p className="body">
            When someone seals a message for your address, it will appear here.
          </p>
        </div>
      )}

      {!isLoading && !isError && received.length > 0 && (
        <div className="vault-list">
          {received.map((v) => (
            <VaultCard
              key={v.objectId}
              vault={v}
              viewAs="recipient"
              linkTo={`/inbox/${v.objectId}`}
            />
          ))}
        </div>
      )}
    </>
  )
}
