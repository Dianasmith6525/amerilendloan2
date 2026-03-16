import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_loan_application_submission():
    # Step 1: Login to get authentication token
    login_url = f"{BASE_URL}/login"
    login_payload = {
        "email": "testuser@example.com",
        "password": "TestPassword123!"
    }
    try:
        login_response = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
        assert login_response.status_code == 200, f"Login failed with status code {login_response.status_code}"
        try:
            login_data = login_response.json()
        except ValueError:
            assert False, "Login response is not valid JSON"

        assert "token" in login_data or "access_token" in login_data, "Authentication token not found in login response"
        token = login_data.get("token") or login_data.get("access_token")

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }

        # Step 2: Submit multi-step loan application form to /apply endpoint

        loan_application_payload = {
            "personal_info": {
                "first_name": "John",
                "last_name": "Doe",
                "date_of_birth": "1990-01-01",
                "ssn": "123-45-6789",
                "address": "123 Main St, Anytown, USA",
                "phone": "555-123-4567",
                "email": "testuser@example.com"
            },
            "employment_info": {
                "employer": "ABC Corp",
                "job_title": "Engineer",
                "annual_income": 85000,
                "employment_length_years": 5
            },
            "loan_details": {
                "loan_amount": 15000,
                "loan_purpose": "Home Improvement",
                "loan_term_months": 36
            },
            "financial_info": {
                "credit_score": 720,
                "existing_debt": 5000
            }
        }

        apply_url = f"{BASE_URL}/apply"
        apply_response = requests.post(apply_url, json=loan_application_payload, headers=headers, timeout=TIMEOUT)
        assert apply_response.status_code == 201, f"Loan application submission failed with status code {apply_response.status_code}"
        try:
            apply_data = apply_response.json()
        except ValueError:
            assert False, "Loan application response is not valid JSON"

        assert "application_id" in apply_data, "Application ID missing in response"
        assert apply_data.get("status") in ["submitted", "pending"], "Unexpected application status"

    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_loan_application_submission()
