from flask import Flask, request, jsonify, send_from_directory, session
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import os
import cv2
import numpy as np
from keras.models import load_model
from werkzeug.utils import secure_filename
import pickle 
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = 'your_secret_key_here' 

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, 'database.db')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

FLOOD_MODEL_PATH = os.path.join(BASE_DIR, "flood_detection_model.keras")
flood_model = None
try:
    if os.path.exists(FLOOD_MODEL_PATH):
        flood_model = load_model(FLOOD_MODEL_PATH)
        logging.info("Flood detection model loaded successfully.")
    else:
        logging.error(f"Flood detection model not found at: {FLOOD_MODEL_PATH}")
except Exception as e:
    logging.error(f"Error loading flood detection model: {e}")


WQI_MODEL_PATH = os.path.join(BASE_DIR, "reg_model.pkl")
wqi_model = None
try:
    if os.path.exists(WQI_MODEL_PATH):

        with open(WQI_MODEL_PATH, 'rb') as file:
            wqi_model = pickle.load(file, encoding='latin1') 
        logging.info("WQI regression model loaded successfully.")
    else:
        logging.error(f"WQI regression model not found at: {WQI_MODEL_PATH}")
except Exception as e:
    logging.error(f"Error loading WQI regression model: {e}")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT NOT NULL,
            password TEXT NOT NULL,
            last_active TEXT
        )
    ''')
    conn.commit()
    conn.close()
    logging.info("Database initialized/checked.")

init_db()

def get_wqi_category(wqi_score):
    """
    Classifies the Water Quality Index score into a category.
    """
    if wqi_score >= 91:
        return 'Very Poor'
    elif wqi_score >= 71:
        return 'Poor'
    elif wqi_score >= 51:
        return 'Medium'
    elif wqi_score >= 26:
        return 'Good'
    else:
        return 'Excellent'

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/Mainpages/<path:filename>')
def serve_mainpages(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'Mainpages'), filename)

@app.route('/Style/<path:filename>')
def serve_styles(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'Style'), filename)

@app.route('/Script/<path:filename>')
def serve_scripts(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'Script'), filename)

@app.route('/Image/<path:filename>')
def serve_images(filename):
    return send_from_directory(os.path.join(BASE_DIR, 'Image'), filename)


@app.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify({'message': 'Missing required fields'}), 400

    hashed_password = generate_password_hash(password)

    try:
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('INSERT INTO users (username, email, password, last_active) VALUES (?, ?, ?, datetime("now"))',
                  (username, email, hashed_password))
        conn.commit()
        user_id = c.lastrowid
        conn.close()
        logging.info(f"User {username} created successfully.")
        return jsonify({'id': user_id, 'message': 'User created successfully'}), 201
    except sqlite3.IntegrityError:
        logging.warning(f"Signup failed: Username {username} already exists.")
        return jsonify({'message': 'Username already exists'}), 409
    except Exception as e:
        logging.error(f"Error during signup: {e}")
        return jsonify({'message': 'An error occurred during signup.'}), 500

@app.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    if not all([username, password]):
        return jsonify({'message': 'Missing username or password'}), 400

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT id, password FROM users WHERE username = ?', (username,))
    result = c.fetchone()
    conn.close() 

    if result and check_password_hash(result[1], password):
        user_id = result[0]
        
        conn = sqlite3.connect(DB_PATH)
        c = conn.cursor()
        c.execute('UPDATE users SET last_active = datetime("now") WHERE id = ?', (user_id,))
        conn.commit()
        conn.close()

        session['user_id'] = user_id
        session['username'] = username
        logging.info(f"User {username} logged in successfully.")
        return jsonify({
            'user': {'id': user_id, 'username': username},
            'message': 'Login successful',
            'redirect': '/Mainpages/Profile.html'
        })
    else:
        logging.warning(f"Login failed for username: {username}")
        return jsonify({'message': 'Invalid username or password'}), 401

@app.route('/get_user_data')
def get_user_data():
    if 'user_id' not in session:
        return jsonify({'error': 'Not logged in'}), 401

    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('SELECT username, email, last_active FROM users WHERE id = ?', (session['user_id'],))
    user = c.fetchone()
    conn.close()

    if user:
        return jsonify({
            'username': user[0],
            'email': user[1],
            'last_active': user[2]
        })
    else:
        logging.error(f"User data not found for session user_id: {session['user_id']}")
        return jsonify({'error': 'User not found'}), 404

@app.route('/detect', methods=['POST'])
def detect_flood():
    if flood_model is None:
        return jsonify({'error': 'Flood detection model not loaded.'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    media_type = request.form.get('mediaType')

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)
    app.logger.info(f"Processing {media_type} file: {filename}")

    try:
        if media_type == 'image':
            img = cv2.imread(filepath)
            if img is None:
                return jsonify({'error': 'Invalid image file (could not read)'}), 400

            img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img = cv2.resize(img, (224, 224)) / 255.0
            img = np.expand_dims(img, axis=0) 

           
            prediction = flood_model.predict(img, verbose=0)[0]
            flood_prob = float(prediction[1]) 
            is_flood = flood_prob > 0.5
            confidence = flood_prob * 100 if is_flood else (1 - flood_prob) * 100
            result_text = 'Flood Detected: YES' if is_flood else 'Flood Detected: NO'

            app.logger.info(f"Image result: {result_text} (Confidence: {confidence:.1f}%)")
            return jsonify({
                "type": "image",
                "result": result_text,
                "confidence": confidence,
                "is_flood": is_flood
            })

        elif media_type == 'video':
            cap = cv2.VideoCapture(filepath)
            if not cap.isOpened():
                return jsonify({'error': 'Could not open video'}), 400

            total_frames_raw = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0 # Default to 30 if FPS is 0
            duration = total_frames_raw / fps if fps > 0 else 0

            app.logger.info(f"Video info: {total_frames_raw} frames, {fps:.1f} FPS, {duration:.1f} seconds")

            if duration > 60:  # Very long videos: sample less frequently
                frame_interval = int(fps * 2) if fps > 1 else 2 # Sample every 2 seconds
                max_frames_to_process = min(150, total_frames_raw // frame_interval) # Cap at 150 sampled frames
            elif duration > 15: # Medium videos: sample every second
                frame_interval = int(fps) if fps > 1 else 1 # Sample every 1 second
                max_frames_to_process = min(100, total_frames_raw // frame_interval) # Cap at 100 sampled frames
            else: 
                frame_interval = 1
                max_frames_to_process = total_frames_raw

            flood_frames = 0
            processed_frames_count = 0
            
            # Use specific frame indices to sample
            frame_indices_to_process = []
            for i in range(0, total_frames_raw, frame_interval):
                if processed_frames_count < max_frames_to_process:
                    frame_indices_to_process.append(i)
                    processed_frames_count += 1
                else:
                    break

            if not frame_indices_to_process:
                 return jsonify({'error': 'Video too short or no frames selected for processing.'}), 400


            for i, frame_index in enumerate(frame_indices_to_process):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
                ret, frame = cap.read()
                if not ret:
                    logging.warning(f"Could not read frame at index {frame_index}. Stopping video processing.")
                    break

                # Process frame
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame_resized = cv2.resize(frame, (224, 224)) / 255.0
                frame_resized = np.expand_dims(frame_resized, axis=0)

                prediction = flood_model.predict(frame_resized, verbose=0)[0]
                flood_prob = prediction[1]
                if flood_prob > 0.5:
                    flood_frames += 1

                # Log progress
                if (i + 1) % max(1, len(frame_indices_to_process) // 10) == 0:
                    progress = ((i + 1) / len(frame_indices_to_process)) * 100
                    app.logger.info(f"Video Processing: {progress:.0f}% complete ({i+1}/{len(frame_indices_to_process)} frames)")

            cap.release()

            if processed_frames_count == 0:
                return jsonify({'error': 'No frames processed from video'}), 400

            flood_percentage = (flood_frames / processed_frames_count) * 100
            is_flood = flood_percentage > 50 # Consider flood if more than 50% of sampled frames show flood
            result_text = f'Flood detected in {flood_percentage:.1f}% of frames'

            app.logger.info(f"Video result: {result_text} ({processed_frames_count} frames analyzed)")
            return jsonify({
                "type": "video",
                "result": result_text,
                "flood_frames": flood_frames,
                "total_frames_analyzed": processed_frames_count,
                "flood_percentage": flood_percentage,
                "is_flood": is_flood
            })

        else:
            return jsonify({'error': 'Invalid media type provided for detection'}), 400

    except Exception as e:
        app.logger.error(f"Detection error: {str(e)}", exc_info=True)
        return jsonify({'error': 'An internal error occurred during detection.'}), 500

    finally:
        # Clean up uploaded file
        if os.path.exists(filepath):
            os.remove(filepath)
            app.logger.info(f"Cleaned up uploaded file: {filename}")


@app.route('/calculate_wqi', methods=['POST'])
def calculate_wqi():
    if wqi_model is None:
        logging.error("WQI model is not loaded. Cannot calculate WQI.")
        return jsonify({'error': 'Water Quality Index model not loaded.'}), 500

    try:
        data = request.get_json()
        logging.info(f"Received WQI data: {data}")

        feature_keys = [
            'Temperature',
            'Dissolved_Oxygen',
            'pH',
            'Bio_Chemical_Oxygen_Demand_mg_L',
            'Faecal_Streptococci_MPN_100_mL',
            'Nitrate_mg_L',
            'Faecal_Coliform_MPN_100_mL',
            'Total_Coliform_MPN_100_mL',
            'Conductivity_mho_Cm'
        ]

        features = []
        for key in feature_keys:
            if key not in data:
                logging.error(f"Missing required WQI feature: {key}")
                return jsonify({'error': f'Missing data for feature: {key}. Please ensure all fields are provided.'}), 400
            features.append(float(data[key])) 

        input_data = np.array(features).reshape(1, -1)
        wqi_score = wqi_model.predict(input_data)[0]
        wqi_category = get_wqi_category(wqi_score)

        logging.info(f"Calculated WQI: Score={wqi_score:.2f}, Category={wqi_category}")
        return jsonify({'wqi_score': wqi_score, 'wqi_category': wqi_category})

    except ValueError as e:
        logging.error(f"Invalid input data type for WQI calculation: {e}")
        return jsonify({'error': f'Invalid input data: {e}. Please ensure all inputs are numbers.'}), 400
    except Exception as e:
        logging.error(f"An unexpected error occurred during WQI calculation: {e}", exc_info=True)
        return jsonify({'error': 'An internal error occurred during WQI calculation.'}), 500


if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)