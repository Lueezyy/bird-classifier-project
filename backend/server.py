from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow requests from the frontend (different port during development)


@app.route("/predict", methods=["POST"])
def predict():
    # Pull the image out of the multipart form data
    image_file = request.files.get("image")

    if not image_file:
        return jsonify({"error": "No image received"}), 400

    # Confirm arrival in the terminal
    print(f"[/predict] Received file: '{image_file.filename}'"
          f"  |  content-type: {image_file.content_type}")

    # Hardcoded fake response — real model inference replaces this later
    return jsonify({
        "species":     "American Robin",
        "confidence":  0.94,
        "description": (
            "The American Robin is one of North America's most familiar songbirds, "
            "recognised by its brick-red breast and clear carolling song that heralds "
            "the arrival of spring. It forages on open lawns by running and pausing to "
            "pull earthworms from the soil, and ranges widely from Alaska to central Mexico."
        ),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)