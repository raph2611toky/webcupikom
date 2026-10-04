import hashlib
import io
import re
import warnings
from contextlib import contextmanager
from contextvars import ContextVar
from pathlib import Path

from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

from ..models import CitizenRequest, CitizenRequestEvent, CitizenRequestAttachment, CitizenNotification, MunicipalService

MAX_IMAGES = 20
MAX_UPLOAD_IMAGES = 10
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 20_000_000
CLOSED = (CitizenRequest.Status.COMPLETED, CitizenRequest.Status.CANCELLED, CitizenRequest.Status.REJECTED)
TRANSITIONS = {
    'submitted': {'pending', 'in_progress', 'action_required', 'completed', 'rejected'},
    'pending': {'in_progress', 'action_required', 'completed', 'rejected'},
    'in_progress': {'pending', 'action_required', 'completed', 'rejected'},
    'action_required': {'pending', 'in_progress', 'completed', 'rejected'},
    'completed': set(), 'cancelled': set(), 'rejected': set(),
}
CATEGORIES = [
    {'code': 'street_lighting', 'label': 'Éclairage public', 'service_slug': 'energie', 'aliases': ['lampadaire', 'eclairage', 'éclairage', 'lighting']},
    {'code': 'road_damage', 'label': 'Voirie et chaussée', 'service_slug': 'transport', 'aliases': ['voirie', 'route', 'nid-de-poule']},
    {'code': 'waste', 'label': 'Déchets et propreté', 'service_slug': 'environnement', 'aliases': ['dechets', 'déchets', 'proprete']},
    {'code': 'water_leak', 'label': 'Eau et fuite', 'service_slug': 'eau', 'aliases': ['eau', 'fuite']},
    {'code': 'green_spaces', 'label': 'Espaces verts', 'service_slug': 'environnement', 'aliases': ['arbre', 'espaces verts']},
    {'code': 'accessibility', 'label': 'Accessibilité des espaces publics', 'service_slug': 'transport', 'aliases': ['accessibilité', 'accessibilite']},
    {'code': 'public_safety', 'label': 'Sécurité de l’espace public', 'service_slug': 'securite', 'aliases': ['sécurité', 'securite']},
    {'code': 'medical_emergency', 'label': 'Urgence médicale', 'service_slug': 'sante', 'aliases': ['urgence médicale', 'urgence medicale', 'medical'], 'alerting': 'emergency'},
    {'code': 'fire_emergency', 'label': 'Incendie / départ de feu', 'service_slug': 'securite', 'aliases': ['incendie', 'feu'], 'alerting': 'emergency'},
    {'code': 'immediate_danger', 'label': 'Danger immédiat', 'service_slug': 'securite', 'aliases': ['danger immédiat', 'danger immediat'], 'alerting': 'emergency'},
    {'code': 'building', 'label': 'Bâtiment et équipement municipal', 'service_slug': 'habitat', 'aliases': ['batiment', 'bâtiment']},
    {'code': 'other', 'label': 'Autre problème', 'service_slug': None, 'aliases': ['autre']},
]
_written_files = ContextVar('report_written_files', default=None)


@contextmanager
def attachment_transaction():
    written = []
    token = _written_files.set(written)
    try:
        with transaction.atomic():
            yield
    except Exception:
        for storage, name in written:
            storage.delete(name)
        raise
    finally:
        _written_files.reset(token)


def normalize_image(upload):
    if upload.size > MAX_IMAGE_BYTES:
        raise ValidationError('Chaque image doit peser au maximum 8 Mio.')
    try:
        upload.seek(0)
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(upload) as image:
                if image.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValidationError('Formats autorisés : JPEG, PNG, WebP.')
                if image.width * image.height > MAX_PIXELS or getattr(image, 'n_frames', 1) != 1:
                    raise ValidationError('Image trop grande (20 mégapixels maximum) ou animée.')
                image.verify()
            upload.seek(0)
            with Image.open(upload) as image:
                from PIL import ImageOps
                image = ImageOps.exif_transpose(image)
                image.load()
                alpha = image.mode in ('RGBA', 'LA') or 'transparency' in image.info
                output = image.convert('RGBA' if alpha else 'RGB')
                output.info.clear()  # Strip EXIF/GPS, comments and embedded profiles.
                buffer = io.BytesIO()
                output.save(buffer, format='PNG' if alpha else 'JPEG', **({} if alpha else {'quality': 90}))
                data = buffer.getvalue()
                if len(data) > MAX_IMAGE_BYTES:
                    raise ValidationError('L’image normalisée dépasse 8 Mio.')
                result = ContentFile(data, name='proof.png' if alpha else 'proof.jpg')
                result.proof_metadata = {'width': output.width, 'height': output.height,
                    'size_bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                    'content_type': 'image/png' if alpha else 'image/jpeg',
                    'original_name': Path(str(upload.name).replace('\\', '/')).name[:150]}
                return result
    except ValidationError:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise ValidationError('Image invalide ou illisible.') from exc
    finally:
        upload.seek(0)


def save_images(item, images, *, uploader, event=None, is_public=True, captions=None):
    if item.attachments.count() + len(images) > MAX_IMAGES:
        raise ValidationError(f'Un dossier peut contenir au maximum {MAX_IMAGES} images.')
    attachments = []
    for index, image in enumerate(images):
        proof = CitizenRequestAttachment(request=item, event=event, uploader=uploader,
            caption=(captions[index] if captions else ''), is_public=is_public, **image.proof_metadata)
        proof.image.save(image.name, image, save=False)
        written = _written_files.get()
        if written is not None:
            written.append((proof.image.storage, proof.image.name))
        proof.save()
        attachments.append(proof)
    return attachments


def route_category(category):
    raw = str(category or '').strip().lower()
    definition = next((row for row in CATEGORIES if raw == row['code'] or raw in row['aliases']), None)
    if not definition:
        return raw or 'other', None
    service = MunicipalService.objects.filter(slug=definition['service_slug'], is_active=True).first() if definition['service_slug'] else None
    return definition['code'], service


def event(item, actor, title, message='', *, public=True, kind='note'):
    return CitizenRequestEvent.objects.create(request=item, actor=actor, title=title,
        message=message, is_public=public, event_type=kind, status=item.status)


def notify_citizen(item, actor, message, *, title='Mise à jour du signalement', important=False):
    from .notifications import schedule_notification_email
    notice = CitizenNotification.objects.create(user=item.citizen, sender=actor,
        kind=CitizenNotification.Kind.REQUEST, scope=CitizenNotification.Scope.TARGETED,
        title=f'{title} {item.reference}'[:220], message=message,
        related_request=item, action_label='Voir le signalement',
        action_url=f'/requests/{item.reference}', is_important=important)
    if important:
        schedule_notification_email(notice)
    return notice


def notify_staff(item, actor, message):
    from apps.users.models import User
    recipient = item.assigned_to
    if recipient and recipient.is_active and recipient.pk != actor.pk:
        CitizenNotification.objects.create(user=recipient, sender=actor,
            kind=CitizenNotification.Kind.REQUEST, scope=CitizenNotification.Scope.TARGETED,
            title=f'Complément {item.reference}', message=message,
            related_request=item, action_label='Voir le dossier', action_url=f'/agent/requests/{item.reference}')


def check_transition(item, new_status, summary):
    if new_status == item.status:
        return
    if new_status not in TRANSITIONS.get(item.status, set()):
        raise ValidationError({'status': 'Transition non autorisée. Utilisez le parcours de réouverture pour un dossier clôturé.'})
    if new_status in ('completed', 'rejected', 'action_required') and not str(summary or '').strip():
        raise ValidationError({'resolution_summary': 'Précisez le résultat, le motif ou les informations demandées au citoyen.'})
