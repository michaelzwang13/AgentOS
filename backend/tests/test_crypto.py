"""Tests for the crypto utility."""

from app.utils.crypto import encrypt, decrypt


class TestCrypto:
    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "my-secret-token-12345"
        ciphertext = encrypt(plaintext)
        assert ciphertext != plaintext
        assert decrypt(ciphertext) == plaintext

    def test_different_plaintexts_different_ciphertexts(self):
        a = encrypt("alpha")
        b = encrypt("beta")
        assert a != b
