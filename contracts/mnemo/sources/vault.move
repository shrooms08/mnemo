module mnemo::vault;

use std::string::String;
use sui::clock::{Self, Clock};
use sui::event;

const STATUS_SEALED: u8 = 0;
const STATUS_UNLOCKED: u8 = 1;
const STATUS_CANCELLED: u8 = 2;

const ENotCreator: u64 = 1;
const ENotRecipient: u64 = 2;
const EWrongStatus: u64 = 3;
const ENotUnlockable: u64 = 4;
const ECheckinNotActive: u64 = 5;
const EInvalidCheckinConfig: u64 = 6;
const ENoUnlockCondition: u64 = 7;

public struct Vault has key {
    id: UID,
    creator: address,
    recipient: address,
    walrus_blob_id: String,
    encrypted_key: vector<u8>,
    title: String,
    unlock_time_ms: u64,
    requires_checkin: bool,
    checkin_interval_ms: u64,
    last_checkin_ms: u64,
    status: u8,
    created_at_ms: u64,
}

public struct VaultSealed has copy, drop {
    vault_id: ID,
    creator: address,
    recipient: address,
    unlock_time_ms: u64,
    requires_checkin: bool,
}

public struct VaultCheckedIn has copy, drop {
    vault_id: ID,
    timestamp: u64,
}

public struct VaultUnlocked has copy, drop {
    vault_id: ID,
    recipient: address,
    encrypted_key: vector<u8>,
}

public struct VaultCancelled has copy, drop {
    vault_id: ID,
}

/// Seal a new time-locked vault as a shared object. Callable by anyone;
/// the caller becomes the creator and only `recipient` can later unlock it.
public fun seal_vault(
    recipient: address,
    walrus_blob_id: String,
    encrypted_key: vector<u8>,
    title: String,
    unlock_time_ms: u64,
    requires_checkin: bool,
    checkin_interval_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(
        !(unlock_time_ms == 0 && !requires_checkin),
        ENoUnlockCondition,
    );
    assert!(
        !(requires_checkin && checkin_interval_ms == 0),
        EInvalidCheckinConfig,
    );

    let now = clock::timestamp_ms(clock);
    let vault = Vault {
        id: object::new(ctx),
        creator: tx_context::sender(ctx),
        recipient,
        walrus_blob_id,
        encrypted_key,
        title,
        unlock_time_ms,
        requires_checkin,
        checkin_interval_ms,
        last_checkin_ms: now,
        status: STATUS_SEALED,
        created_at_ms: now,
    };

    event::emit(VaultSealed {
        vault_id: object::id(&vault),
        creator: vault.creator,
        recipient: vault.recipient,
        unlock_time_ms: vault.unlock_time_ms,
        requires_checkin: vault.requires_checkin,
    });

    transfer::share_object(vault);
}

/// Refresh the dead-man's-switch timer. Only the creator may call, and only
/// while the vault is still sealed and has check-in enabled.
public fun checkin(vault: &mut Vault, clock: &Clock, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == vault.creator, ENotCreator);
    assert!(vault.status == STATUS_SEALED, EWrongStatus);
    assert!(vault.requires_checkin, ECheckinNotActive);

    let now = clock::timestamp_ms(clock);
    vault.last_checkin_ms = now;

    event::emit(VaultCheckedIn { vault_id: object::id(vault), timestamp: now });
}

/// Mark the vault unlocked and broadcast the encrypted key via event.
/// Only the recipient may call, and only once unlock conditions are met.
public fun unlock(vault: &mut Vault, clock: &Clock, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == vault.recipient, ENotRecipient);
    assert!(vault.status == STATUS_SEALED, EWrongStatus);
    assert!(is_unlockable(vault, clock), ENotUnlockable);

    vault.status = STATUS_UNLOCKED;

    event::emit(VaultUnlocked {
        vault_id: object::id(vault),
        recipient: vault.recipient,
        encrypted_key: vault.encrypted_key,
    });
}

/// Permanently cancel a sealed vault. Only the creator may call.
public fun cancel(vault: &mut Vault, ctx: &TxContext) {
    assert!(tx_context::sender(ctx) == vault.creator, ENotCreator);
    assert!(vault.status == STATUS_SEALED, EWrongStatus);

    vault.status = STATUS_CANCELLED;

    event::emit(VaultCancelled { vault_id: object::id(vault) });
}

/// Pure view: is this vault eligible to be unlocked right now?
/// Returns true iff status is sealed, the unlock time has passed, and
/// (if check-in is required) the creator's check-in window has elapsed.
public fun is_unlockable(vault: &Vault, clock: &Clock): bool {
    if (vault.status != STATUS_SEALED) return false;
    let now = clock::timestamp_ms(clock);
    let unlock_time_passed = vault.unlock_time_ms > 0 && now >= vault.unlock_time_ms;
    let deadman_fired =
        vault.requires_checkin && now - vault.last_checkin_ms > vault.checkin_interval_ms;
    unlock_time_passed || deadman_fired
}

#[test_only]
public fun status_for_testing(v: &Vault): u8 { v.status }

#[test_only]
public fun last_checkin_ms_for_testing(v: &Vault): u64 { v.last_checkin_ms }

#[test_only]
public fun e_not_creator(): u64 { ENotCreator }
#[test_only]
public fun e_not_recipient(): u64 { ENotRecipient }
#[test_only]
public fun e_wrong_status(): u64 { EWrongStatus }
#[test_only]
public fun e_not_unlockable(): u64 { ENotUnlockable }
#[test_only]
public fun e_checkin_not_active(): u64 { ECheckinNotActive }
#[test_only]
public fun e_invalid_checkin_config(): u64 { EInvalidCheckinConfig }

#[test_only]
public fun status_sealed(): u8 { STATUS_SEALED }
#[test_only]
public fun status_unlocked(): u8 { STATUS_UNLOCKED }
#[test_only]
public fun status_cancelled(): u8 { STATUS_CANCELLED }
