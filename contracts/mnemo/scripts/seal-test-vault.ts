import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { SUI_CLOCK_OBJECT_ID, isValidSuiAddress } from '@mysten/sui/utils'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadDeployerKeypair(): Ed25519Keypair {
  const keystorePath = join(homedir(), '.sui', 'sui_config', 'sui.keystore')
  const entries = JSON.parse(readFileSync(keystorePath, 'utf8')) as string[]
  if (entries.length === 0) throw new Error('Empty sui.keystore')
  const decoded = Buffer.from(entries[0], 'base64')
  // First byte is the signature scheme flag (0x00 = ed25519); rest is the 32-byte seed.
  if (decoded.length !== 33 || decoded[0] !== 0x00) {
    throw new Error(`Unexpected keystore entry length=${decoded.length} flag=${decoded[0]}`)
  }
  return Ed25519Keypair.fromSecretKey(new Uint8Array(decoded.subarray(1)))
}

function loadDeployment(): { network: string; packageId: string } {
  const path = join(__dirname, '..', 'deployments', 'testnet.json')
  return JSON.parse(readFileSync(path, 'utf8'))
}

function getRecipient(): string {
  const r = process.env.RECIPIENT ?? process.argv[2]
  if (!r) {
    console.error('Usage: RECIPIENT=<0x...> npm run seal-test-vault')
    process.exit(1)
  }
  if (!isValidSuiAddress(r)) {
    console.error(`Not a valid Sui address: ${r}`)
    process.exit(1)
  }
  return r
}

async function main() {
  const recipient = getRecipient()
  const { network, packageId } = loadDeployment()
  const keypair = loadDeployerKeypair()
  const sender = keypair.getPublicKey().toSuiAddress()

  console.log(`Network:   ${network}`)
  console.log(`Package:   ${packageId}`)
  console.log(`Sender:    ${sender}`)
  console.log(`Recipient: ${recipient}`)

  const client = new SuiJsonRpcClient({
    network: 'testnet',
    url: getJsonRpcFullnodeUrl('testnet'),
  })

  const unlockTimeMs = BigInt(Date.now() + 60_000)
  const encryptedKey = new Uint8Array(randomBytes(32))

  const tx = new Transaction()
  tx.moveCall({
    target: `${packageId}::vault::seal_vault`,
    arguments: [
      tx.pure.address(recipient),
      tx.pure.string('placeholder-blob-id-test'),
      tx.pure.vector('u8', Array.from(encryptedKey)),
      tx.pure.string('Test message from CLI'),
      tx.pure.u64(unlockTimeMs),
      tx.pure.bool(false),
      tx.pure.u64(0n),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  })

  const result = await client.signAndExecuteTransaction({
    signer: keypair,
    transaction: tx,
    options: { showObjectChanges: true, showEffects: true },
  })

  const status = result.effects?.status?.status
  if (status !== 'success') {
    console.error('Transaction failed:', result.effects?.status)
    process.exit(1)
  }

  const created = result.objectChanges?.find(
    (c) => c.type === 'created' && c.objectType === `${packageId}::vault::Vault`,
  )
  const vaultId = created && 'objectId' in created ? created.objectId : '(unknown)'

  console.log('')
  console.log(`Vault sealed`)
  console.log(`  objectId: ${vaultId}`)
  console.log(`  digest:   ${result.digest}`)
  console.log(`  unlocks:  ${new Date(Number(unlockTimeMs)).toISOString()}`)
  console.log(`  explorer: https://suiscan.xyz/testnet/tx/${result.digest}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
