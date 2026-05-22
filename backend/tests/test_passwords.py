"""Tests for password hashing."""

from app.utils.passwords import hash_password, verify_password


def test_hash_and_verify_roundtrip():
    h = hash_password("supersecret")
    assert verify_password("supersecret", h)
    assert not verify_password("wrong-password", h)


def test_verify_handles_missing_or_malformed_hash():
    assert verify_password("anything", None) is False
    assert verify_password("anything", "") is False
    assert verify_password("anything", "not-a-bcrypt-hash") is False


def test_long_multibyte_passwords_do_not_collide():
    # Both passwords share their first 72 bytes and differ only past it.
    # Without the SHA-256 pre-hash, bcrypt would truncate at 72 bytes and
    # the two would hash identically.
    a = "a" * 40 + "🔒" * 16  # 104 bytes
    b = "a" * 40 + "🔓" * 16  # 104 bytes, differs past byte 72

    assert verify_password(a, hash_password(a))
    assert not verify_password(b, hash_password(a))
