from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core import signing
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

from apps.users.tokens import email_verification_token
from helpers.services.emails import send_templated_email

CHANGE_EMAIL_SALT = "users.change-email.v1"


def _name(user):
    return user.first_name or user.get_full_name().strip() or user.email.split("@", 1)[0]


def send_verification_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = email_verification_token.make_token(user)
    query = urlencode({"uid": uid, "token": token})
    link = f"{settings.FRONTEND_URL.rstrip('/')}/verify-email?{query}"
    return send_templated_email(
        to=user.email,
        subject=f"Vérifiez votre adresse email — {settings.SITE_NAME}",
        template_name="email_verification",
        context={"user": user, "display_name": _name(user), "verification_url": link},
    )


def send_welcome_email(user):
    return send_templated_email(
        to=user.email,
        subject=f"Bienvenue — {settings.SITE_NAME}",
        template_name="welcome",
        context={"user": user, "display_name": _name(user)},
    )


def send_password_reset_email(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    query = urlencode({"uid": uid, "token": token})
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?{query}"
    return send_templated_email(
        to=user.email,
        subject=f"Réinitialisation du mot de passe — {settings.SITE_NAME}",
        template_name="password_reset",
        context={"user": user, "display_name": _name(user), "reset_url": link},
    )


def send_password_changed_email(user):
    return send_templated_email(
        to=user.email,
        subject=f"Votre mot de passe a été modifié — {settings.SITE_NAME}",
        template_name="password_changed",
        context={"user": user, "display_name": _name(user)},
    )


def build_change_email_token(user, new_email):
    return signing.dumps({"user_id": user.pk, "new_email": new_email.lower(), "old_email": user.email, "security_version": user.auth_token_version}, salt=CHANGE_EMAIL_SALT)


def send_change_email_confirmation(user, new_email):
    token = build_change_email_token(user, new_email)
    query = urlencode({"token": token})
    link = f"{settings.FRONTEND_URL.rstrip('/')}/confirm-email-change?{query}"
    return send_templated_email(
        to=new_email,
        subject=f"Confirmez votre nouvelle adresse email — {settings.SITE_NAME}",
        template_name="email_change_confirmation",
        context={"user": user, "display_name": _name(user), "new_email": new_email, "confirmation_url": link},
    )


def send_email_changed_notice(*, old_email, user):
    return send_templated_email(
        to=old_email,
        subject=f"Votre adresse email a été modifiée — {settings.SITE_NAME}",
        template_name="email_changed",
        context={"user": user, "display_name": _name(user), "new_email": user.email},
    )


def send_security_alert(user, message, *, to=None):
    return send_templated_email(
        to=to or user.email,
        subject=f"Alerte de sécurité — {settings.SITE_NAME}",
        template_name="security_alert",
        context={"user": user, "display_name": _name(user), "security_message": message},
    )


def send_account_deleted_email(email, display_name):
    return send_templated_email(
        to=email,
        subject=f"Compte supprimé — {settings.SITE_NAME}",
        template_name="account_deleted",
        context={"display_name": display_name},
    )
