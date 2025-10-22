import os
import hmac
import hashlib
import requests
import logging
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# --- Logging setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')

# --- Flask setup ---
app = Flask(__name__)

# --- Environment Variables ---
LEMONSQUEEZY_SIGNING_SECRET = os.getenv('LEMONSQUEEZY_SIGNING_SECRET')
SUPABASE_WEBHOOK_URL = os.getenv('SUPABASE_WEBHOOK_URL')
INTERNAL_SECRET = os.getenv('INTERNAL_SECRET')

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({"message": "YTSGPT webhook backend is running!", "status": "ok"})

@app.route('/lemonsqueezy-webhook', methods=['POST'])
def lemonsqueezy_webhook():
    # 1️⃣ Check environment variables
    if not all([LEMONSQUEEZY_SIGNING_SECRET, SUPABASE_WEBHOOK_URL, INTERNAL_SECRET]):
        logging.error("Missing one or more environment variables.")
        return jsonify({"success": False, "message": "Server configuration error."}), 500

    # 2️⃣ Verify signature
    signature = request.headers.get('X-Signature')
    raw_body = request.get_data()

    if not signature:
        logging.warning("Webhook received without X-Signature header.")
        return jsonify({"code": 401, "message": "Missing authorization header"}), 401

    try:
        digest = hmac.new(
            LEMONSQUEEZY_SIGNING_SECRET.encode('utf-8'),
            msg=raw_body,
            digestmod=hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            logging.error("Invalid webhook signature.")
            return jsonify({"code": 401, "message": "Invalid signature"}), 401
    except Exception as e:
        logging.exception("Error during signature verification")
        return jsonify({"success": False, "message": "Signature verification failed."}), 500

    logging.info("Signature verified successfully.")

    # 3️⃣ Forward to Supabase
    try:
        headers = {
            'Content-Type': 'application/json',
            'X-Internal-Auth-Secret': INTERNAL_SECRET
        }
        response = requests.post(SUPABASE_WEBHOOK_URL, data=raw_body, headers=headers, timeout=10)
        response.raise_for_status()
        logging.info(f"Successfully forwarded webhook to Supabase. Status: {response.status_code}")
        return response.json(), response.status_code

    except requests.exceptions.RequestException as e:
        logging.exception(f"Error forwarding webhook to Supabase: {e}")
        if hasattr(e, "response") and e.response is not None:
            logging.error("Supabase response: %s", e.response.text)
        return jsonify({"success": False, "message": "Failed to forward webhook."}), 502

    except Exception as e:
        logging.exception(f"Unexpected error: {e}")
        return jsonify({"success": False, "message": "Unexpected server error."}), 500


if __name__ == '__main__':
    # Only for local testing
    app.run(host='0.0.0.0', port=5000, debug=True)
