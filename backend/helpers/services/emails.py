from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def send_templated_email(*, to, subject, template_name, context=None):
    recipients = [to] if isinstance(to, str) else list(to)
    base_context = {
        "site_name": settings.SITE_NAME,
        "frontend_url": settings.FRONTEND_URL,
        "support_email": settings.SUPPORT_EMAIL,
        "current_year": datetime.now().year,
    }
    base_context.update(context or {})

    html = render_to_string(f"emails/{template_name}.html", base_context)
    text = strip_tags(html)
    message = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=recipients,
    )
    message.attach_alternative(html, "text/html")
    return message.send(fail_silently=False)
