#[test_only]
module mnemo::vault_tests;

use std::string;
use sui::clock::{Self, Clock};
use sui::test_scenario::{Self as ts, Scenario};
use mnemo::vault::{Self, Vault};

const CREATOR: address = @0xCAFE;
const RECIPIENT: address = @0xBEEF;
const OTHER: address = @0xDEAD;

const T0: u64 = 1_000_000;

fun new_scenario_with_clock(): Scenario {
    let mut scenario = ts::begin(CREATOR);
    {
        let ctx = ts::ctx(&mut scenario);
        let mut clock = clock::create_for_testing(ctx);
        clock::set_for_testing(&mut clock, T0);
        clock::share_for_testing(clock);
    };
    scenario
}

fun set_clock(scenario: &mut Scenario, ms: u64) {
    ts::next_tx(scenario, CREATOR);
    let mut clock = ts::take_shared<Clock>(scenario);
    clock::set_for_testing(&mut clock, ms);
    ts::return_shared(clock);
}

fun seal(
    scenario: &mut Scenario,
    unlock_time_ms: u64,
    requires_checkin: bool,
    checkin_interval_ms: u64,
) {
    ts::next_tx(scenario, CREATOR);
    let clock = ts::take_shared<Clock>(scenario);
    vault::seal_vault(
        RECIPIENT,
        string::utf8(b"walrus-blob-id"),
        b"encrypted-key-bytes",
        string::utf8(b"For Maya"),
        unlock_time_ms,
        requires_checkin,
        checkin_interval_ms,
        &clock,
        ts::ctx(scenario),
    );
    ts::return_shared(clock);
}

#[test]
fun test_unlock_time_only_happy_path() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0 - 1, false, 0);

    ts::next_tx(&mut scenario, RECIPIENT);
    {
        let mut v = ts::take_shared<Vault>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
        assert!(vault::status_for_testing(&v) == vault::status_unlocked(), 0);
        ts::return_shared(v);
        ts::return_shared(clock);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::ENotUnlockable)]
fun test_reject_early_unlock() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0 + 1_000_000, false, 0);

    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
fun test_deadman_fires() {
    let mut scenario = new_scenario_with_clock();
    let interval = 10_000u64;
    // unlock_time far in the future so only the deadman path can unlock.
    let far_future = T0 + 1_000_000_000;
    seal(&mut scenario, far_future, true, interval);

    set_clock(&mut scenario, T0 + interval + 1);

    ts::next_tx(&mut scenario, RECIPIENT);
    {
        let mut v = ts::take_shared<Vault>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
        assert!(vault::status_for_testing(&v) == vault::status_unlocked(), 0);
        ts::return_shared(v);
        ts::return_shared(clock);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::ENotUnlockable)]
fun test_deadman_blocks_unlock() {
    let mut scenario = new_scenario_with_clock();
    let interval = 10_000u64;
    // unlock_time far in the future so only the deadman path is in play.
    let far_future = T0 + 1_000_000_000;
    seal(&mut scenario, far_future, true, interval);

    set_clock(&mut scenario, T0 + 5_000);
    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut v = ts::take_shared<Vault>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        vault::checkin(&mut v, &clock, ts::ctx(&mut scenario));
        ts::return_shared(v);
        ts::return_shared(clock);
    };

    set_clock(&mut scenario, T0 + 12_000);
    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::ENotRecipient)]
fun test_wrong_recipient() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0 - 1, false, 0);

    ts::next_tx(&mut scenario, OTHER);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::ENotCreator)]
fun test_wrong_creator_checkin() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0, true, 10_000);

    ts::next_tx(&mut scenario, OTHER);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::checkin(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::EWrongStatus)]
fun test_cancel_then_unlock_fails() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0 - 1, false, 0);

    ts::next_tx(&mut scenario, CREATOR);
    {
        let mut v = ts::take_shared<Vault>(&scenario);
        vault::cancel(&mut v, ts::ctx(&mut scenario));
        assert!(vault::status_for_testing(&v) == vault::status_cancelled(), 0);
        ts::return_shared(v);
    };

    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::EWrongStatus)]
fun test_double_unlock_fails() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0 - 1, false, 0);

    ts::next_tx(&mut scenario, RECIPIENT);
    {
        let mut v = ts::take_shared<Vault>(&scenario);
        let clock = ts::take_shared<Clock>(&scenario);
        vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
        ts::return_shared(v);
        ts::return_shared(clock);
    };

    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::EInvalidCheckinConfig)]
fun test_invalid_config_aborts() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, T0, true, 0);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = ::mnemo::vault::ENoUnlockCondition)]
fun test_no_unlock_condition_aborts() {
    let mut scenario = new_scenario_with_clock();
    seal(&mut scenario, 0, false, 0);
    ts::end(scenario);
}

#[test]
fun test_either_condition_unlocks_via_time() {
    // Both gates set. Advance past unlock_time but NOT past the checkin window.
    let mut scenario = new_scenario_with_clock();
    let interval = 1_000_000u64;
    seal(&mut scenario, T0 + 5_000, true, interval);

    set_clock(&mut scenario, T0 + 6_000);

    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    assert!(vault::status_for_testing(&v) == vault::status_unlocked(), 0);
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}

#[test]
fun test_either_condition_unlocks_via_deadman() {
    // Both gates set. Advance past checkin window but NOT past unlock_time.
    let mut scenario = new_scenario_with_clock();
    let interval = 10_000u64;
    let far_future = T0 + 1_000_000_000;
    seal(&mut scenario, far_future, true, interval);

    set_clock(&mut scenario, T0 + interval + 1);

    ts::next_tx(&mut scenario, RECIPIENT);
    let mut v = ts::take_shared<Vault>(&scenario);
    let clock = ts::take_shared<Clock>(&scenario);
    vault::unlock(&mut v, &clock, ts::ctx(&mut scenario));
    assert!(vault::status_for_testing(&v) == vault::status_unlocked(), 0);
    ts::return_shared(v);
    ts::return_shared(clock);
    ts::end(scenario);
}
