import uuid
from pathlib import Path
from django.conf import settings
from django.core.files.storage import FileSystemStorage
from django.utils.deconstruct import deconstructible


@deconstructible
class PrivateReportStorage(FileSystemStorage):
    def __init__(self):
        super().__init__(file_permissions_mode=0o600, directory_permissions_mode=0o700)

    @property
    def base_location(self):
        return str(getattr(settings, 'PRIVATE_REPORT_ROOT', settings.BASE_DIR / 'private_uploads'))

    @property
    def location(self):
        return str(Path(self.base_location).resolve())

    def url(self, name):
        raise ValueError('Les preuves de signalement sont accessibles uniquement par l’API authentifiée.')


def report_image_path(instance, filename):
    suffix = '.png' if filename.lower().endswith('.png') else '.jpg'
    return f'reports/{instance.request_id}/{uuid.uuid4().hex}{suffix}'
