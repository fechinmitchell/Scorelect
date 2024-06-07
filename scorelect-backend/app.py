from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

coords = []

@app.route('/save-coordinates', methods=['POST'])
def save_coordinates():
  data = request.get_json()
  coords.extend(data)
  return jsonify({'message': 'Coordinates saved successfully'})

if __name__ == '__main__':
    app.run(debug=True, port=5001)

