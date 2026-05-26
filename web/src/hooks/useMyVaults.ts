import { useQuery } from '@tanstack/react-query'
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit'
import { fetchVaultsForAddress, type VaultRecord } from '../lib/vaults'

export function useMyVaults() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const packageId = import.meta.env.VITE_MNEMO_PACKAGE_ID as string | undefined
  const address = account?.address

  return useQuery<VaultRecord[]>({
    queryKey: ['vaults', address, packageId],
    queryFn: () => fetchVaultsForAddress(client, packageId!, address!),
    enabled: !!address && !!packageId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })
}
