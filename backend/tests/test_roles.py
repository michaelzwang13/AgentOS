"""Test the /roles endpoint that lists agent role templates."""


class TestRoles:
    def test_list_roles_returns_all_templates(self, client):
        resp = client.get("/roles")
        assert resp.status_code == 200
        roles = resp.json()
        role_ids = [r["role"] for r in roles]
        assert "secretary" in role_ids
        assert "code-review-engineer" in role_ids
        assert "customer-support" in role_ids

    def test_list_roles_shape(self, client):
        resp = client.get("/roles")
        assert resp.status_code == 200
        for r in resp.json():
            assert set(r.keys()) == {"role", "display_name", "description", "allowed_actions"}
            assert isinstance(r["allowed_actions"], list)

    def test_get_role_returns_single_template(self, client):
        resp = client.get("/roles/code-review-engineer")
        assert resp.status_code == 200
        data = resp.json()
        assert data["role"] == "code-review-engineer"
        assert "github.pr.read" in data["allowed_actions"]

    def test_get_role_unknown_returns_404(self, client):
        resp = client.get("/roles/does-not-exist")
        assert resp.status_code == 404
