import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_admin_dashboard_access():
    login_url = f"{BASE_URL}/login"
    admin_dashboard_url = f"{BASE_URL}/admin"
    admin_credentials = {
        "email": "admin@example.com",
        "password": "AdminPass123"
    }

    try:
        # Authenticate as admin user
        login_resp = requests.post(login_url, json=admin_credentials, timeout=TIMEOUT)
        assert login_resp.status_code == 200, f"Login failed with status code {login_resp.status_code}"
        login_data = login_resp.json()
        assert "token" in login_data, "Auth token not found in login response"

        token = login_data["token"]
        headers = {
            "Authorization": f"Bearer {token}"
        }

        # Access admin dashboard
        admin_resp = requests.get(admin_dashboard_url, headers=headers, timeout=TIMEOUT)
        assert admin_resp.status_code == 200, f"Admin dashboard access failed with status code {admin_resp.status_code}"

        admin_data = admin_resp.json()
        # Basic checks for expected keys in admin dashboard response
        assert isinstance(admin_data, dict), "Admin dashboard response is not a JSON object"
        expected_keys = ["overview", "analytics", "application_management"]
        for key in expected_keys:
            assert key in admin_data, f"Key '{key}' missing in admin dashboard response"

    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_admin_dashboard_access()