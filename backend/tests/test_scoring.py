from app.scoring.engine import score_alert


def enrichment_with(verdict: str, score: int, count: int = 1) -> dict:
    return {
        f"ioc-{i}": {"type": "ip", "results": {"virustotal": {"verdict": verdict, "score": score}}}
        for i in range(count)
    }


def test_high_rule_plus_malicious_intel_is_p1():
    score, band, breakdown = score_alert(13, ["malware"], enrichment_with("malicious", 95, count=2))
    assert band == "P1"
    assert score >= 80
    assert breakdown["malicious_ioc_count"] == 2


def test_benign_low_level_is_p4():
    score, band, _ = score_alert(3, ["authentication_success"], enrichment_with("clean", 2))
    assert band == "P4"
    assert score < 35


def test_intel_escalates_medium_rule():
    base_score, _, _ = score_alert(7, [], {})
    boosted, _, _ = score_alert(7, [], enrichment_with("malicious", 100))
    assert boosted > base_score + 30


def test_malicious_verdict_floors_weak_numeric_score():
    # VT "4/91 engines" gives score ~11 but verdict malicious — must still boost hard
    score, band, breakdown = score_alert(10, ["authentication_failures"], enrichment_with("malicious", 11))
    assert breakdown["effective_intel_score"] == 60
    assert band in ("P1", "P2")


def test_score_capped_at_100():
    score, band, _ = score_alert(15, ["malware", "ransomware"], enrichment_with("malicious", 100, count=5))
    assert score <= 100
    assert band == "P1"
