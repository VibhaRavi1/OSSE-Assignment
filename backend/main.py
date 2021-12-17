from flask import Flask, request, jsonify
from flask_cors import CORS
import json

app = Flask(__name__)
CORS(app)


@app.route('/webapi/messages', methods=['POST'])
def message():
    input_json = request.get_json(force=True)
    output_json = jsonify(input_json)

    with open('message.json', 'w') as f:
        json.dump(input_json, f)
    return output_json


@app.route('/webapi/messages', methods=['GET'])
def messages():
    with open('message.json', 'r') as f:
        message_out = json.load(f)
    return message_out


if __name__ == "__main__":
    app.run()