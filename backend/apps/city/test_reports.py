import io
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient
from apps.users.auth_cookies import build_refresh_token
from apps.users.models import User
from .models import CitizenRequest, CitizenRequestAttachment, CitizenRequestEvent, CitizenNotification, MunicipalService


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class ReportTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.temp = tempfile.mkdtemp()
        self.private = Path(self.temp) / 'private'
        self.public = Path(self.temp) / 'public'
        self.settings_override = override_settings(PRIVATE_REPORT_ROOT=self.private, MEDIA_ROOT=self.public)
        self.settings_override.enable()
        self.addCleanup(self.settings_override.disable)
        self.addCleanup(shutil.rmtree, self.temp)
        self.citizen = User.objects.create_user(email='reports@example.com', password='StrongPass!2026', email_verified=True, phone_number='+261 34 00 000 00')
        self.other = User.objects.create_user(email='other-report@example.com', password='StrongPass!2026', email_verified=True)
        self.agent = User.objects.create_user(email='report-agent@example.com', password='StrongPass!2026', email_verified=True, role='agent')
        self.energy, _ = MunicipalService.objects.get_or_create(slug='energie', defaults={'name': 'Énergie', 'short_description': 'Service énergétique'})
        self.auth(self.citizen)

    def auth(self, user):
        token = build_refresh_token(user, remember=False)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(token.access_token))

    def image(self, filename='street.jpg', *, format='JPEG', exif=False):
        output = io.BytesIO()
        image = Image.new('RGB', (64,48), 'orange')
        metadata = Image.Exif()
        if exif:
            metadata[270] = 'private metadata'
        image.save(output, format=format, **({'exif': metadata} if exif else {}))
        return SimpleUploadedFile(filename, output.getvalue(), content_type='image/jpeg')

    def payload(self, **kwargs):
        return {'title': 'Lampadaire cassé', 'description': 'Le lampadaire est éteint et endommagé.',
            'location_text': 'Rue Nova, près de l’arrêt', 'incident_category': 'street_lighting', **kwargs}

    def create(self, **kwargs):
        response = self.client.post(reverse('city:citizen-report-create'), self.payload(**kwargs), format='multipart' if 'images' in kwargs or 'image' in kwargs else 'json')
        self.assertEqual(response.status_code, 201, response.data)
        return CitizenRequest.objects.get(reference=response.data['reference']), response

    def test_rich_report_preserves_all_information(self):
        occurred = (timezone.now()-timedelta(hours=2)).isoformat()
        item, response = self.create(district='Astra', street='Rue Nova', building='B12', landmark='Arrêt de bus',
            latitude='-21.453600', longitude='47.085700', location_accuracy='4.50', occurred_at=occurred,
            frequency='recurring', infrastructure_id='LP-012', severity='major', danger_present=True,
            people_affected=25, impacts_accessibility=True, accessibility_details='Trottoir impraticable',
            allow_contact=True, preferred_contact='phone', contact_phone='+261 34 99 999 99')
        self.assertEqual(item.district, 'Astra')
        self.assertEqual(item.frequency, 'recurring')
        self.assertEqual(item.people_affected, 25)
        self.assertEqual(item.priority, 'urgent')
        self.assertEqual(item.accessibility_details, 'Trottoir impraticable')
        self.assertEqual(item.infrastructure_id, 'LP-012')
        self.assertEqual(item.routing_source, 'automatic')
        self.assertEqual(item.service_id, self.energy.pk)
        self.assertFalse(response.data['needs_triage'])
        self.assertTrue(item.timeline_events.filter(event_type='created').exists())
        self.assertTrue(CitizenNotification.objects.filter(user=self.citizen, related_request=item).exists())

    def test_create_accepts_multiple_images_and_private_download(self):
        item, response = self.create(images=[self.image(), self.image('other.jpg')], image_captions=['Vue globale','Détail'])
        self.assertEqual(len(response.data['attachments']), 2)
        self.assertEqual(response.data['attachment_count'], 2)
        first = item.attachments.first()
        self.assertEqual(first.caption, 'Vue globale')
        self.assertTrue(Path(first.image.path).is_relative_to(self.private))
        self.assertFalse(self.public.exists())
        with self.assertRaises(ValueError):
            _ = first.image.url
        url = reverse('city:report-image-download', kwargs={'pk': first.pk})
        downloaded = self.client.get(url)
        self.assertEqual(downloaded.status_code, 200)
        self.assertEqual(downloaded['Content-Type'], 'image/jpeg')
        self.assertIn('no-store', downloaded['Cache-Control'])
        self.assertEqual(downloaded['X-Content-Type-Options'], 'nosniff')
        body = b''.join(downloaded.streaming_content)
        self.assertTrue(body.startswith(b'\xff\xd8'))
        self.assertEqual(first.width, 64)
        self.assertEqual(first.height, 48)
        self.assertEqual(first.size_bytes, len(body))
        self.client.credentials()
        self.assertEqual(self.client.get(url).status_code, 401)
        self.auth(self.other)
        self.assertEqual(self.client.get(url).status_code, 404)
        self.auth(self.agent)
        self.assertEqual(self.client.get(url).status_code, 200)

    def test_single_image_field_and_metadata_removal(self):
        item, _ = self.create(image=self.image(exif=True))
        with Image.open(item.attachments.first().image.path) as image:
            self.assertFalse(image.getexif())

    def test_generic_report_endpoint_cannot_bypass_location(self):
        response = self.client.post(reverse('city:citizen-request-list'),
            {'request_type': 'report', 'title': 'Signalement', 'description': 'Une anomalie'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(CitizenRequest.objects.exists())

    def test_coordinates_are_paired_bounded_and_future_date_rejected(self):
        for fields in ({'latitude': '-21'}, {'latitude':'91','longitude':'47'},
            {'latitude':'-21','longitude':'181'}, {'location_accuracy':'-1'},
            {'occurred_at':(timezone.now()+timedelta(days=1)).isoformat()}):
            response = self.client.post(reverse('city:citizen-report-create'), self.payload(**fields), format='json')
            self.assertEqual(response.status_code, 400, response.data)
        item, _ = self.create(location_text='', latitude='0', longitude='0')
        self.assertEqual(item.latitude, 0)

    def test_missing_service_is_triaged_and_manual_service_is_validated(self):
        item, response = self.create(incident_category='custom problem')
        self.assertIsNone(item.service)
        self.assertTrue(response.data['needs_triage'])
        self.assertIn('orienté', response.data['confirmation']['message'])
        self.energy.is_active = False
        self.energy.save()
        response = self.client.post(reverse('city:citizen-report-create'), self.payload(service=self.energy.pk), format='json')
        self.assertEqual(response.status_code, 400)
        item, _ = self.create()
        self.assertIsNone(item.service_id)

    def test_private_notes_and_images_are_hidden_from_every_citizen_surface(self):
        item, _ = self.create()
        self.auth(self.agent)
        response = self.client.post(reverse('city:agent-request-timeline', kwargs={'reference': item.reference}),
            {'title':'Contrôle interne', 'message':'SECRET_INTERNAL', 'is_public':False, 'images':[self.image()]}, format='multipart')
        self.assertEqual(response.status_code, 201, response.data)
        hidden = item.attachments.get()
        self.assertFalse(hidden.is_public)
        self.auth(self.citizen)
        for route in ('citizen-request-detail', 'report-detail', 'citizen-request-timeline', 'report-messages', 'report-attachments'):
            response = self.client.get(reverse('city:'+route, kwargs={'reference':item.reference}))
            self.assertEqual(response.status_code, 200, response.data)
            self.assertNotIn('SECRET_INTERNAL', str(response.data))
            self.assertNotIn(str(hidden.pk), str(response.data))
        self.assertEqual(self.client.get(reverse('city:report-image-download', kwargs={'pk':hidden.pk})).status_code, 404)
        history = self.client.get(reverse('city:citizen-request-history'))
        self.assertEqual(history.data['results'][0]['attachment_count'], 0)
        filtered = self.client.get(reverse('city:citizen-report-create'), {'has_images':'true'})
        self.assertEqual(filtered.data['count'], 0)

    def test_history_search_filters_pagination_and_ownership(self):
        first, _ = self.create(district='Astra', images=[self.image()])
        second, _ = self.create(title='Autre incident', incident_category='water_leak', district='Boreal')
        self.auth(self.other)
        third, _ = self.create(title='Un dossier tiers')
        self.auth(self.citizen)
        response = self.client.get(reverse('city:citizen-request-history'), {'type':'report','search':'Lampadaire', 'has_images':'true','district':'Astra'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(response.data['results'][0]['reference'], first.reference)
        all_history = self.client.get(reverse('city:citizen-report-create'), {'page_size':1})
        self.assertEqual(all_history.data['count'], 2)
        self.assertEqual(len(all_history.data['results']), 1)
        self.assertNotIn(third.reference, str(all_history.data))
        invalid = self.client.get(reverse('city:citizen-request-history'), {'created_from':'bad-date'})
        self.assertEqual(invalid.status_code, 400)
        self.assertEqual(self.client.get(reverse('city:report-detail', kwargs={'reference':third.reference})).status_code, 404)

    def test_citizen_corrections_and_processing_rules(self):
        item, _ = self.create()
        url = reverse('city:report-detail', kwargs={'reference':item.reference})
        response = self.client.patch(url, {'description':'Correction détaillée','landmark':'Mairie'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        item.refresh_from_db()
        self.assertEqual(item.landmark, 'Mairie')
        self.auth(self.agent)
        processed = self.client.patch(reverse('city:agent-request-detail', kwargs={'reference':item.reference}), {'status':'in_progress','assigned_to':self.agent.pk}, format='json')
        self.assertEqual(processed.status_code, 200, processed.data)
        self.auth(self.citizen)
        self.assertEqual(self.client.patch(url, {'description':'Modification tardive'}, format='json').status_code, 400)
        self.assertEqual(self.client.post(reverse('city:report-messages', kwargs={'reference':item.reference}), {'message':'Complément après traitement','images':[self.image()]}, format='multipart').status_code, 201)

    def test_agent_status_requires_fresh_explanation_and_citizen_can_reply(self):
        item, _ = self.create()
        self.auth(self.agent)
        url = reverse('city:agent-request-detail', kwargs={'reference':item.reference})
        self.assertEqual(self.client.patch(url, {'status':'action_required'}, format='json').status_code, 400)
        response = self.client.patch(url, {'status':'action_required','resolution_summary':'Merci de préciser le numéro du lampadaire.','assigned_to':self.agent.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.auth(self.citizen)
        response = self.client.post(reverse('city:report-messages', kwargs={'reference':item.reference}), {'message':'Le numéro est LP-012.'}, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        item.refresh_from_db()
        self.assertEqual(item.status, 'in_progress')
        self.assertTrue(CitizenNotification.objects.filter(user=self.agent, related_request=item).exists())
        self.auth(self.agent)
        self.assertEqual(self.client.patch(url, {'status':'completed'}, format='json').status_code, 400)
        resolved = self.client.patch(url, {'status':'completed','resolution_summary':'Ampoule et alimentation remplacées.'}, format='json')
        self.assertEqual(resolved.status_code, 200, resolved.data)
        item.refresh_from_db()
        self.assertIsNotNone(item.resolved_at)
        self.assertIsNotNone(item.closed_at)
        self.assertTrue(item.timeline_events.filter(message='Ampoule et alimentation remplacées.').exists())

    def test_completion_reopen_and_rejection_flow(self):
        item, _ = self.create()
        self.auth(self.agent)
        url = reverse('city:agent-request-detail', kwargs={'reference':item.reference})
        self.client.patch(url, {'status':'completed','resolution_summary':'Problème résolu.'}, format='json')
        self.assertEqual(self.client.patch(url, {'status':'pending'}, format='json').status_code, 400)
        self.auth(self.citizen)
        self.assertEqual(self.client.post(reverse('city:report-messages', kwargs={'reference':item.reference}), {'message':'Encore cassé'}, format='json').status_code, 400)
        reopened = self.client.post(reverse('city:report-reopen', kwargs={'reference':item.reference}), {'reason':'La lumière reste éteinte.'}, format='json')
        self.assertEqual(reopened.status_code, 200, reopened.data)
        item.refresh_from_db()
        self.assertEqual(item.reopened_count, 1)
        self.assertEqual(item.status, 'pending')
        self.assertIsNone(item.closed_at)
        self.auth(self.agent)
        rejected = self.client.patch(url, {'status':'rejected','resolution_summary':'Équipement relevant d’un gestionnaire privé.'}, format='json')
        self.assertEqual(rejected.status_code, 200, rejected.data)
        self.assertEqual(self.client.post(reverse('city:agent-report-reopen', kwargs={'reference':item.reference}), {'reason':'Un nouvel élément permet le traitement municipal.'}, format='json').status_code, 200)

    def test_cancel_preserves_history_and_removes_from_open_statistics(self):
        item, _ = self.create()
        response = self.client.post(reverse('city:report-cancel', kwargs={'reference':item.reference}), {'reason':'Erreur de localisation.'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        item.refresh_from_db()
        self.assertEqual(item.status, 'cancelled')
        self.assertEqual(self.client.get(reverse('city:report-summary')).data['open'], 0)
        self.auth(self.agent)
        summary = self.client.get(reverse('city:agent-request-summary'))
        self.assertEqual(summary.data['open'], 0)
        self.assertEqual(summary.data['awaiting_handling'], 0)
        self.assertTrue(CitizenRequest.objects.filter(pk=item.pk).exists())

    def test_upload_validates_content_size_count_and_captions(self):
        bad = SimpleUploadedFile('fake.jpg', b'<svg><script>alert(1)</script></svg>', content_type='image/jpeg')
        response = self.client.post(reverse('city:citizen-report-create'), self.payload(images=[bad]), format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(CitizenRequest.objects.exists())
        large = SimpleUploadedFile('large.jpg', b'x' * (8*1024*1024+1), content_type='image/jpeg')
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(image=large), format='multipart').status_code, 400)
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(images=[self.image() for _ in range(11)]), format='multipart').status_code, 400)
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(images=[self.image(), self.image()], image_captions=['une seule']), format='multipart').status_code, 400)
        self.assertFalse(CitizenRequest.objects.exists())

    def test_file_writes_are_cleaned_if_notification_or_database_fails(self):
        with patch('apps.city.views._create_request_event', side_effect=RuntimeError('event failure')):
            response = self.client.post(reverse('city:citizen-report-create'), self.payload(image=self.image()), format='multipart')
        self.assertEqual(response.status_code, 500)
        self.assertFalse(CitizenRequest.objects.exists())
        self.assertFalse(CitizenRequestAttachment.objects.exists())
        self.assertEqual(list(self.private.rglob('*.jpg')), [])

    def test_uploader_caption_edit_delete_and_evidence_lock(self):
        item, _ = self.create(image=self.image())
        proof = item.attachments.get()
        url = reverse('city:report-attachment-detail', kwargs={'pk':proof.pk})
        self.assertEqual(self.client.patch(url, {'caption':'Lampadaire vu de près'}, format='json').status_code, 200)
        self.auth(self.agent)
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.auth(self.citizen)
        path = Path(proof.image.path)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(url)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(path.exists())
        self.assertFalse(item.attachments.exists())

    def test_duplicate_reference_is_internal_and_cycle_rejected(self):
        first, _ = self.create()
        second, _ = self.create(title='Même problème')
        self.auth(self.agent)
        url = reverse('city:agent-request-detail', kwargs={'reference':second.reference})
        response = self.client.patch(url, {'duplicate_of':first.pk}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.patch(reverse('city:agent-request-detail', kwargs={'reference':first.reference}), {'duplicate_of':second.pk}, format='json').status_code, 400)
        self.auth(self.citizen)
        detail = self.client.get(reverse('city:report-detail', kwargs={'reference':second.reference}))
        self.assertNotIn('duplicate_of', detail.data)

    def test_roles_and_read_only_fields_are_enforced(self):
        item, _ = self.create(citizen=self.other.pk, status='completed', priority='low', assigned_to=self.agent.pk)
        self.assertEqual(item.citizen_id, self.citizen.pk)
        self.assertEqual(item.status, 'pending')
        self.assertIsNone(item.assigned_to_id)
        self.assertEqual(self.client.patch(reverse('city:agent-request-detail', kwargs={'reference':item.reference}), {'status':'completed'}, format='json').status_code, 403)
        self.auth(self.agent)
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(), format='json').status_code, 403)
        self.assertEqual(self.client.patch(reverse('city:agent-request-detail', kwargs={'reference':item.reference}), {'description':'Altered observation'}, format='json').status_code, 400)

    def test_agent_filters_service_slug_and_invalid_assignee(self):
        item, _ = self.create()
        self.auth(self.agent)
        response = self.client.get(reverse('city:agent-request-list'), {'service':'energie','type':'report'})
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['count'], 1)
        invalid = self.client.get(reverse('city:agent-request-list'), {'assigned_to':'invalid'})
        self.assertEqual(invalid.status_code, 400)

    def test_category_options_and_temporal_filters(self):
        response = self.client.get(reverse('city:report-categories'))
        self.assertEqual(response.status_code, 200)
        lighting = next(row for row in response.data['categories'] if row['code']=='street_lighting')
        self.assertEqual(lighting['suggested_service'], self.energy.pk)
        item, _ = self.create()
        response = self.client.get(reverse('city:citizen-request-history'), {'created_from':timezone.now().date().isoformat(), 'created_to':timezone.now().date().isoformat()})
        self.assertEqual(response.data['count'], 1)
        self.assertEqual(self.client.get(reverse('city:citizen-request-history'), {'created_from':'2026-12-31','created_to':'2026-01-01'}).status_code, 400)

    def test_total_image_limit_is_applied_transactionally(self):
        item, _ = self.create(images=[self.image() for _ in range(10)])
        url = reverse('city:report-attachments', kwargs={'reference':item.reference})
        self.assertEqual(self.client.post(url, {'images':[self.image() for _ in range(10)]}, format='multipart').status_code, 201)
        response = self.client.post(url, {'image':self.image()}, format='multipart')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(item.attachments.count(), 20)
        self.assertEqual(len(list(self.private.rglob('*.jpg'))), 20)

    def test_contact_consent_and_required_phone(self):
        item, _ = self.create(allow_contact=False, preferred_contact='platform')
        self.assertFalse(item.allow_contact)
        self.auth(self.other)
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(preferred_contact='phone'), format='json').status_code, 400)
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'), self.payload(contact_phone='not a phone'), format='json').status_code, 400)

    def test_unsafe_private_storage_configuration_fails_system_check(self):
        from .checks import private_report_storage
        with override_settings(PRIVATE_REPORT_ROOT=self.public/'reports'):
            self.assertEqual(private_report_storage(None)[0].id, 'city.E002')

    def test_delete_account_removes_private_report_images_after_commit(self):
        item, _ = self.create(image=self.image())
        path = Path(item.attachments.get().image.path)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.delete(reverse('users:delete-account'), {'confirmation':'DELETE','current_password':'StrongPass!2026'}, format='json')
        self.assertEqual(response.status_code, 204, response.data)
        self.assertFalse(path.exists())
        self.assertFalse(CitizenRequest.objects.filter(pk=item.pk).exists())

    def test_multipart_defaults_keep_contact_permission_and_public_notes(self):
        item, response = self.create(image=self.image())
        self.assertTrue(item.allow_contact)
        self.assertIn('edit', response.data['available_actions'])
        self.assertEqual(response.data['category_label'], 'Éclairage public')
        self.auth(self.agent)
        note = self.client.post(reverse('city:agent-request-timeline', kwargs={'reference':item.reference}),
            {'title':'Prise en compte','message':'Votre dossier a été reçu.'}, format='multipart')
        self.assertEqual(note.status_code, 201, note.data)
        self.assertTrue(note.data['is_public'])
        self.auth(self.citizen)
        timeline = self.client.get(reverse('city:report-messages', kwargs={'reference':item.reference}))
        self.assertIn('Votre dossier a été reçu.', str(timeline.data))

    def test_correction_retains_coordinates_and_reorients_automatic_service(self):
        transport = MunicipalService.objects.get(slug='transport')
        item, _ = self.create(latitude='-21.45', longitude='47.08')
        response = self.client.patch(reverse('city:report-detail', kwargs={'reference':item.reference}),
            {'incident_category':'road_damage','title':'Chaussée cassée'}, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        item.refresh_from_db()
        self.assertEqual(item.service_id, transport.pk)
        self.assertEqual(item.routing_source, 'automatic')
        self.assertIsNotNone(item.latitude)

    def test_non_image_format_and_animated_image_are_rejected(self):
        stream = io.BytesIO()
        Image.new('RGB',(32,32),'red').save(stream,format='GIF')
        bad = SimpleUploadedFile('image.gif',stream.getvalue(),content_type='image/gif')
        self.assertEqual(self.client.post(reverse('city:citizen-report-create'),self.payload(image=bad),format='multipart').status_code,400)

    def test_report_creation_rate_limit_is_shared_per_account(self):
        from apps.users.services.security_otp import digest
        from apps.users.models import SecurityRateBucket
        SecurityRateBucket.objects.create(key=digest(f'report-create:{self.citizen.pk}'), started_at=timezone.now(), count=10)
        response = self.client.post(reverse('city:citizen-report-create'), self.payload(), format='json')
        self.assertEqual(response.status_code,429)
        self.assertIn('Retry-After',response)

    def test_report_schema_documents_files_filters_and_all_new_routes(self):
        from config.swagger import schema_view
        from rest_framework.test import APIRequestFactory
        response = schema_view.without_ui(cache_timeout=0)(APIRequestFactory().get('/api/schema.json'), format='.json')
        self.assertEqual(response.status_code,200)
        paths=response.data['paths']
        self.assertIn('/api/citizen/reports/{reference}/reopen/',paths)
        self.assertIn('/api/citizen/reports/attachments/{id}/download/',paths)
        params=paths['/api/citizen/reports/']['post']['parameters']
        self.assertTrue(any(p['name']=='images' and p['type']=='file' for p in params))
        self.assertTrue(any(p['name']=='severity' for p in params))
        filters=paths['/api/citizen/reports/']['get']['parameters']
        self.assertTrue(any(p['name']=='has_images' for p in filters))

    @override_settings(STORAGES={'default':{'BACKEND':'django.core.files.storage.FileSystemStorage'},'staticfiles':{'BACKEND':'django.contrib.staticfiles.storage.StaticFilesStorage'}})
    def test_admin_report_page_and_private_photo_use_authenticated_session(self):
        from django.test import Client
        item, _ = self.create(image=self.image())
        proof = item.attachments.get()
        admin = User.objects.create_superuser(email='report-admin@example.com',password='StrongPass!2026')
        browser = Client()
        private_url = reverse('admin:city_report_image',kwargs={'pk':proof.pk})
        self.assertEqual(browser.get(private_url).status_code,302)
        browser.force_login(admin)
        response = browser.get(reverse('admin:city_citizenrequest_change',args=[item.pk]))
        self.assertEqual(response.status_code,200)
        self.assertContains(response,'Photo privée')
        self.assertNotContains(response,'name="description"')
        photo = browser.get(private_url)
        self.assertEqual(photo.status_code,200)
        self.assertEqual(photo['Content-Type'],'image/jpeg')
        self.assertIn('no-store',photo['Cache-Control'])
        photo.close()

    def test_admin_processing_form_rejects_unexplained_completion(self):
        from types import SimpleNamespace
        from .admin import RequestProcessingForm
        item, _ = self.create()
        class BoundForm(RequestProcessingForm):
            http_request = SimpleNamespace(user=self.agent)
        form = BoundForm(data={'citizen':self.citizen.pk,'request_type':'report','title':item.title,
            'description':item.description,'incident_category':item.incident_category,'status':'completed',
            'priority':'normal','frequency':'once','severity':'moderate','preferred_contact':'platform'},instance=item)
        self.assertFalse(form.is_valid())
        self.assertIn('résultat',str(form.errors).lower())
