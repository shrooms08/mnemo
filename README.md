<div align="center">

# Mnemo

**A vault for messages that wait.**

Time-locked, encrypted, built to outlive you.

[Live demo](#) · [Demo video](#) · [Architecture](#architecture)

![Mnemo — A message waiting](./docs/hero-waiting.png)

</div>

---

## Why

I lost my grandpa when I was young. The memories don't disappear all at once — they slip. I don't remember what his voice sounded like anymore. I wish I had a video of him, even a short one. Something to anchor him.

Mnemo is the product I wish had existed for him to use.

It's a vault where you record a message — a video, a voice note, a letter — and seal it to open at a specific moment in the future. On a birthday. On an anniversary. When someone turns eighteen. When you're no longer around to say it yourself.

The message I'd write first is to my future self, telling him I'm proud of the man he became.

---

## What it is

Mnemo is a decentralized application on [Sui](https://sui.io) that holds time-locked messages on behalf of their senders.

You record a message in your browser. It's encrypted on your device with a fresh AES-256 key — Mnemo never sees the plaintext, and neither does anyone else. The encrypted blob is stored on [Walrus](https://walrus.space), Sui's decentralized storage network, durable beyond any single company's lifespan. A smart contract on Sui holds the unlock conditions: a date, a dead-man's switch, or both. When the conditions are met, the recipient connects their wallet, signs an unlock transaction, and the message is decrypted in their browser.

No central server. No trusted operator. No company that has to still exist in twenty years for the message to be delivered.

## What works today

A working dApp on Sui testnet that supports:

- Recording messages as **text, audio, or video** in the browser
- **Client-side AES-GCM 256 encryption** before anything leaves the device
- **Walrus** storage for encrypted blobs
- A **Move smart contract** that holds unlock conditions (time-lock, dead-man's switch, or both — with OR semantics, so either triggers release)
- **Wallet-signed transactions** for seal, unlock, check-in, and cancel
- A **recipient inbox** showing messages addressed to the connected wallet, with the right state at the right time: Waiting (with a serif-italic countdown), Ready, Already Opened
- **Decryption + playback** of all three message kinds when the contract releases the key

Every operation hits real on-chain state. Nothing is mocked.

## Architecture

Three layers, each doing exactly one job.

```
┌─────────────────────────────────────────────────────────────┐
│  Browser  (React + Web Crypto + dapp-kit)                   │
│  ─ recording, encryption, wallet signing, decryption         │
└─────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴────────────────┐
            ▼                                ▼
┌──────────────────────┐         ┌──────────────────────────┐
│  Sui  (Move contract)│         │  Walrus  (encrypted blob)│
│  ─ unlock conditions │         │  ─ durable storage       │
│  ─ encrypted_key     │         │  ─ accessed via Tatum    │
│  ─ events            │         │    RPC for Sui calls     │
└──────────────────────┘         └──────────────────────────┘
```

**The Move contract** defines a `Vault` shared object with the recipient, the Walrus blob ID, the AES key, and the unlock rules (a `unlock_time_ms`, a `requires_checkin` flag with a check-in interval, and a status state machine). Five public entry functions: `seal_vault`, `unlock`, `checkin`, `cancel`, and a `is_unlockable` view helper. Twelve passing Move tests cover every state transition and abort path.

**Walrus** holds the encrypted message. The payload format is a 4-byte `MNMO` magic header, a version byte, a kind byte (text/audio/video), a 12-byte IV, and the AES-GCM ciphertext + tag. The frontend uploads to Walrus's public testnet publisher and fetches from the aggregator on unlock.

**The frontend** is React + Vite + Tailwind. Sui RPC calls flow through **Tatum's hosted Sui gateway**, proxied server-side through Vite's dev server so the Tatum API key stays out of the browser bundle. (For production, that proxy becomes a serverless function.) Wallet integration is via `@mysten/dapp-kit` with `@mysten/sui` 2.x.

### One technical decision worth understanding

Sui shared object fields are world-readable. That means the AES key stored on the `Vault` object is *visible to anyone scanning the chain* the moment the vault is sealed. The Move contract doesn't cryptographically gate access to the key — it gates the *social permission* to use it. A determined recipient could decrypt their message early.

This is honest about the trust model. It's exactly how legacy sealed wills work today — your lawyer *could* open them at any time; they just don't, because the social and legal contract says they shouldn't.

The next version of Mnemo will use [Mysten's Seal](https://github.com/MystenLabs/seal) for threshold-encryption-based cryptographic time-locking, removing the need for a trusted recipient. The current implementation is the right level of complexity for a working v1; Seal is the right v2.

## Running it locally

You'll need:
- Node.js 22+
- The [Sui CLI](https://docs.sui.io/build/install) for contract development
- A Sui browser wallet (we tested with [Slush](https://slush.app)) on testnet
- A free [Tatum API key](https://dashboard.tatum.io) (optional — falls back to public RPC)

```bash
git clone https://github.com/YOUR_USERNAME/mnemo
cd mnemo

# Frontend
cd web
npm install
cp .env.example .env.local
# Edit .env.local with your Tatum API key (optional)
npm run dev
```

The app will be at `http://localhost:5173`. Connect a testnet wallet, request testnet SUI from [faucet.sui.io](https://faucet.sui.io) if needed, and seal your first message.

The Move contract is already deployed to Sui testnet at `0xb6a4cd423e44b985e3e5aee24b555a6b0d7afde2b7c0336c5d8409ea8d866730`. To rebuild or redeploy:

```bash
cd contracts/mnemo
sui move build
sui move test       # all 12 tests should pass
# sui client publish --gas-budget 100000000   # only if redeploying
```

## On-chain artifacts

| | |
|---|---|
| Network | Sui Testnet |
| Package ID | `0xb6a4cd423e44b985e3e5aee24b555a6b0d7afde2b7c0336c5d8409ea8d866730` |
| Module | `mnemo::vault` |
| Walrus publisher | `publisher.walrus-testnet.walrus.space` |
| Walrus aggregator | `aggregator.walrus-testnet.walrus.space` |

## How I built it

This was built over a single sprint for the [Tatum × Walrus Hackathon](https://tatum.io/tatum-x-walrus-hackathon). A short log of the architectural decisions worth remembering:

- **Move contract first, frontend second.** The on-chain data model is the hardest thing to change after the fact, so the entire `Vault` struct, event surface, and function set were designed and tested before any React code existed.
- **OR semantics for unlock conditions.** A vault unlocks if its time-lock expires *or* its dead-man's switch fires. The original draft was AND, which would have blocked the most natural use case ("release at her 18th birthday, or earlier if I'm gone").
- **One-screen design system before any screens.** Newsreader serif for headings, IBM Plex Sans for UI. Paper-and-ink palette with three deliberate accents: Midnight for action, Brass for *waiting*, Sage for *open*. The colors aren't decorative — they're a state machine the user learns by looking.
- **API key never in the browser.** The first pass put the Tatum API key directly in `import.meta.env.VITE_TATUM_API_KEY`, which would have bundled it into the production JS. Replaced with a Vite-server proxy that injects the header server-side. Production migration path is a serverless function with the same logic.
- **Address normalization everywhere.** Sui RPCs return mixed-case addresses inconsistently. Every address comparison routes through `addrEq()` (lowercase + trim). This single helper has prevented at least two real bugs we caught during development.

## What's next

For the people the messages are actually for.

If Mnemo were to live beyond a hackathon, the priorities would be:

- **Seal integration** for cryptographic time-locking with no trusted recipient
- **Multi-recipient vaults** (one message to a family, not a single address)
- **Trustee multi-sig** as a fallback for the dead-man's switch
- **Identity bridges** so people can address messages to phone numbers / emails / human names, with the wallet derivation happening at unlock time
- **Mobile capture** — the most natural way most people would record a message

But the architecture is honest: Sui holds the rules, Walrus holds the bytes, the browser holds the keys, and the people hold the meaning. That doesn't change.

## Credits & thanks

- Built on [Sui](https://sui.io) and [Walrus](https://walrus.space) by [Mysten Labs](https://mystenlabs.com)
- Sui RPC infrastructure by [Tatum](https://tatum.io)
- Typography: [Newsreader](https://fonts.google.com/specimen/Newsreader) by Production Type, [IBM Plex Sans](https://www.ibm.com/plex/) by IBM
- For my grandpa, whose voice I no longer remember.

---

<div align="center">

*Built for the Tatum × Walrus Hackathon, May–June 2026.*

</div>
