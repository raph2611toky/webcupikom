SUPPORTED_LANGUAGES = (
    {"code": "fr", "label": "Français"},
    {"code": "en", "label": "English"},
)
SUPPORTED_LANGUAGE_CODES = {item["code"] for item in SUPPORTED_LANGUAGES}

ONBOARDING_STEPS = ("welcome", "profile", "services", "request", "done")
