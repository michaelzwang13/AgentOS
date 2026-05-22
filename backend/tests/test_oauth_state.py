"""Tests for signed OAuth state tokens."""

import time

from app.utils import oauth_state


def test_roundtrip_returns_user_id():
    token = oauth_state.issue_state("user-001")
    assert oauth_state.verify_state(token) == "user-001"


def test_state_does_not_leak_the_user_id_in_clear_text():
    # The user id is base64'd, not plain — a casual log scrape won't reveal it.
    token = oauth_state.issue_state("user-001")
    assert "user-001" not in token


def test_tampered_token_rejected():
    token = oauth_state.issue_state("user-001")
    body, _ = token.rsplit(".", 1)
    forged_sig = oauth_state.issue_state("attacker").rsplit(".", 1)[1]
    assert oauth_state.verify_state(f"{body}.{forged_sig}") is None


def test_garbage_rejected():
    assert oauth_state.verify_state(None) is None
    assert oauth_state.verify_state("") is None
    assert oauth_state.verify_state("no-dot-here") is None
    assert oauth_state.verify_state("a.b.c") is None


def test_expired_token_rejected(monkeypatch):
    real_time = time.time  # capture before patching to avoid recursion
    token = oauth_state.issue_state("user-001")
    monkeypatch.setattr(oauth_state.time, "time", lambda: real_time() + 10_000)
    assert oauth_state.verify_state(token) is None
