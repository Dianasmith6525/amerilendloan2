import requests
import uuid

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_user_authentication_signup():
    # Generate unique user data for signup
    unique_email = f"testuser_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPassword123!"
    
    signup_payload = {
        "email": unique_email,
        "password": password,
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    try:
        # Step 1: Signup request
        signup_response = requests.post(
            f"{BASE_URL}/signup",
            json=signup_payload,
            headers=headers,
            timeout=TIMEOUT
        )
        assert signup_response.status_code in [200, 201], f"Expected 200 OK or 201 Created, got {signup_response.status_code}"
        
        resp_json = signup_response.json()
        # Verify essential fields in response, like user id or success message
        assert "user_id" in resp_json or "id" in resp_json, "Response missing user ID"
        assert resp_json.get("email", "").lower() == unique_email.lower(), "Response email mismatch"
        
    except requests.exceptions.RequestException as e:
        assert False, f"Request failed: {e}"

test_user_authentication_signup()