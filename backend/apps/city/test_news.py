import io
import shutil
import tempfile
from datetime import timedelta
from pathlib import Path
from unittest.mock import patch
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from django.core.management import call_command
from django.core import mail
from rest_framework.test import APITestCase
from apps.users.models import User
from apps.users.auth_cookies import build_refresh_token
from .models import NewsArticle, CitizenNotification
from .services.news import deliver_news, dispatch_news
from .services.notifications import dispatch_due_notification_emails


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class NewsTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(email='news-admin@example.com', password='StrongPass!2026', role='admin', email_verified=True)
        self.south = User.objects.create_user(email='south@example.com', password='StrongPass!2026', district='Sud', email_verified=True)
        self.north = User.objects.create_user(email='north@example.com', password='StrongPass!2026', district='Nord', email_verified=True)
        self.temp = tempfile.mkdtemp()
        self.override = override_settings(PRIVATE_REPORT_ROOT=Path(self.temp))
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(shutil.rmtree, self.temp)
        self.auth(self.admin)

    def auth(self, user):
        token = build_refresh_token(user, remember=False)
        self.client.credentials(HTTP_AUTHORIZATION='Bearer '+str(token.access_token))

    def article(self, **kwargs):
        values = {'title':'Publication municipale', 'slug':'publication', 'content':'Informations détaillées.', 'is_published':True}
        values.update(kwargs)
        return NewsArticle.objects.create(**values)

    def test_draft_default_and_citizen_permissions(self):
        r = self.client.post('/api/admin/news/', {'title':'Brouillon', 'content':'Contenu'}, format='json')
        self.assertEqual(r.status_code,201,r.data)
        self.assertFalse(r.data['is_published'])
        self.auth(self.south)
        self.assertEqual(self.client.post('/api/admin/news/', {}, format='json').status_code,403)
        self.assertEqual(self.client.get('/api/admin/news/').status_code,403)

    def test_window_and_detail(self):
        future = self.article(published_at=timezone.now()+timedelta(hours=1))
        self.assertEqual(self.client.get('/api/city/news/').data['count'],0)
        self.assertEqual(self.client.get('/api/city/news/publication/').status_code,404)
        future.published_at=timezone.now()-timedelta(hours=2)
        future.expires_at=timezone.now()-timedelta(hours=1)
        future.save()
        self.assertEqual(self.client.get('/api/city/news/publication/').status_code,404)

    def test_alert_requires_actionable_information(self):
        r=self.client.post('/api/admin/news/', {'title':'Alerte', 'content':'Informations', 'publication_type':'alert', 'is_published':True},format='json')
        self.assertEqual(r.status_code,400)
        for field in ['instructions','source_name','affected_areas','expires_at']:self.assertIn(field,r.data['errors'])

    def test_rich_alert_and_targeted_guidance(self):
        data={'title':'Information du quartier sud','content':'Texte validé par la mairie','publication_type':'alert','severity':'critical','is_published':True,'affected_areas':'Quartier sud','instructions':'Consulter les consignes officielles','source_name':'Mairie','expires_at':(timezone.now()+timedelta(hours=6)).isoformat(),'target_districts':[' Sud '],'audience_guidance':[{'audience':'Personnes vulnérables','instructions':'Consignes municipales validées pour ce public.'}]}
        with self.captureOnCommitCallbacks(execute=True):
            r=self.client.post('/api/admin/news/',data,format='json')
        self.assertEqual(r.status_code,201,r.data)
        self.assertEqual(r.data['target_districts'],['sud'])
        self.assertEqual(CitizenNotification.objects.filter(user=self.south).count(),1)
        self.assertEqual(CitizenNotification.objects.filter(user=self.north).count(),0)
        self.assertEqual(self.client.get('/api/city/alerts/').data['count'],1)

    def test_publish_existing_draft_delivers_once(self):
        item=self.article(is_published=False)
        with self.captureOnCommitCallbacks(execute=True):
            r=self.client.patch('/api/admin/news/publication/',{'is_published':True},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(item.notifications.count(),2)
        dispatch_news();dispatch_news()
        self.assertEqual(item.notifications.count(),2)

    def test_future_dispatch_and_expiry(self):
        item=self.article(published_at=timezone.now()+timedelta(hours=1))
        self.assertEqual(deliver_news(item.pk),0)
        NewsArticle.objects.filter(pk=item.pk).update(published_at=timezone.now()-timedelta(minutes=1))
        call_command('dispatch_news')
        self.assertEqual(item.notifications.count(),2)
        NewsArticle.objects.filter(pk=item.pk).update(expires_at=timezone.now()-timedelta(seconds=1))
        self.auth(self.south)
        response=self.client.get('/api/citizen/notifications/')
        self.assertEqual(len(response.data.get('results',response.data) if isinstance(response.data,dict) else response.data),0)

    def test_batch_resume_idempotency(self):
        item=self.article()
        self.assertEqual(deliver_news(item.pk,1),1)
        self.assertEqual(deliver_news(item.pk,1),1)
        self.assertEqual(deliver_news(item.pk,1),0)
        self.assertEqual(deliver_news(item.pk,1),0)
        self.assertEqual(item.notifications.count(),2)
        item.refresh_from_db();self.assertIsNotNone(item.delivery_completed_at)

    def test_inactive_and_agents_not_recipients(self):
        self.north.is_active=False;self.north.save()
        item=self.article();deliver_news(item.pk)
        self.assertEqual(list(item.notifications.values_list('user_id',flat=True)),[self.south.pk])

    def test_no_notification_option(self):
        item=self.article(notify_residents=False)
        self.assertEqual(deliver_news(item.pk),0)
        self.assertEqual(self.client.get('/api/city/news/').data['count'],1)

    def test_target_freeze_and_editorial_update(self):
        item=self.article();deliver_news(item.pk)
        self.assertEqual(self.client.patch('/api/admin/news/publication/',{'target_districts':['sud']},format='json').status_code,400)
        r=self.client.patch('/api/admin/news/publication/',{'title':'Informations mises à jour'},format='json')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(item.notifications.count(),2)
        self.assertEqual(item.notifications.first().title,'Informations mises à jour')

    def test_withdrawal_hides_and_suppresses_email(self):
        item=self.article(is_important=True);deliver_news(item.pk)
        self.assertEqual(self.client.delete('/api/admin/news/publication/').status_code,204)
        self.assertEqual(self.client.get('/api/city/news/publication/').status_code,404)
        self.assertEqual(dispatch_due_notification_emails()['processed'],0)
        self.auth(self.south)
        self.assertEqual(self.client.get('/api/citizen/notifications/'+str(item.notifications.get(user=self.south).pk)+'/').status_code,404)

    def test_email_retry_and_once(self):
        item=self.article(is_important=True);deliver_news(item.pk)
        with patch('apps.city.services.notifications.send_templated_email',side_effect=RuntimeError('test SMTP failure')):
            self.assertEqual(dispatch_due_notification_emails()['sent'],0)
        self.assertEqual(dispatch_due_notification_emails()['sent'],2)
        self.assertEqual(dispatch_due_notification_emails()['sent'],0)

    def test_announcement_broadcast_is_also_duplicated_by_email(self):
        item = self.article(publication_type='announcement', is_important=False)
        mail.outbox.clear()
        self.assertEqual(deliver_news(item.pk), 2)
        self.assertEqual(item.notifications.count(), 2)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(dispatch_due_notification_emails()['sent'], 0)

    def test_targeted_announcement_limits_broadcast_and_email_to_target_district(self):
        item = self.article(slug='targeted-announcement', publication_type='announcement', target_districts=['sud'])
        mail.outbox.clear()
        self.assertEqual(deliver_news(item.pk), 1)
        self.assertTrue(item.notifications.filter(user=self.south).exists())
        self.assertFalse(item.notifications.filter(user=self.north).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.south.email])

    def test_announcement_respects_notify_residents_opt_out(self):
        item = self.article(slug='silent-announcement', publication_type='announcement', notify_residents=False)
        mail.outbox.clear()
        self.assertEqual(deliver_news(item.pk), 0)
        self.assertEqual(item.notifications.count(), 0)
        self.assertEqual(len(mail.outbox), 0)

    def test_regular_news_keeps_existing_email_rule(self):
        normal = self.article(slug='normal-news', publication_type='news', is_important=False)
        mail.outbox.clear()
        self.assertEqual(deliver_news(normal.pk), 2)
        self.assertEqual(len(mail.outbox), 0)
        important = self.article(slug='important-news', publication_type='news', is_important=True)
        self.assertEqual(deliver_news(important.pk), 2)
        self.assertEqual(len(mail.outbox), 2)

    def test_filters_priority_pagination(self):
        self.article()
        self.article(slug='critical',title='Priorité',severity='critical',target_districts=['sud'])
        r=self.client.get('/api/city/news/?page_size=1')
        self.assertEqual(r.data['count'],2);self.assertEqual(r.data['results'][0]['slug'],'critical')
        self.assertEqual(self.client.get('/api/city/news/?district=Nord').data['count'],1)
        self.assertEqual(self.client.get('/api/city/news/?severity=invalid').status_code,400)

    def test_url_dates_and_guidance_validation(self):
        for data in [
            {'source_url':'http://example.com'},
            {'action_label':'Cliquez'},
            {'expires_at':(timezone.now()-timedelta(days=1)).isoformat()},
            {'audience_guidance':[{'audience':'Tous'}]},
            {'audience_guidance':['Tous']},
        ]:
            data.update(title='Test',content='Contenu')
            self.assertEqual(self.client.post('/api/admin/news/',data,format='json').status_code,400)

    def test_legacy_audience_guidance_is_safe_on_read_but_never_accepted_on_write(self):
        self.article(audience_guidance=['Habitants de Nova Sud'])
        response = self.client.get('/api/city/news/publication/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            response.data['audience_guidance'],
            [{'audience': 'Habitants de Nova Sud', 'instructions': ''}],
        )

    def test_cover_is_private_until_publication_and_decoded(self):
        item=self.article(is_published=False)
        buffer=io.BytesIO();Image.new('RGB',(32,32),'blue').save(buffer,'JPEG')
        r=self.client.post('/api/admin/news/publication/cover/',{'image':SimpleUploadedFile('a.jpg',buffer.getvalue(),content_type='image/jpeg'),'cover_alt':'Vue du quartier'},format='multipart')
        self.assertEqual(r.status_code,200,r.data)
        self.assertEqual(self.client.get('/api/city/news/publication/cover/').status_code,404)
        item.refresh_from_db();self.assertTrue(item.cover_image.storage.exists(item.cover_image.name))
        item.is_published=True;item.save()
        response=self.client.get('/api/city/news/publication/cover/')
        self.assertEqual(response.status_code,200)
        self.assertEqual(response['Cache-Control'],'no-store')
        self.assertGreater(len(b''.join(response.streaming_content)),0)
        self.auth(self.south)
        self.assertEqual(self.client.delete('/api/admin/news/publication/cover/').status_code,403)

    def test_fake_cover_rejected(self):
        self.article()
        r=self.client.post('/api/admin/news/publication/cover/',{'image':SimpleUploadedFile('a.jpg',b'not an image'),'cover_alt':'Test'},format='multipart')
        self.assertEqual(r.status_code,400)

    def test_admin_form_alert_validation(self):
        from .admin import PublicationAdminForm
        form=PublicationAdminForm(data={'title':'Alerte','slug':'alerte','content':'Texte','publication_type':'alert','severity':'critical','is_published':True,'published_at':timezone.now()})
        self.assertFalse(form.is_valid())
        self.assertIn('instructions',str(form.errors))

    def test_delivery_status_permissions(self):
        item=self.article();deliver_news(item.pk)
        r=self.client.get('/api/admin/news/publication/delivery/')
        self.assertEqual(r.status_code,200);self.assertEqual(r.data['recipients'],2)
        self.auth(self.south)
        self.assertEqual(self.client.get('/api/admin/news/publication/delivery/').status_code,403)

    def test_delivery_failure_rolls_back_cursor_and_notices(self):
        item=self.article()
        original=CitizenNotification.objects.get_or_create
        calls=0
        def fail_second(*args, **kwargs):
            nonlocal calls
            calls+=1
            if calls==2: raise RuntimeError('simulated database failure')
            return original(*args,**kwargs)
        with patch.object(CitizenNotification.objects,'get_or_create',side_effect=fail_second):
            with self.assertRaises(RuntimeError): deliver_news(item.pk)
        item.refresh_from_db()
        self.assertEqual(item.delivery_cursor,0)
        self.assertEqual(item.notifications.count(),0)
        self.assertEqual(deliver_news(item.pk),2)

    def test_cover_replacement_and_delete_clean_storage(self):
        self.article()
        def upload():
            stream=io.BytesIO();Image.new('RGB',(20,20),'red').save(stream,'JPEG')
            return self.client.post('/api/admin/news/publication/cover/',{'image':SimpleUploadedFile('cover.jpg',stream.getvalue()),'cover_alt':'Quartier'},format='multipart')
        self.assertEqual(upload().status_code,200)
        item=NewsArticle.objects.get(slug='publication');old=item.cover_image.name
        with self.captureOnCommitCallbacks(execute=True): self.assertEqual(upload().status_code,200)
        self.assertFalse(item.cover_image.storage.exists(old))
        item.refresh_from_db();new=item.cover_image.name
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete('/api/admin/news/publication/cover/').status_code,204)
        self.assertFalse(item.cover_image.storage.exists(new))

    def test_cover_admin_preview_and_missing_alt(self):
        self.article(is_published=False)
        stream=io.BytesIO();Image.new('RGB',(20,20),'red').save(stream,'JPEG')
        response=self.client.post('/api/admin/news/publication/cover/',{'image':SimpleUploadedFile('cover.jpg',stream.getvalue())},format='multipart')
        self.assertEqual(response.status_code,400)
        self.assertEqual(self.client.get('/api/admin/news/publication/cover/').status_code,404)

    def test_delivery_constraint_enforces_uniqueness(self):
        from django.db import transaction, IntegrityError
        item=self.article();deliver_news(item.pk)
        with self.assertRaises(IntegrityError), transaction.atomic():
            CitizenNotification.objects.create(user=self.south,related_news=item,title='Duplicate')

    def test_historical_migration_does_not_rebroadcast(self):
        import importlib
        from django.apps import apps
        item=self.article()
        notice=CitizenNotification.objects.create(user=self.south,title='Historical',notification_code=f'news:{item.pk}')
        migration=importlib.import_module('apps.city.migrations.0009_preserve_existing_news_delivery')
        migration.preserve_existing(apps,None)
        item.refresh_from_db();notice.refresh_from_db()
        self.assertIsNotNone(item.delivery_completed_at)
        self.assertEqual(notice.related_news_id,item.pk)
        self.assertEqual(deliver_news(item.pk),0)

    def test_swagger_describes_json_and_image_upload(self):
        from config.swagger import schema_view
        from rest_framework.test import APIRequestFactory
        response=schema_view.without_ui(cache_timeout=0)(APIRequestFactory().get('/swagger.json',HTTP_HOST='127.0.0.1'))
        self.assertEqual(response.status_code,200)
        schema=response.data
        self.assertIn('/api/city/alerts/',list(schema['paths']))
        definition=schema['definitions']['PublicationAdmin']['properties']
        for field in ('instructions','target_districts','audience_guidance','expires_at','cover_url'):
            self.assertIn(field,definition)
        params=schema['paths']['/api/admin/news/{slug}/cover/']['post']['parameters']
        self.assertTrue(any(p.get('name')=='image' and p.get('type')=='file' for p in params))
