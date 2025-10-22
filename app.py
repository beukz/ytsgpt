import os
import hmac
import hashlib
import requests
from flask import Flask, request, jsonify

# --- Flask App Setup ---
app = Flask(__name__)

# --- Environment Variables ---
LEMONSQUEEZY_SIGNING_SECRET = os.environ.get('LEMONSQUEEZY_SIGNING_SECRET')
SUPABASE_WEBHOOK_URL = os.environ.get('SUPABASE_WEBHOOK_URL')  # e.g., 'https://<ref>.supabase.co/functions/v1/lemonsqueezy-webhook'
INTERNAL_SECRET = os.environ.get('INTERNAL_SECRET')

# --- Health Check ---
@app.route('/', methods=['GET'])
def health_check():
    """Simple endpoint to verify the server is live."""
    return jsonify({
        "status": "ok",
        "message": "YTSGPT webhook backend is running!"
    }), 200


# --- Lemon Squeezy Webhook Endpoint ---
@app.route('/lemonsqueezy-webhook', methods=['POST'])
def lemonsqueezy_webhook():
    """Receives webhooks from Lemon Squeezy, verifies them, and forwards them to Supabase."""
    # 1️⃣ Check environment variables
    if not all([LEMONSQUEEZY_SIGNING_SECRET, SUPABASE_WEBHOOK_URL, INTERNAL_SECRET]):
        print("❌ Missing one or more environment variables.")
        return jsonify({"success": False, "message": "Server configuration error."}), 500

    # 2️⃣ Verify signature
    signature = request.headers.get('X-Signature')
    raw_body = request.get_data()

    if not signature:
        print("⚠️ Missing X-Signature header.")
        return jsonify({"code": 401, "message": "Missing authorization header"}), 401

    try:
        digest = hmac.new(
            LEMONSQUEEZY_SIGNING_SECRET.encode('utf-8'),
            msg=raw_body,
            digestmod=hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(digest, signature):
            print("❌ Invalid webhook signature.")
            return jsonify({"code": 401, "message": "Invalid signature"}), 401
    except Exception as e:
        print(f"❌ Error verifying signature: {e}")
        return jsonify({"success": False, "message": "Signature verification failed."}), 500

    print("✅ Signature verified successfully.")

    # 3️⃣ Forward to Supabase
    try:
        headers = {
            'Content-Type': 'application/json',
            'X-Internal-Auth-Secret': INTERNAL_SECRET
        }

        response = requests.post(
            SUPABASE_WEBHOOK_URL,
            data=raw_body,
            headers=headers,
            timeout=10
        )

        response.raise_for_status()
        print(f"✅ Forwarded to Supabase. Status: {response.status_code}")

        return response.json(), response.status_code

    except requests.exceptions.RequestException as e:
        print(f"❌ Error forwarding to Supabase: {e}")
        return jsonify({"success": False, "message": "Failed to forward webhook."}), 502

    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        return jsonify({"success": False, "message": "Internal server error."}), 500


# --- Local Run (for testing only) ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
