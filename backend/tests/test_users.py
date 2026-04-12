"""Tests for the /users router."""

from unittest.mock import MagicMock
from tests.conftest import _make_user


class TestCreateUser:
    def test_create_user_success(self, client, fake_supabase):
        user = _make_user()
        users_table = fake_supabase.get_table("users")
        users_table.set_select_result([])  # no existing user
        users_table.set_insert_result([user])

        resp = client.post("/users", json={"email": "test@example.com", "name": "Test User"})
        assert resp.status_code == 201
        assert resp.json()["email"] == "test@example.com"

    def test_create_user_duplicate_email(self, client, fake_supabase):
        users_table = fake_supabase.get_table("users")
        users_table.set_select_result([_make_user()])

        resp = client.post("/users", json={"email": "test@example.com", "name": "Test"})
        assert resp.status_code == 409

    def test_create_user_invalid_email(self, client, fake_supabase):
        resp = client.post("/users", json={"email": "not-an-email", "name": "Test"})
        assert resp.status_code == 422


class TestGetUser:
    def test_get_user_found(self, client, fake_supabase):
        user = _make_user()
        fake_supabase.get_table("users").set_select_result([user])

        resp = client.get("/users/user-001")
        assert resp.status_code == 200
        assert resp.json()["id"] == "user-001"

    def test_get_user_not_found(self, client, fake_supabase):
        fake_supabase.get_table("users").set_select_result([])

        resp = client.get("/users/nonexistent")
        assert resp.status_code == 404


class TestListUsers:
    def test_list_users(self, client, fake_supabase):
        users = [_make_user(), _make_user(id="user-002", email="b@b.com")]
        fake_supabase.get_table("users").set_select_range(users)

        resp = client.get("/users")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


class TestDeleteUser:
    def test_delete_user_success(self, client, fake_supabase):
        fake_supabase.get_table("users").set_delete_result([_make_user()])

        resp = client.delete("/users/user-001")
        assert resp.status_code == 204

    def test_delete_user_not_found(self, client, fake_supabase):
        fake_supabase.get_table("users").set_delete_result([])

        resp = client.delete("/users/nonexistent")
        assert resp.status_code == 404
