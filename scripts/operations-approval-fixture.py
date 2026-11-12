"""New approval-chain HTTP checks inside the disposable services harness only."""
import hashlib
import time
import uuid


def run(http, require, sql, access, password, service, root, stage):
    base = 'http://127.0.0.1:3000'
    stage('approval chain synthetic accounts')
    manager = str(uuid.UUID(require(http('http://auth:9999', '/user', access))['id']))

    def account(label, role):
        email = label + '@example.invalid'
        user = require(http('http://auth:9999', '/admin/users', service, 'POST', {
            'email': email, 'password': password, 'email_confirm': True}))
        uid = str(uuid.UUID(user['id']))
        sql(f"INSERT INTO portal_private.accounts(user_id,full_name,role,is_active) VALUES('{uid}','Synthetic {label}','{role}',true);")
        login = require(http('http://auth:9999', '/token?grant_type=password', None, 'POST', {
            'email': email, 'password': password}))
        return uid, login['access_token']

    final, final_access = account('final-reviewer', 'CEO')
    _, other_access = account('other-admin', 'ADMIN')
    _, employee_access = account('active-employee', 'EMPLOYEE')
    stage('approval chain isolated migration')
    sql(f"SELECT set_config('kohl.workflow_manager','{manager}',false),set_config('kohl.workflow_final','{final}',false);\n"
        + (root/'supabase/migrations/20261112172325_operations_approval_chain.sql').read_text())
    response = None
    for _ in range(20):
        response = http(base, '/api/operations/workflow', access)
        if response[0] == 200:
            break
        time.sleep(.5)
    assert require(response)['assistant_available'] is True
    for bearer in (final_access, other_access, employee_access):
        assert require(http(base, '/api/operations/workflow', bearer))['assistant_available'] is False
        require(http(base, '/api/operations', bearer, 'POST', {
            'operation': 'ASSISTANT_PLAN', 'id': str(uuid.uuid4())}), expected=403)
    require(http(base, '/api/operations/workflow'), expected=401)

    stage('application manager then final approval')
    entry = str(uuid.uuid4())
    require(http(base, '/api/operations', access, 'POST', {
        'operation': 'ENTRY_CREATE', 'id': entry, 'case_id': None, 'kind': 'EXPENSE',
        'amount': 12, 'date': '2026-11-12', 'holder': 'COMPANY',
        'reference': 'CHAIN-HTTP-FIXTURE', 'category': 'Fixture', 'note': 'Synthetic only'}))
    decision = {'operation': 'ENTRY_DECIDE', 'id': entry, 'status': 'APPROVED', 'note': 'Review fixture'}
    for bearer in (final_access, other_access, employee_access):
        require(http(base, '/api/operations', bearer, 'POST', decision), expected=403)
    require(http(base, '/api/operations', access, 'POST', decision))
    workspace = require(http(base, '/api/operations', access))
    row = next(e for e in workspace['entries'] if e['id'] == entry)
    assert row['status'] == 'PENDING' and row['manager_reviewed_by'] == manager
    require(http(base, '/api/operations', access, 'POST', decision), expected=403)

    stage('application manager-reviewed document rejection')
    boundary = 'kohl-' + uuid.uuid4().hex
    form = (f'--{boundary}\r\nContent-Disposition: form-data; name="entry_id"\r\n\r\n{entry}\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="chain.pdf"\r\n'
            'Content-Type: application/pdf\r\n\r\n%PDF-1.7\nSynthetic chain\n%%EOF'
            f'\r\n--{boundary}--\r\n').encode()
    require(http(base, '/api/operations/documents', access, 'POST', raw=form,
                 raw_type='multipart/form-data; boundary=' + boundary), expected=409)
    require(http(base, '/api/operations', final_access, 'POST', decision))
    workspace = require(http(base, '/api/operations', final_access))
    row = next(e for e in workspace['entries'] if e['id'] == entry)
    assert row['status'] == 'APPROVED' and row['decided_by'] == final
    require(http(base, '/api/operations', final_access, 'POST', decision), expected=409)
    # A second role must not be able to invoke the preserved core through PostgREST.
    result = http('http://rest:3000', '/rpc/operations_core_v1', other_access, 'POST', {
        'operation': 'ENTRY_DECIDE', 'payload': {}})
    assert result[0] in (401, 403, 404)
    stage('application assistant disabling')
    require(http(base, '/api/operations', access, 'POST', {
        'operation': 'ASSISTANT_PLAN', 'id': str(uuid.uuid4())}))
    sql('UPDATE portal_private.operations_approval_config SET assistant_enabled=false;')
    assert require(http(base, '/api/operations/workflow', access))['assistant_available'] is False
    require(http(base, '/api/operations', access, 'POST', {
        'operation': 'ASSISTANT_PLAN', 'id': str(uuid.uuid4())}), expected=403)
    print('EXACT APP APPROVAL CHAIN, DOCUMENT FREEZE AND OWNER-ONLY ASSISTANT OK', flush=True)
    print('Approval migration SHA256: ' + hashlib.sha256(
        (root/'supabase/migrations/20261112172325_operations_approval_chain.sql').read_bytes()).hexdigest(), flush=True)
