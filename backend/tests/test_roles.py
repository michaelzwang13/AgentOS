"""Tests for the /roles endpoint and the shared template loader."""

import pytest
import yaml

from app.services import template_loader
from app.services.template_loader import (
    UnknownRoleError,
    list_templates,
    load_template,
)


class TestListRoles:
    def test_list_roles_returns_all_templates(self, client):
        resp = client.get("/roles")
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.json()]
        assert "secretary" in ids
        assert "code-review-engineer" in ids
        assert "customer-support" in ids

    def test_list_roles_shape(self, client):
        resp = client.get("/roles")
        assert resp.status_code == 200
        for r in resp.json():
            assert set(r.keys()) == {
                "id",
                "display_name",
                "description",
                "required_tools",
            }
            assert isinstance(r["required_tools"], list)

    def test_list_roles_public_no_auth_required(self, client):
        # client fixture has no X-Api-Key header — talent directory
        # must load for anonymous visitors.
        resp = client.get("/roles")
        assert resp.status_code == 200

    def test_get_role_returns_single_template(self, client):
        resp = client.get("/roles/code-review-engineer")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "code-review-engineer"
        assert "github" in data["required_tools"]
        assert "github.pr.read" in data["allowed_actions"]

    def test_get_role_unknown_returns_404(self, client):
        resp = client.get("/roles/does-not-exist")
        assert resp.status_code == 404


class TestTemplateLoader:
    @pytest.fixture(autouse=True)
    def _redirect_templates_dir(self, tmp_path, monkeypatch):
        """Point the loader at a tmp dir and clear its lru_cache."""
        monkeypatch.setattr(template_loader, "TEMPLATES_DIR", tmp_path)
        list_templates.cache_clear()
        load_template.cache_clear()
        yield
        list_templates.cache_clear()
        load_template.cache_clear()

    def test_list_templates_empty_dir(self, tmp_path):
        assert list_templates() == []

    def test_list_templates_reads_yaml_files(self, tmp_path):
        (tmp_path / "alpha.yaml").write_text(
            yaml.safe_dump(
                {
                    "role": "alpha",
                    "display_name": "Alpha",
                    "description": "First",
                    "required_tools": ["github"],
                }
            )
        )
        (tmp_path / "bravo.yaml").write_text(
            yaml.safe_dump(
                {
                    "role": "bravo",
                    "display_name": "Bravo",
                    "description": "Second",
                    "required_tools": ["slack", "gmail"],
                }
            )
        )
        result = list_templates()
        assert [r["id"] for r in result] == ["alpha", "bravo"]
        assert result[1]["required_tools"] == ["slack", "gmail"]

    def test_load_template_returns_full_yaml(self, tmp_path):
        (tmp_path / "alpha.yaml").write_text(
            yaml.safe_dump(
                {
                    "role": "alpha",
                    "system_prompt": "hello",
                    "allowed_actions": ["github.pr.read"],
                }
            )
        )
        data = load_template("alpha")
        assert data["role"] == "alpha"
        assert data["system_prompt"] == "hello"
        assert data["allowed_actions"] == ["github.pr.read"]

    def test_load_template_unknown_raises(self, tmp_path):
        with pytest.raises(UnknownRoleError, match="nonexistent"):
            load_template("nonexistent")
