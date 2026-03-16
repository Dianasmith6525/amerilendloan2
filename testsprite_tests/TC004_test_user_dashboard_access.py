import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_user_dashboard_access():
    # First, login to get authentication token
    login_payload = {
        "email": "testuser@example.com",
        "password": "TestPass123!"
    }
    try:
        login_response = requests.post(
            f"{BASE_URL}/login",
            json=login_payload,
            timeout=TIMEOUT
        )
        assert login_response.status_code == 200, f"Login failed with status {login_response.status_code}"
        login_data = login_response.json()
        token = login_data.get("token")
        assert token, "Authentication token not found in login response"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"User login failed: {e}")

    headers = {
        "Authorization": f"Bearer {token}"
    }

    try:
        dashboard_response = requests.get(
            f"{BASE_URL}/dashboard",
            headers=headers,
            timeout=TIMEOUT
        )
        assert dashboard_response.status_code == 200, f"Dashboard access failed with status {dashboard_response.status_code}"
        dashboard_data = dashboard_response.json()
        # Assert keys for loan applications, payments and account activity
        assert "loan_applications" in dashboard_data, "Dashboard missing 'loan_applications'"
        assert "payments" in dashboard_data, "Dashboard missing 'payments'"
        assert "account_activity" in dashboard_data, "Dashboard missing 'account_activity'"
    except (requests.RequestException, AssertionError) as e:
        raise AssertionError(f"Dashboard access test failed: {e}")

test_user_dashboard_access()