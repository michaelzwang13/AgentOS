"""Tests for the /credentials router."""

from tests.conftest import _make_user


def _make_credential(**overrides):
    base = {
        "id": "cred-001",
        "user_id": "user-001",
        "service": "gmail",
        "encrypted_token": "encrypted-abc",
        "scopes": ["read", "send"],
        "created_at": "2025-01-01T00:00:00+00:00",
    }
    base.update(overrides)
    return base


class TestStoreCredential:
    def test_store_credential_success(self, authed_client):
        client, user, fake_sb = authed_client
        cred = _make_credential()
        fake_sb.get_table("credentials").set_upsert_result([cred])

        resp = client.post(
            "/credentials",
            json={"service": "gmail", "token": "my-token", "scopes": ["read"]},
        )
        assert resp.status_code == 201
        assert resp.json()["service"] == "gmail"

    def test_store_credential_invalid_service(self, authed_client):
        client, user, fake_sb = authed_client
        resp = client.post(
            "/credentials",
            json={"service": "unknown", "token": "tok", "scopes": []},
        )
        assert resp.status_code == 422

    def test_store_credential_github(self, authed_client):
        client, user, fake_sb = authed_client
        cred = _make_credential(service="github")
        fake_sb.get_table("credentials").set_upsert_result([cred])

        resp = client.post(
            "/credentials",
            json={"service": "github", "token": "ghp_xxx", "scopes": ["repo"]},
        )
        assert resp.status_code == 201
        assert resp.json()["service"] == "github"


class TestListCredentials:
    def test_list_credentials(self, authed_client):
        client, user, fake_sb = authed_client
        creds = [_make_credential(), _make_credential(id="cred-002", service="slack")]
        fake_sb.get_table("credentials").set_select_result(creds)

        resp = client.get("/credentials")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


class TestDeleteCredential:
    def test_delete_credential_success(self, authed_client):
        client, user, fake_sb = authed_client
        fake_sb.get_table("credentials").set_delete_double_filter([_make_credential()])

        resp = client.delete("/credentials/gmail")
        assert resp.status_code == 204

    def test_delete_credential_not_found(self, authed_client):
        client, user, fake_sb = authed_client
        fake_sb.get_table("credentials").set_delete_double_filter([])

        resp = client.delete("/credentials/gmail")
        assert resp.status_code == 404
