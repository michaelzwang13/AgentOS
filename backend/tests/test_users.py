"""Tests for the /users router."""

from tests.conftest import _make_user
from app.utils.passwords import hash_password


class TestCreateUser:
    def test_create_user_success(self, client, fake_supabase):
        user = _make_user()
        users_table = fake_supabase.get_table("users")
        users_table.set_select_result([])  # no existing user
        users_table.set_insert_result([user])

        resp = client.post(
            "/users",
            json={"email": "test@example.com", "name": "Test User", "password": "supersecret"},
        )
        assert resp.status_code == 201
        assert resp.json()["email"] == "test@example.com"

    def test_create_user_duplicate_email(self, client, fake_supabase):
        users_table = fake_supabase.get_table("users")
        users_table.set_select_result([_make_user()])

        resp = client.post(
            "/users",
            json={"email": "test@example.com", "name": "Test", "password": "supersecret"},
        )
        assert resp.status_code == 409

    def test_create_user_invalid_email(self, client, fake_supabase):
        resp = client.post(
            "/users",
            json={"email": "not-an-email", "name": "Test", "password": "supersecret"},
        )
        assert resp.status_code == 422

    def test_create_user_rejects_short_password(self, client, fake_supabase):
        resp = client.post(
            "/users",
            json={"email": "test@example.com", "name": "Test", "password": "short"},
        )
        assert resp.status_code == 422


class TestLogin:
    def test_login_success(self, client, fake_supabase):
        user = _make_user(password_hash=hash_password("supersecret"))
        fake_supabase.get_table("users").set_select_result([user])

        resp = client.post(
            "/users/login",
            json={"email": "test@example.com", "password": "supersecret"},
        )
        assert resp.status_code == 200
        assert resp.json()["api_key"] == "test-api-key"

    def test_login_wrong_password(self, client, fake_supabase):
        user = _make_user(password_hash=hash_password("supersecret"))
        fake_supabase.get_table("users").set_select_result([user])

        resp = client.post(
            "/users/login",
            json={"email": "test@example.com", "password": "wrong-password"},
        )
        assert resp.status_code == 401

    def test_login_unknown_email(self, client, fake_supabase):
        fake_supabase.get_table("users").set_select_result([])

        resp = client.post(
            "/users/login",
            json={"email": "nobody@example.com", "password": "supersecret"},
        )
        assert resp.status_code == 401


class TestGetUser:
    def test_get_own_record(self, authed_client):
        client, user, _ = authed_client
        resp = client.get(f"/users/{user['id']}")
        assert resp.status_code == 200
        assert resp.json()["id"] == user["id"]

    def test_get_other_user_is_hidden(self, authed_client):
        client, _, _ = authed_client
        resp = client.get("/users/someone-else")
        assert resp.status_code == 404

    def test_get_user_requires_auth(self, client):
        resp = client.get("/users/user-001")
        assert resp.status_code == 401


class TestDeleteUser:
    def test_delete_own_account(self, authed_client):
        client, user, fake_supabase = authed_client
        fake_supabase.get_table("users").set_delete_result([user])

        resp = client.delete(f"/users/{user['id']}")
        assert resp.status_code == 204

    def test_delete_other_user_is_hidden(self, authed_client):
        client, _, _ = authed_client
        resp = client.delete("/users/someone-else")
        assert resp.status_code == 404

    def test_delete_user_requires_auth(self, client):
        resp = client.delete("/users/user-001")
        assert resp.status_code == 401
