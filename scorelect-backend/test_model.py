import requests
import json
import time

# Test script to evaluate model accuracy - Simple version
def test_model_accuracy():
    """
    Simple script to test the accuracy of the GAA xP/xG model.
    Run this from your local environment with access to your API.
    """
    print("="*70)
    print("GAA xP/xG MODEL ACCURACY TEST")
    print("="*70)
    
    # Configuration
    API_URL = "http://localhost:5001/recalculate-target-xpoints"
    USER_ID = "VZfCZYhgbNbRPjx8BYQa6v7u8gx1"  # Replace with your actual user ID
    TRAINING_DATASET = "GAA All Shots"  # Your training dataset name
    TARGET_DATASET = "TestShots"  # Dataset to test against
    
    # Prepare request payload
    payload = {
        "user_id": USER_ID,
        "training_dataset": TRAINING_DATASET,
        "target_dataset": TARGET_DATASET
    }
    
    print(f"Testing model with:")
    print(f"- Training data: {TRAINING_DATASET}")
    print(f"- Target data: {TARGET_DATASET}")
    print(f"- User ID: {USER_ID}")
    
    # Start timer
    start_time = time.time()
    
    # Send request to API
    try:
        print("\nSending request to model API...")
        response = requests.post(API_URL, json=payload)
        
        if response.status_code != 200:
            print(f"Error: {response.status_code}")
            print(response.text)
            return
        
        # Process response
        result = response.json()
        summary = result.get('summary', {})
        
        # Calculate elapsed time
        elapsed = time.time() - start_time
        
        # Display results
        print("\n" + "="*70)
        print("MODEL ACCURACY TEST RESULTS")
        print("="*70)
        
        # Basic stats
        print(f"Total processing time: {elapsed:.2f} seconds")
        print(f"API processing time: {summary.get('processingTime', 'N/A')} seconds")
        
        # Overall stats
        print("\nOVERALL STATISTICS:")
        print(f"Total Shots: {summary.get('totalShots', 'N/A')}")
        print(f"Successful Shots: {summary.get('successfulShots', 'N/A')}")
        print(f"Points: {summary.get('points', 'N/A')}")
        print(f"Goals: {summary.get('goals', 'N/A')}")
        print(f"Misses: {summary.get('misses', 'N/A')}")
        print(f"Average Distance (m): {summary.get('avgDistance', 'N/A')}")
        
        # Model quality metrics
        model_quality = summary.get('modelQuality', {})
        if model_quality:
            print("\nMODEL QUALITY METRICS:")
            print(f"Points Model Accuracy: {model_quality.get('points_accuracy', 'N/A')}")
            print(f"Goals Model Accuracy: {model_quality.get('goals_accuracy', 'N/A')}")
            print(f"Points Calibration Error: {model_quality.get('points_calibration', 'N/A')}")
            print(f"Goals Calibration Error: {model_quality.get('goals_calibration', 'N/A')}")
            
            # Interpretation
            points_acc = model_quality.get('points_accuracy')
            if points_acc:
                if points_acc > 0.8:
                    print("\nPoints Model: EXCELLENT (>80% accuracy)")
                elif points_acc > 0.7:
                    print("\nPoints Model: GOOD (70-80% accuracy)")
                elif points_acc > 0.6:
                    print("\nPoints Model: FAIR (60-70% accuracy)")
                else:
                    print("\nPoints Model: NEEDS IMPROVEMENT (<60% accuracy)")
            
            goals_acc = model_quality.get('goals_accuracy')
            if goals_acc:
                if goals_acc > 0.9:  # Higher threshold for goals due to imbalance
                    print("Goals Model: EXCELLENT (>90% accuracy)")
                elif goals_acc > 0.8:
                    print("Goals Model: GOOD (80-90% accuracy)")
                elif goals_acc > 0.7:
                    print("Goals Model: FAIR (70-80% accuracy)")
                else:
                    print("Goals Model: NEEDS IMPROVEMENT (<70% accuracy)")
        
        print("\n" + "="*70)
        print("TEST COMPLETED")
        print("="*70)
        
    except Exception as e:
        print(f"Error testing model: {str(e)}")

if __name__ == "__main__":
    test_model_accuracy()