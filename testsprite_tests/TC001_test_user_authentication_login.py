import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30
HEADERS = {"Content-Type": "application/json"}


def test_user_authentication_login():
    # Test data for email/password login
    email_password_payload = {
        "email": "testuser@example.com",
        "password": "securePassword123"
    }

    # 1. Test login with email/password at /login
    try:
        response = requests.post(
            f"{BASE_URL}/login",
            json=email_password_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Email/password login request failed: {e}"

    assert 'application/json' in response.headers.get('Content-Type', ''), f"Expected JSON response, got Content-Type: {response.headers.get('Content-Type')}"
    json_response = response.json()
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert "token" in json_response and isinstance(json_response["token"], str) and json_response["token"], "Login with email/password should return a valid token"

    # Test data for OTP login
    otp_login_payload = {
        "email": "testuser@example.com",
        "otp": "123456"
    }

    # 2. Test OTP login at /otp-login
    try:
        response_otp = requests.post(
            f"{BASE_URL}/otp-login",
            json=otp_login_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        response_otp.raise_for_status()
    except requests.RequestException as e:
        assert False, f"OTP login request failed: {e}"

    assert 'application/json' in response_otp.headers.get('Content-Type', ''), f"Expected JSON response, got Content-Type: {response_otp.headers.get('Content-Type')}"
    json_response_otp = response_otp.json()
    assert response_otp.status_code == 200, f"Expected 200 OK, got {response_otp.status_code}"
    assert "token" in json_response_otp and isinstance(json_response_otp["token"], str) and json_response_otp["token"], "Login with OTP should return a valid token"


test_user_authentication_login()