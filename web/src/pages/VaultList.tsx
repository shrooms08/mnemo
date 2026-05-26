import { useNavigate } from 'react-router-dom'
import { useCurrentAccount } from '@mysten/dapp-kit'
import { useMyVaults } from '../hooks/useMyVaults'
import { AppHeader } from '../components/AppHeader'
import { VaultCard } from '../components/VaultCard'
import { EmptyState } from '../components/EmptyState'
import { addrEq } from '../lib/vaults'

export function VaultList() {
  const { data: vaults, isLoading, isError, refetch } = useMyVaults()
  const account = useCurrentAccount()
  const navigate = useNavigate()
  const onSealClick = () => navigate('/new/capture')

  const sent = (vaults ?? []).filter((v) => addrEq(v.creator, account?.address))

  return (
    <>
      <AppHeader />

      <section className="vault-head">
        <div>
          <p className="eyebrow">Your vault</p>
          <h1 className="h1" style={{ marginTop: 12 }}>
            Your messages.
          </h1>
          <p className="body">Messages you have sealed. They wait until their time.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={onSealClick}>
          Seal a new message
        </button>
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

      {!isLoading && !isError && sent.length === 0 && <EmptyState onSeal={onSealClick} />}

      {!isLoading && !isError && sent.length > 0 && (
        <div className="vault-list">
          {sent.map((v) => (
            <VaultCard key={v.objectId} vault={v} viewAs="creator" />
          ))}
        </div>
      )}

      <footer className="tagline-footer">
        Built on Sui · Stored on Walrus · Powered by Tatum
      </footer>
    </>
  )
}
