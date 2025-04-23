import cv2
import numpy as np
import dlib
from typing import Dict, List, Optional, Tuple
import os
import json
from datetime import datetime

class EmotionAnalyzer:
    def __init__(self):
        """Initialize emotion analyzer with facial landmarks detector"""
        # Load face detector and landmark predictor
        self.detector = dlib.get_frontal_face_detector()
        predictor_path = os.path.join(os.path.dirname(__file__), '..', '..', 'shape_predictor_68_face_landmarks.dat')
        self.predictor = dlib.shape_predictor(predictor_path)
        
        # Emotion classification thresholds
        self.emotion_thresholds = {
            'stress': 0.7,
            'neutral': 0.3,
            'relaxed': 0.4
        }
        
        # Initialize tracking variables
        self.previous_landmarks = None
        self.movement_history = []
        self.blink_count = 0
        self.last_blink_time = datetime.now()
        
    def analyze_frame(self, frame: np.ndarray) -> Dict:
        """
        Analyze emotions in a video frame
        
        Args:
            frame (np.ndarray): Video frame to analyze
            
        Returns:
            Dict: Emotion analysis results
        """
        try:
            # Convert frame to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Detect faces
            faces = self.detector(gray)
            if not faces:
                return self._get_empty_result()
                
            # Analyze primary face
            face = faces[0]
            landmarks = self.predictor(gray, face)
            
            # Extract facial features
            features = self._extract_facial_features(landmarks)
            
            # Analyze emotional indicators
            emotion_data = self._analyze_emotions(features)
            
            # Update tracking data
            self._update_tracking(landmarks)
            
            return {
                'timestamp': datetime.now().isoformat(),
                'face_detected': True,
                'emotions': emotion_data,
                'metrics': {
                    'movement': self._calculate_movement_score(),
                    'blink_rate': self._calculate_blink_rate(),
                    'facial_tension': self._calculate_facial_tension(features)
                }
            }
            
        except Exception as e:
            print(f"Error in emotion analysis: {str(e)}")
            return self._get_empty_result()
            
    def _extract_facial_features(self, landmarks) -> Dict:
        """Extract relevant facial features from landmarks"""
        features = {
            'eye_aspect_ratio': self._calculate_eye_aspect_ratio(landmarks),
            'mouth_aspect_ratio': self._calculate_mouth_aspect_ratio(landmarks),
            'eyebrow_position': self._calculate_eyebrow_position(landmarks),
            'facial_symmetry': self._calculate_facial_symmetry(landmarks)
        }
        
        return features
        
    def _analyze_emotions(self, features: Dict) -> Dict:
        """Analyze emotional state based on facial features"""
        # Calculate base emotional indicators
        stress_indicators = [
            features['eye_aspect_ratio'] < 0.2,  # Eyes narrowed
            features['eyebrow_position'] > 0.6,  # Eyebrows raised
            features['facial_symmetry'] < 0.8    # Facial asymmetry
        ]
        
        stress_score = sum(stress_indicators) / len(stress_indicators)
        
        # Determine primary emotion
        if stress_score > self.emotion_thresholds['stress']:
            primary_emotion = 'stressed'
        elif stress_score < self.emotion_thresholds['neutral']:
            primary_emotion = 'relaxed'
        else:
            primary_emotion = 'neutral'
            
        return {
            'primary': primary_emotion,
            'confidence': self._calculate_confidence(features),
            'stress_level': stress_score,
            'intensity': self._calculate_emotion_intensity(features)
        }
        
    def _calculate_eye_aspect_ratio(self, landmarks) -> float:
        """Calculate eye aspect ratio for blink detection"""
        # Extract eye landmarks
        left_eye = [(landmarks.part(36+i).x, landmarks.part(36+i).y) for i in range(6)]
        right_eye = [(landmarks.part(42+i).x, landmarks.part(42+i).y) for i in range(6)]
        
        # Calculate aspect ratio
        left_ear = self._eye_aspect_ratio(left_eye)
        right_ear = self._eye_aspect_ratio(right_eye)
        
        return (left_ear + right_ear) / 2
        
    def _eye_aspect_ratio(self, eye_points: List[Tuple[int, int]]) -> float:
        """Calculate aspect ratio of a single eye"""
        # Vertical distances
        v1 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
        v2 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
        
        return (v1 + v2) / (2.0 * h) if h > 0 else 0
        
    def _calculate_mouth_aspect_ratio(self, landmarks) -> float:
        """Calculate mouth aspect ratio"""
        mouth_points = [(landmarks.part(i).x, landmarks.part(i).y) for i in range(48, 68)]
        
        # Vertical distance
        v = np.linalg.norm(np.array(mouth_points[2]) - np.array(mouth_points[10]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(mouth_points[0]) - np.array(mouth_points[6]))
        
        return v / h if h > 0 else 0
        
    def _calculate_eyebrow_position(self, landmarks) -> float:
        """Calculate relative eyebrow position"""
        # Average eyebrow height
        eyebrow_points = [(landmarks.part(i).y) for i in range(17, 27)]
        avg_eyebrow_height = sum(eyebrow_points) / len(eyebrow_points)
        
        # Average eye height
        eye_points = [(landmarks.part(i).y) for i in range(36, 48)]
        avg_eye_height = sum(eye_points) / len(eye_points)
        
        return (avg_eye_height - avg_eyebrow_height) / 100  # Normalized distance
        
    def _calculate_facial_symmetry(self, landmarks) -> float:
        """Calculate facial symmetry score"""
        # Get midpoint of face
        nose_bridge = (landmarks.part(27).x, landmarks.part(27).y)
        
        # Calculate symmetry of key points
        symmetry_points = [
            (landmarks.part(i).x, landmarks.part(i).y) 
            for i in [0, 16, 31, 35, 48, 54]
        ]
        
        distances = []
        for point in symmetry_points:
            dist_to_midline = abs(point[0] - nose_bridge[0])
            distances.append(dist_to_midline)
            
        # Calculate symmetry score (1 = perfect symmetry)
        variance = np.var(distances)
        return 1 / (1 + variance)
        
    def _calculate_movement_score(self) -> float:
        """Calculate movement score based on landmark history"""
        if len(self.movement_history) < 2:
            return 0.0
            
        recent_movements = self.movement_history[-10:]
        return sum(recent_movements) / len(recent_movements)
        
    def _calculate_blink_rate(self) -> float:
        """Calculate blinks per minute"""
        time_diff = (datetime.now() - self.last_blink_time).total_seconds()
        if time_diff > 0:
            return (self.blink_count * 60) / time_diff
        return 0
        
    def _calculate_facial_tension(self, features: Dict) -> float:
        """Calculate facial tension score"""
        tension_indicators = [
            features['eye_aspect_ratio'] < 0.15,  # Very narrow eyes
            features['mouth_aspect_ratio'] > 0.7,  # Tight mouth
            features['eyebrow_position'] > 0.8     # Raised eyebrows
        ]
        
        return sum(tension_indicators) / len(tension_indicators)
        
    def _calculate_confidence(self, features: Dict) -> float:
        """Calculate confidence in emotion analysis"""
        # More extreme values = higher confidence
        feature_confidences = [
            abs(features['eye_aspect_ratio'] - 0.3) * 2,
            abs(features['mouth_aspect_ratio'] - 0.5) * 2,
            features['facial_symmetry']
        ]
        
        return min(sum(feature_confidences) / len(feature_confidences), 1.0)
        
    def _calculate_emotion_intensity(self, features: Dict) -> float:
        """Calculate emotional expression intensity"""
        # Combine various features to determine intensity
        intensity_factors = [
            abs(features['eye_aspect_ratio'] - 0.3) * 3,
            abs(features['mouth_aspect_ratio'] - 0.5) * 2,
            features['eyebrow_position'] * 1.5
        ]
        
        return min(sum(intensity_factors) / len(intensity_factors), 1.0)
        
    def _update_tracking(self, landmarks):
        """Update movement and blink tracking"""
        # Update movement history
        if self.previous_landmarks is not None:
            movement = self._calculate_landmark_movement(landmarks, self.previous_landmarks)
            self.movement_history.append(movement)
            if len(self.movement_history) > 30:  # Keep last 30 frames
                self.movement_history.pop(0)
                
        self.previous_landmarks = landmarks
        
        # Update blink detection
        ear = self._calculate_eye_aspect_ratio(landmarks)
        if ear < 0.2:  # Blink threshold
            self.blink_count += 1
            
    def _calculate_landmark_movement(self, current, previous) -> float:
        """Calculate movement between landmark sets"""
        movements = []
        for i in range(68):  # 68 facial landmarks
            curr_point = (current.part(i).x, current.part(i).y)
            prev_point = (previous.part(i).x, previous.part(i).y)
            movement = np.linalg.norm(np.array(curr_point) - np.array(prev_point))
            movements.append(movement)
            
        return sum(movements) / len(movements)
        
    def _get_empty_result(self) -> Dict:
        """Return empty result when no face is detected"""
        return {
            'timestamp': datetime.now().isoformat(),
            'face_detected': False,
            'emotions': {
                'primary': 'unknown',
                'confidence': 0.0,
                'stress_level': 0.0,
                'intensity': 0.0
            },
            'metrics': {
                'movement': 0.0,
                'blink_rate': 0.0,
                'facial_tension': 0.0
            }
        }
