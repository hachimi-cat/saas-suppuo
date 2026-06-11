"""Smoke tests for SuppuoClient."""
import pytest

from forjio_suppuo import SuppuoClient, SuppuoError


def test_construct():
    c = SuppuoClient(token="test")
    assert c is not None
    assert c.tickets is not None
    assert c.canned_replies is not None
    assert c.billing is not None
    assert c.channels is not None
    assert c.reports is not None
    assert c.settings is not None
    assert c.csat is not None
    assert c.attachments is not None
    assert c.public is not None


def test_authed_call_without_token_raises(monkeypatch):
    monkeypatch.delenv("SUPPUO_TOKEN", raising=False)
    c = SuppuoClient()
    with pytest.raises(SuppuoError) as exc:
        c.canned_replies.list()
    assert exc.value.code == "AUTH_REQUIRED"
    assert exc.value.status == 0


def test_billing_call_without_token_raises(monkeypatch):
    monkeypatch.delenv("SUPPUO_TOKEN", raising=False)
    c = SuppuoClient()
    with pytest.raises(SuppuoError) as exc:
        c.billing.get()
    assert exc.value.code == "AUTH_REQUIRED"


def test_attachment_download_without_token_raises(monkeypatch):
    monkeypatch.delenv("SUPPUO_TOKEN", raising=False)
    c = SuppuoClient()
    with pytest.raises(SuppuoError) as exc:
        c.attachments.download("att_x")
    assert exc.value.code == "AUTH_REQUIRED"


def test_tickets_list_builds_filter_query(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["method"] = method
        captured["path"] = path
        return {"tickets": [], "counts": {}, "cursor": None, "hasMore": False}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    out = c.tickets.list(
        status="open",
        assignee="me",
        tag="billing",
        channel="telegram",
        priority="high",
        q="refund",
        limit=5,
        cursor="cur_abc",
    )
    assert out["hasMore"] is False
    assert captured["method"] == "GET"
    assert captured["path"].startswith("/api/v1/tickets?")
    for fragment in (
        "status=open",
        "assignee=me",
        "tag=billing",
        "channel=telegram",
        "priority=high",
        "q=refund",
        "limit=5",
        "cursor=cur_abc",
    ):
        assert fragment in captured["path"]


def test_tickets_tags_path(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["path"] = path
        return {"tags": ["billing"]}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    assert c.tickets.tags() == {"tags": ["billing"]}
    assert captured["path"] == "/api/v1/tickets/tags"


def test_tickets_update_sends_tags(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["body"] = kwargs.get("body")
        return {}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    c.tickets.update("tkt_1", tags=["vip", "billing"])
    assert captured["body"] == {"tags": ["vip", "billing"]}


def test_billing_checkout_payload(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["method"] = method
        captured["path"] = path
        captured["body"] = kwargs.get("body")
        return {"checkoutSessionId": "cs_1", "hostedUrl": "https://pay.example/cs_1"}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    out = c.billing.checkout("growth")
    assert out["hostedUrl"] == "https://pay.example/cs_1"
    assert captured == {
        "method": "POST",
        "path": "/api/v1/billing/checkout",
        "body": {"tier": "growth"},
    }


def test_channels_create_payload(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["body"] = kwargs.get("body")
        return {"id": "chn_1"}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    c.channels.create(provider="telegram_bot", botToken="123456789:AAexample")
    assert captured["body"] == {"provider": "telegram_bot", "botToken": "123456789:AAexample"}


def test_reports_summary_days_param(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["path"] = path
        return {"periodDays": 7}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    assert c.reports.summary(days=7) == {"periodDays": 7}
    assert captured["path"] == "/api/v1/reports/summary?days=7"


def test_settings_put_automation_partial(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["method"] = method
        captured["body"] = kwargs.get("body")
        return {}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    c.settings.put_automation(auto_response_enabled=True, hide_branding=True)
    assert captured["method"] == "PUT"
    assert captured["body"] == {"autoResponseEnabled": True, "hideBranding": True}
    # explicit None clears the ...-defaulted fields
    c.settings.put_automation(business_hours=None, auto_response_inside=None)
    assert captured["body"] == {"businessHours": None, "autoResponseInside": None}


def test_attachments_upload_uses_raw_body(monkeypatch):
    captured = {}

    def fake_request(method, path, **kwargs):
        captured["method"] = method
        captured["path"] = path
        captured["raw_body"] = kwargs.get("raw_body")
        captured["headers"] = kwargs.get("headers")
        return {"id": "att_1"}

    c = SuppuoClient(token="sk_live_xxx")
    monkeypatch.setattr(c, "request", fake_request)
    out = c.attachments.upload(data=b"\x01\x02", filename="report.pdf", content_type="application/pdf")
    assert out["id"] == "att_1"
    assert captured["method"] == "POST"
    assert captured["path"] == "/api/v1/attachments"
    assert captured["raw_body"] == b"\x01\x02"
    assert captured["headers"] == {
        "Content-Type": "application/pdf",
        "X-Filename": "report.pdf",
    }
