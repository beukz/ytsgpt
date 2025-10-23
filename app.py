import os
import hmac
import hashlib
import logging
from flask import Flask, request, jsonify
import requests
from dotenv import load_dotenv

# ──────────────────────────────────────────────
# Load environment variables from .env
# ──────────────────────────────────────────────
load_dotenv()

LEMONSQUEEZY_SIGNING_SECRET = os.getenv("LEMONSQUEEZY_SIGNING_SECRET")
SUPABASE_WEBHOOK_URL = os.getenv("SUPABASE_WEBHOOK_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# ──────────────────────────────────────────────
# Logging setup
# ──────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Flask app
# ──────────────────────────────────────────────
app = Flask(__name__)

@app.route("/", methods=["GET"])
def healthcheck():
    """Basic healthcheck for Nginx test"""
    return jsonify({"message": "YTSGPT webhook backend is running!", "status": "ok"}), 200


@app.route("/lemonsqueezy-webhook", methods=["POST"])
def lemonsqueezy_webhook():
    """
    Receives verified webhooks from Lemon Squeezy and forwards them
    securely to Supabase Edge Function.
    """
    try:
        raw_body = request.data
        signature = request.headers.get("X-Signature")

        if not signature:
            logger.warning("Missing X-Signature header.")
            return jsonify({"success": False, "message": "Missing signature header."}), 400

        # Verify Lemon Squeezy signature
        computed_signature = hmac.new(
            LEMONSQUEEZY_SIGNING_SECRET.encode("utf-8"),
            msg=raw_body,
            digestmod=hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(computed_signature, signature):
            logger.warning("Invalid signature: webhook verification failed.")
            return jsonify({"success": False, "message": "Invalid signature."}), 403

        logger.info("✅ Signature verified successfully.")

        # ──────────────────────────────────────────────
        # Forward the payload to Supabase Edge Function
        # ──────────────────────────────────────────────
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        }

        response = requests.post(SUPABASE_WEBHOOK_URL, data=raw_body, headers=headers, timeout=10)

        try:
            response.raise_for_status()
        except requests.exceptions.HTTPError:
            logger.error("Error forwarding webhook to Supabase: %s", response.text)
            return jsonify({"success": False, "message": "Failed to forward webhook."}), 500

        logger.info("✅ Successfully forwarded webhook to Supabase.")
        logger.debug("Supabase response: %s", response.text)

        return jsonify({"success": True, "message": "Webhook processed successfully."}), 200

    except Exception as e:
        logger.exception("❌ Unexpected error in webhook handler: %s", str(e))
        return jsonify({"success": False, "message": "Server configuration error."}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
