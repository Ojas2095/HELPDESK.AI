import pytest
from backend.services.spam_detector_service import analyze_spam_phishing, is_domain_safe

@pytest.mark.parametrize("text, expected_is_spam, expected_risk, check_reason", [
    (
        "Hello, I need help with my email account. It keeps logging me out.",
        False, "none", None
    ),
    (
        "",
        False, "none", None
    ),
    (
        "See our code at https://github.com/",
        False, "none", None
    ),
    (
        "verify your account immediately and confirm your password.",
        True, ("medium", "high"), "verify your account"
    ),
    (
        "Congratulations, you are a lottery winner! Get your cash prize now.",
        True, ("medium", "high"), "spam"
    ),
    (
        "Check out this site: http://free-money.xyz",
        True, ("medium", "high"), "suspicious tld"
    ),
    (
        "Links: http://a.com http://b.com http://c.com http://d.com http://e.com http://f.com",
        True, ("medium", "high"), "link density"
    )
])
def test_analyze_spam_phishing_cases(text, expected_is_spam, expected_risk, check_reason):
    result = analyze_spam_phishing(text)
    
    assert result["is_spam"] is expected_is_spam
    
    if isinstance(expected_risk, tuple):
        assert result["risk_level"] in expected_risk
    else:
        assert result["risk_level"] == expected_risk
        
    if not expected_is_spam:
        assert len(result["reasons"]) == 0
        assert len(result["suspicious_urls"]) == 0
        
    if check_reason:
        assert any(check_reason in r.lower() for r in result["reasons"])

def test_is_domain_safe():
    assert is_domain_safe("google.com") is True
    assert is_domain_safe("sub.github.com") is True
    assert is_domain_safe("malicious.xyz") is False
