import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

# Test user credentials for login (should exist in the test environment)
TEST_USER_EMAIL = "testuser@example.com"
TEST_USER_PASSWORD = "TestPassword123!"

def login(email, password):
    url = f"{BASE_URL}/login"
    payload = {"email": email, "password": password}
    headers = {"Content-Type": "application/json"}
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "token" in data, "Login response does not contain auth token"
    return data["token"]

def create_loan_application(auth_token):
    url = f"{BASE_URL}/apply"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    # Minimal valid loan application payload (assuming)
    payload = {
        "amount": 5000,
        "term_months": 12,
        "purpose": "personal",
        "income": 3500
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert "loan_id" in data, "Loan application response missing loan_id"
    return data["loan_id"]

def delete_loan_application(auth_token, loan_id):
    url = f"{BASE_URL}/apply/{loan_id}"
    headers = {
        "Authorization": f"Bearer {auth_token}"
    }
    # Assuming a DELETE endpoint exists to cancel or delete loan application - if not, skip this
    try:
        resp = requests.delete(url, headers=headers, timeout=TIMEOUT)
        if resp.status_code not in (200,204):
            # Accept also not found or forbidden if cleanup fail
            pass
    except requests.RequestException:
        pass

def pay_using_credit_card(auth_token, loan_id):
    url = f"{BASE_URL}/payment/{loan_id}"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "payment_method": "credit_card",
        "card_number": "4111111111111111",
        "card_expiry": "12/30",
        "card_cvv": "123",
        "amount": 100
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert data.get("status") == "success", "Credit card payment failed"
    assert "transaction_id" in data, "No transaction_id in credit card payment response"

def pay_using_cryptocurrency(auth_token):
    url = f"{BASE_URL}/pay-fee"
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "payment_method": "cryptocurrency",
        "crypto_type": "bitcoin",
        "wallet_address": "1BoatSLRHtKNngkdXEeobR76b53LETtpyT",
        "amount": 100
    }
    resp = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert data.get("status") == "success", "Cryptocurrency payment failed"
    assert "transaction_id" in data, "No transaction_id in cryptocurrency payment response"

def test_loan_payment_processing():
    # Login to get auth token
    token = login(TEST_USER_EMAIL, TEST_USER_PASSWORD)
    loan_id = None
    try:
        # Create a loan application to get a loan/payment id
        loan_id = create_loan_application(token)

        # Test payment with credit card on /payment/:id
        pay_using_credit_card(token, loan_id)

        # Test payment with cryptocurrency on /pay-fee
        pay_using_cryptocurrency(token)

    finally:
        # Cleanup: delete loan application if created
        if loan_id:
            delete_loan_application(token, loan_id)

test_loan_payment_processing()