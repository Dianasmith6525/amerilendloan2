import requests

BASE_URL = "http://localhost:5000"
TIMEOUT = 30

def test_check_offers_access():
    url = f"{BASE_URL}/check-offers"
    try:
        response = requests.get(url, timeout=TIMEOUT)
        # Assert that the response status code is 200 (OK)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        # Optionally, validate response content type and structure if known
        assert 'application/json' in response.headers.get('Content-Type', ''), "Response is not JSON"
        data = response.json()
        # Assert that data contains expected keys, for example "offers" or similar - since schema details are not provided, check it's a dict/list
        assert isinstance(data, (dict, list)), "Response JSON is not a dict or list"
        # If dict, check offers key presence as a typical pre-qualification tool response might contain offers
        if isinstance(data, dict):
            assert 'offers' in data or len(data) > 0, "Response JSON does not contain 'offers' key or is empty"
    except requests.RequestException as e:
        assert False, f"Request to /check-offers failed: {e}"

test_check_offers_access()