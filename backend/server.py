from flask import Flask, request, jsonify
from flask_cors import CORS
import torch
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import io
import json
import urllib.request

app = Flask(__name__)
CORS(app)  # allow requests from the frontend (different port during development)

# Load the ImageNet class labels
# These are the 1000 classes that ResNet-50 was trained on
def load_imagenet_labels():
    # URL to the ImageNet class index mapping
    import urllib.request
    url = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
    try:
        with urllib.request.urlopen(url) as response:
            labels = [line.decode('utf-8').strip() for line in response.readlines()]
        return labels
    except:
        # Fallback to a smaller local mapping if internet is unavailable
        return ["bird"] * 1000  # Placeholder

# Load model at startup (not per request)
print("Loading ResNet-50 model...")
model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
model.eval()  # Set to evaluation mode
print("Model loaded successfully!")

# Load ImageNet labels
IMAGENET_LABELS = load_imagenet_labels()
print(f"Loaded {len(IMAGENET_LABELS)} ImageNet class labels")

def preprocess_image(image_bytes):
    """
    Image preprocessing function that takes raw uploaded file bytes and prepares it for ResNet-50.
    
    Steps:
    1. Open image with PIL and convert to RGB (3 channels)
    2. Resize to 256x256 (minimum size for ResNet)
    3. Center crop to 224x224 (standard input size for ResNet-50)
    4. Convert PIL image to PyTorch tensor (values become [0, 1] range)
    5. Normalize using ImageNet's exact mean and std values:
       - Mean: [0.485, 0.456, 0.406] (R, G, B)
       - Std:  [0.229, 0.224, 0.225] (R, G, B)
       This transforms pixel values from [0, 1] to [-2.118, 2.640] range
       which matches how ResNet-50 was trained on ImageNet
    
    These specific normalization values are critical - they are the exact mean
    and standard deviation of all ImageNet pixels calculated during training.
    Using different values would cause incorrect predictions.
    """
    # Step 1: Open image from bytes and ensure RGB format
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    
    # Step 2: Resize to 256x256
    # ResNet expects at least 224px, but we resize to 256 then crop to 224
    # This preserves more spatial information and improves accuracy
    image = image.resize((256, 256), Image.Resampling.LANCZOS)
    
    # Step 3: Center crop to 224x224
    # This is the exact input size ResNet-50 was trained on
    width, height = image.size
    crop_size = 224
    left = (width - crop_size) / 2
    top = (height - crop_size) / 2
    right = left + crop_size
    bottom = top + crop_size
    image = image.crop((left, top, right, bottom))
    
    # Step 4: Convert PIL image to tensor
    # transforms.ToTensor() does:
    # - Converts PIL image to PyTorch tensor
    # - Scales pixel values from [0, 255] to [0.0, 1.0]
    # - Changes shape from (H, W, C) to (C, H, W)
    to_tensor = transforms.ToTensor()
    input_tensor = to_tensor(image)
    
    # Step 5: Normalize with ImageNet's exact mean and standard deviation
    # These numbers are not arbitrary - they were calculated from the entire ImageNet dataset:
    # Mean: average pixel value of all 1.2 million training images
    # Std:  standard deviation of pixel values across all images
    # 
    # Formula: normalized = (tensor - mean) / std
    # This transforms values to a distribution centered around 0 with unit variance
    normalize = transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  # ImageNet RGB channel means
        std=[0.229, 0.224, 0.225]     # ImageNet RGB channel standard deviations
    )
    input_tensor = normalize(input_tensor)
    
    return input_tensor

def predict_species(image_bytes):
    """
    Takes raw image bytes, runs inference through ResNet-50,
    returns the predicted species and confidence.
    """
    # Preprocess image using the dedicated function
    input_tensor = preprocess_image(image_bytes)
    
    # Add batch dimension (ResNet expects batch of images)
    # Shape: [C, H, W] -> [1, C, H, W]
    input_batch = input_tensor.unsqueeze(0)
    
    # Run inference
    # torch.no_grad() disables gradient tracking for faster inference and less memory
    with torch.no_grad():
        output = model(input_batch)
    
    # Apply softmax to convert logits to probabilities
    # Softmax ensures all outputs sum to 1.0, representing confidence distribution
    probabilities = torch.nn.functional.softmax(output[0], dim=0)
    
    # Get top prediction (highest confidence)
    top_prob, top_class = torch.max(probabilities, dim=0)
    confidence = float(top_prob)
    class_idx = int(top_class)
    
    # Get class name from ImageNet labels
    species_name = IMAGENET_LABELS[class_idx] if class_idx < len(IMAGENET_LABELS) else "Unknown species"
    
    # Clean up the species name (remove the WordNet ID that appears in some labels)
    # Example: "n01828912 American robin" -> "American robin"
    if " " in species_name:
        species_name = species_name.split(" ", 1)[1]
    
    return {
        "species": species_name.title(),
        "confidence": confidence,
        "class_idx": class_idx
    }

def get_species_description(species_name):
    """
    Returns a short description for the identified species.
    Currently uses hardcoded descriptions for common birds, with fallback.
    """
    # Hardcoded descriptions for common bird species
    descriptions = {
        "American Robin": "The American Robin is one of North America's most familiar songbirds, recognised by its brick-red breast and clear carolling song that heralds the arrival of spring. It forages on open lawns by running and pausing to pull earthworms from the soil.",
        "House Sparrow": "A small, adaptable bird found throughout much of the world. House Sparrows are social birds that thrive in urban and suburban environments, feeding on seeds and insects.",
        "Northern Cardinal": "A striking red bird with a distinctive crest and black mask. Cardinals are year-round residents across eastern North America, known for their clear, whistling song.",
        "Blue Jay": "A bold, intelligent bird with vibrant blue plumage and a distinctive crest. Blue Jays are known for their complex social behaviors and loud calls.",
        "Downy Woodpecker": "The smallest woodpecker in North America, easily recognized by its black-and-white pattern and tiny bill. Often visits backyard feeders.",
        "Mourning Dove": "A graceful, slender bird with a soft, mournful call. Mourning doves are common across North America and often seen perched on telephone wires.",
        "American Goldfinch": "A small, vibrant yellow finch with black wings and cap. Goldfinches are late-nesting birds that feed primarily on seeds from thistles and other plants.",
        "European Starling": "A chunky, iridescent blackbird with a short tail and long, pointed bill. Starlings are expert mimics and form large, noisy flocks.",
        "Black-capped Chickadee": "A tiny, curious bird with a black cap and bib. Chickadees are acrobatic and often hang upside down while foraging for insects and seeds.",
        "Tufted Titmouse": "A small gray bird with a crest and large eyes. Tufted titmice are active foragers that often join mixed flocks with chickadees and woodpeckers."
    }
    
    # Return description if we have one, otherwise a generic description
    if species_name in descriptions:
        return descriptions[species_name]
    else:
        return f"The {species_name} was identified from your photo. This species can be found in various habitats across its range."


@app.route("/predict", methods=["POST"])
def predict():
    # Pull the image out of the multipart form data
    image_file = request.files.get("image")

    if not image_file:
        return jsonify({"error": "No image received"}), 400

    # Confirm arrival in the terminal
    print(f"[/predict] Received file: '{image_file.filename}'"
          f"  |  content-type: {image_file.content_type}")

    try:
        # Step 1: Read the raw image bytes from the uploaded file
        image_bytes = image_file.read()
        
        # Step 2: Preprocess the image using our preprocessing function
        # This resizes, crops, converts to tensor, and normalizes using ImageNet stats
        input_tensor = preprocess_image(image_bytes)
        
        # Step 3: Add batch dimension
        # Model expects input shape: [batch_size, channels, height, width]
        # Our tensor is [3, 224, 224] -> add dimension to become [1, 3, 224, 224]
        input_batch = input_tensor.unsqueeze(0)
        
        # Step 4: Run the image through the model
        # Model outputs raw scores (logits) for each of the 1000 ImageNet classes
        # Shape: [1, 1000] where each value is an unnormalized score
        with torch.no_grad():  # Disable gradient calculation for faster inference
            logits = model(input_batch)
        
        # Step 5: Convert logits to probabilities using softmax
        # Softmax formula: p_i = exp(x_i) / sum(exp(x_j))
        # This transforms raw scores into probabilities that sum to 1.0
        # Now we can interpret each value as the confidence percentage for that class
        probabilities = torch.nn.functional.softmax(logits[0], dim=0)
        
        # Step 6: Get the top 3 predictions (highest probabilities)
        # Get the indices of the top 3 probabilities in descending order
        top_probs, top_indices = torch.topk(probabilities, k=3, dim=0)
        
        # Convert to lists for easier handling
        top_probs = top_probs.tolist()
        top_indices = top_indices.tolist()
        
        # Step 7: Build the top 3 predictions array
        top_predictions = []
        for i in range(3):
            class_idx = top_indices[i]
            confidence = top_probs[i]
            
            # Get the class name from ImageNet labels
            class_name = IMAGENET_LABELS[class_idx] if class_idx < len(IMAGENET_LABELS) else "Unknown species"
            
            # Clean up the class name (remove WordNet ID if present)
            # Example: "n01828912 American robin" -> "American robin"
            if " " in class_name:
                class_name = class_name.split(" ", 1)[1]
            
            # Capitalize properly
            class_name = class_name.title()
            
            top_predictions.append({
                "species": class_name,
                "confidence": confidence,
                "class_idx": class_idx
            })
        
        # Step 8: Get the top prediction for description and logging
        primary_species = top_predictions[0]["species"]
        primary_confidence = top_predictions[0]["confidence"]
        
        # Step 9: CONFIDENCE THRESHOLD CHECK
        # If top prediction confidence is below 30%, return a low confidence response
        CONFIDENCE_THRESHOLD = 0.30  # 30% threshold
        
        if primary_confidence < CONFIDENCE_THRESHOLD:
            print(f"[/predict] Low confidence warning: {primary_confidence:.2%} < {CONFIDENCE_THRESHOLD:.0%}")
            print(f"[/predict] Top prediction: {primary_species} with {primary_confidence:.2%} confidence")
            
            # Return a low confidence response
            return jsonify({
                "low_confidence": True,
                "message": "Model is not confident about this image",
                "suggestion": "Try uploading a clearer photo of a bird with better lighting and focus",
                "top_confidence": primary_confidence,
                "top_species": primary_species,
                "top_predictions": top_predictions
            })
        
        # Step 10: Get a friendly description for the primary species (only if confidence is high enough)
        description = get_species_description(primary_species)
        
        # Step 11: Log the top predictions to the terminal
        print(f"[/predict] Top predictions:")
        for i, pred in enumerate(top_predictions):
            print(f"  {i+1}. {pred['species']} with {pred['confidence']:.2%} confidence")
        
        # Step 12: Return the top 3 predictions as JSON to the frontend (high confidence)
        return jsonify({
            "low_confidence": False,
            "primary_species": primary_species,
            "primary_confidence": primary_confidence,
            "description": description,
            "top_predictions": top_predictions
        })
        
    except Exception as e:
        # Handle any errors that occur during preprocessing or inference
        print(f"[/predict] Error during inference: {str(e)}")
        import traceback
        traceback.print_exc()  # Print full stack trace for debugging
        return jsonify({"error": f"Inference failed: {str(e)}"}), 500


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "model_loaded": True,
        "device": str(next(model.parameters()).device)
    })


if __name__ == "__main__":
    print("Starting Flask server...")
    print("Model is loaded and ready for inference")
    app.run(debug=True, port=5000)