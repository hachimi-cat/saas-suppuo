"""client.api: every feature route, one method each, generated from the API spec
(scripts/apigen.sh). Calls are Bearer-authenticated like every other request."""

from __future__ import annotations

import json
from typing import List
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from forjio_suppuo import SuppuoClient


@pytest.fixture
def seen(monkeypatch: pytest.MonkeyPatch) -> List[httpx.Request]:
    """Route the client's httpx calls through a MockTransport and record them."""
    requests: List[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        body = {"data": {"ok": True}, "error": None, "meta": {"requestId": "r"}}
        return httpx.Response(200, content=json.dumps(body).encode())

    mock = httpx.Client(transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx, "request", mock.request)
    return requests


def _client(token: str = "sk_live_test") -> SuppuoClient:
    return SuppuoClient(token=token, base_url="https://suppuo.test")


def test_create_sends_the_fields_suppuo_validates_with_the_bearer_key(seen: List[httpx.Request]) -> None:
    out = _client().api.tickets_create(subject="Refund", body="Order 42", requester_email="a@b.co", channel="email")
    assert out == {"ok": True}
    request = seen[0]
    assert (request.method, request.url.path) == ("POST", "/api/v1/tickets")
    assert json.loads(request.content) == {"subject": "Refund", "body": "Order 42", "requesterEmail": "a@b.co", "channel": "email"}
    assert request.headers["authorization"] == "Bearer sk_live_test"


def test_path_and_query(seen: List[httpx.Request]) -> None:
    client = _client()
    client.api.tickets_get("tkt 1")
    client.api.tickets_list(status="open", limit=5)
    assert seen[0].url.raw_path.decode() == "/api/v1/tickets/tkt%201"
    assert seen[1].url.path == "/api/v1/tickets"
    assert parse_qs(urlsplit(str(seen[1].url)).query) == {"status": ["open"], "limit": ["5"]}


def test_public_routes_go_without_a_token_like_client_public(seen: List[httpx.Request], monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("SUPPUO_TOKEN", raising=False)
    SuppuoClient(base_url="https://suppuo.test").api.public_tickets_csat("tok_abc", score=3)
    assert seen[0].url.path == "/api/v1/public/tickets/tok_abc/csat"
    assert "authorization" not in seen[0].headers


def test_a_required_field_is_asked_for() -> None:
    with pytest.raises(ValueError, match="needs requester_email"):
        _client().api.tickets_create(subject="X", body="Y")


def test_every_feature_route_has_a_method() -> None:
    methods = [n for n in dir(_client().api) if not n.startswith("_")]
    assert len(methods) >= 70
