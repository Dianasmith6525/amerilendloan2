import requests


def test_contact_form_submission():
    url = "http://localhost:5000/contact"
    headers = {"Content-Type": "application/json"}
    payload = {
        "name": "John Doe",
        "email": "johndoe@example.com",
        "subject": "Inquiry about loan options",
        "message": "I would like to know more about your personal loan options."
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code in (200, 201), f"Expected status code 200 or 201 but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {str(e)}"


test_contact_form_submission()