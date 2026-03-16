import requests

BASE_URL = "http://localhost:5000"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "adminpassword"
TIMEOUT = 30

def login_admin():
    url = f"{BASE_URL}/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    response = requests.post(url, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    content_type = response.headers.get('Content-Type', '')
    assert 'application/json' in content_type.lower(), f"Login response is not JSON but '{content_type}'"
    try:
        resp_json = response.json()
    except Exception:
        assert False, "Login response body is not a valid JSON"
    token = resp_json.get("token")
    assert token, "Login failed or token missing"
    return token

def create_loan_application(user_token):
    url = f"{BASE_URL}/apply"
    headers = {"Authorization": f"Bearer {user_token}"}
    # Minimal valid loan application payload
    payload = {
        "amount": 5000,
        "term_months": 12,
        "income": 45000,
        "purpose": "personal",
        "employment_status": "employed"
    }
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    content_type = response.headers.get('Content-Type', '')
    assert 'application/json' in content_type.lower(), "Loan application creation response is not JSON"
    app_id = response.json().get("application_id")
    assert app_id, "Loan application creation failed"
    return app_id

def signup_user():
    url = f"{BASE_URL}/signup"
    import uuid
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": email,
        "password": "userpassword"
    }
    response = requests.post(url, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    content_type = response.headers.get('Content-Type', '')
    assert 'application/json' in content_type.lower(), "Signup response is not JSON"
    user_id = response.json().get("user_id")
    assert user_id, "User signup failed"
    return email, "userpassword"

def login_user(email, password):
    url = f"{BASE_URL}/login"
    payload = {
        "email": email,
        "password": password
    }
    response = requests.post(url, json=payload, timeout=TIMEOUT)
    response.raise_for_status()
    content_type = response.headers.get('Content-Type', '')
    assert 'application/json' in content_type.lower(), "User login response is not JSON"
    token = response.json().get("token")
    assert token, "User login failed or token missing"
    return token

def delete_loan_application(application_id, admin_token):
    url = f"{BASE_URL}/admin/application/{application_id}"
    headers = {"Authorization": f"Bearer {admin_token}"}
    try:
        response = requests.delete(url, headers=headers, timeout=TIMEOUT)
    except Exception:
        # best effort cleanup
        pass

def test_admin_application_review():
    # Step 1: Login as admin
    admin_token = login_admin()
    
    # Step 2: Create a normal user, login and apply for a loan application
    user_email, user_password = signup_user()
    user_token = login_user(user_email, user_password)
    application_id = None

    try:
        application_id = create_loan_application(user_token)
        # Step 3: Admin reviews application - fetch details
        url_get = f"{BASE_URL}/admin/application/{application_id}"
        headers = {"Authorization": f"Bearer {admin_token}"}
        response_get = requests.get(url_get, headers=headers, timeout=TIMEOUT)
        response_get.raise_for_status()
        content_type = response_get.headers.get('Content-Type', '')
        assert 'application/json' in content_type.lower(), "Application fetch response not JSON"
        app_data = response_get.json()
        assert app_data.get("application_id") == application_id
        assert app_data.get("status") in ("pending", "submitted")

        # Step 4: Admin approves the application
        payload_approve = {"action": "approve"}
        response_approve = requests.put(url_get, json=payload_approve, headers=headers, timeout=TIMEOUT)
        response_approve.raise_for_status()
        content_type = response_approve.headers.get('Content-Type', '')
        assert 'application/json' in content_type.lower(), "Approve response not JSON"
        approve_data = response_approve.json()
        assert approve_data.get("status") == "approved"

        # Step 5: Set back to pending for next test (simulate reject)
        payload_reopen = {"action": "reopen"}
        requests.put(url_get, json=payload_reopen, headers=headers, timeout=TIMEOUT)

        # Step 6: Admin rejects the application
        payload_reject = {"action": "reject", "reason": "Insufficient credit score"}
        response_reject = requests.put(url_get, json=payload_reject, headers=headers, timeout=TIMEOUT)
        response_reject.raise_for_status()
        content_type = response_reject.headers.get('Content-Type', '')
        assert 'application/json' in content_type.lower(), "Reject response not JSON"
        reject_data = response_reject.json()
        assert reject_data.get("status") == "rejected"
        assert reject_data.get("reason") == "Insufficient credit score"

        # Step 7: Test error case - invalid action
        payload_invalid = {"action": "invalid_action"}
        response_invalid = requests.put(url_get, json=payload_invalid, headers=headers, timeout=TIMEOUT)
        assert response_invalid.status_code == 400 or response_invalid.status_code == 422

        # Step 8: Test error case - not found application id
        url_bad = f"{BASE_URL}/admin/application/0"
        response_not_found = requests.put(url_bad, json={"action": "approve"}, headers=headers, timeout=TIMEOUT)
        assert response_not_found.status_code == 404

    finally:
        if application_id:
            delete_loan_application(application_id, admin_token)

test_admin_application_review()
