"""Basic Flask application entry point."""

from flask import Flask

app = Flask(__name__)


@app.route("/")
def index() -> str:
    """Return a simple greeting to verify the server is running."""
    return "Hello, Flask!"


if __name__ == "__main__":
    app.run(debug=True)
