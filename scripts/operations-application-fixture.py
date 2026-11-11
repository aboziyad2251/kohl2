"""Exact-image API acceptance using real Auth/REST/Storage and synthetic rows."""
import io
import json
import uuid
import time
import zipfile

def run(http, require, sql, access, password, service, root, stage):
    # Use the real portal_me function; supply the legacy tables it reads.
    sql("""
ALTER TABLE portal_private.accounts ADD COLUMN mobile text;
ALTER TABLE public.contracts ADD COLUMN status text, ADD COLUMN start_date date, ADD COLUMN end_date date;
CREATE TABLE portal_private.tenant_lease_links(tenant_user_id uuid,contract_id uuid);
CREATE TABLE portal_private.settings(tenant_lease_end_action text);
CREATE TABLE portal_private.owner_property_links(owner_user_id uuid,property_id uuid,ownership_share numeric,effective_from date,effective_to date);
CREATE TABLE portal_private.broker_contract_links(broker_user_id uuid,contract_id uuid,agreement_id uuid);
CREATE ROLE kohl_portal_reader NOLOGIN;
GRANT USAGE ON SCHEMA public,auth,portal_private TO kohl_portal_reader;
GRANT SELECT ON portal_private.accounts,portal_private.tenant_lease_links,portal_private.settings,portal_private.owner_property_links,portal_private.broker_contract_links,public.contracts TO kohl_portal_reader;
""")
    migration=(root/'supabase/migrations/20261003000256_external_portals_phase_a.sql').read_text()
    start=migration.index('create function public.portal_me()')
    end=migration.index('grant execute on function public.portal_me() to authenticated;',start)+len('grant execute on function public.portal_me() to authenticated;')
    sql(migration[start:end]+"\nNOTIFY pgrst,'reload schema';")
    base='http://127.0.0.1:3000'
    stage('application identity and entry')
    # PostgREST reloads the new portal_me function asynchronously.
    response=None
    for _ in range(20):
        response=http(base,'/api/operations',access)
        if response[0]==200:break
        time.sleep(.5)
    require(response)
    assert http(base,'/api/operations')[0]==401
    entry=str(uuid.uuid4())
    require(http(base,'/api/operations',access,'POST',{'operation':'ENTRY_CREATE','id':entry,
        'case_id':None,'kind':'EXPENSE','amount':12,'date':'2026-11-11','holder':'COMPANY',
        'reference':'APP-FIXTURE','category':'Fixture','note':'Synthetic only'}))
    stage('application multipart upload')
    content=b'%PDF-1.7\nApplication route fixture\n%%EOF'
    boundary='kohl-'+uuid.uuid4().hex
    form=(f'--{boundary}\r\nContent-Disposition: form-data; name="entry_id"\r\n\r\n{entry}\r\n'
          f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="app-fixture.pdf"\r\n'
          'Content-Type: application/pdf\r\n\r\n').encode()+content+f'\r\n--{boundary}--\r\n'.encode()
    uploaded=require(http(base,'/api/operations/documents',access,'POST',raw=form,
        raw_type='multipart/form-data; boundary='+boundary))
    did=uploaded['id']
    assert http(base,'/api/operations/documents?id='+did,access)==(200,content)
    print('EXACT APP UPLOAD/DOWNLOAD OK',flush=True)
    stage('application approval and immutable documents')
    require(http(base,'/api/operations',access,'POST',{'operation':'ENTRY_DECIDE','id':entry,
        'status':'APPROVED','note':'Fixture review'}))
    assert http(base,'/api/operations/documents',access,'POST',raw=form,
        raw_type='multipart/form-data; boundary='+boundary)[0]==409
    stage('application accountant archive')
    report=str(uuid.uuid4())
    require(http(base,'/api/operations/export',access,'POST',{'id':report,'from':'2026-11-11','to':'2026-11-11'}))
    status,archive=http(base,'/api/operations/export/documents?id='+report,access)
    assert status==200
    with zipfile.ZipFile(io.BytesIO(archive)) as z:
        assert z.testzip() is None and 'report.xlsx' in z.namelist()
        manifest=json.loads(z.read('manifest.json'))
        assert any(d['id']==did for d in manifest['documents'])
        assert z.read('documents/'+entry+'/'+did+'.pdf')==content
    print('EXACT APP IMMUTABILITY AND ACCOUNTANT ZIP OK',flush=True)
    stage('application employee isolation')
    other=require(http('http://auth:9999','/admin/users',service,'POST',{
        'email':'employee@example.invalid','password':password,'email_confirm':True}))
    uid=str(uuid.UUID(other['id']))
    sql(f"INSERT INTO portal_private.accounts(user_id,full_name,role,is_active) VALUES('{uid}','Synthetic employee','EMPLOYEE',true);")
    login=require(http('http://auth:9999','/token?grant_type=password',None,'POST',{
        'email':'employee@example.invalid','password':password}))
    employee=login['access_token']
    assert http(base,'/api/operations/documents?id='+did,employee)[0]==403
    assert http(base,'/api/operations/export/documents?id='+report,employee)[0]==403
    require(http(base,'/api/operations',employee))
    sql(f"UPDATE portal_private.accounts SET is_active=false WHERE user_id='{uid}';")
    assert http(base,'/api/operations',employee)[0]==403
    print('EXACT APP EMPLOYEE ISOLATION AND DEACTIVATION OK',flush=True)
