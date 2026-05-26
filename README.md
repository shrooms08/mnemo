# Mnemo

Time-locked messages on Sui. Record a video, audio, or text message, encrypt it
client-side, store the encrypted blob on Walrus, and let a Sui Move contract
release the decryption key when a condition is met — a future date, a dead-man's
switch, or another trigger.

Built for the Tatum x Walrus Hackathon.

## Repo layout

```
contracts/mnemo/   Sui Move package
web/               Vite + React + TypeScript frontend
```

## Contracts

```bash
cd contracts/mnemo
sui move build
```

Requires the `sui` CLI. The package targets testnet.

## Web

```bash
cd web
npm install   # first time only
npm run dev
```

Stack: Vite, React, TypeScript, Tailwind CSS v4, `@mysten/sui`, `@mysten/dapp-kit`.

## What's next

- [ ] Define the `Vault` object and time-lock logic in `vault.move`
- [ ] Client-side encryption of message payloads
- [ ] Walrus upload integration
- [ ] Wallet connection via `@mysten/dapp-kit`
- [ ] Key release flow once unlock condition is met
