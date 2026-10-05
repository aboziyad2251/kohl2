import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireIdentity, adminClient, apiError, json, PortalError } from '@/lib/portal/server';
import { workflow } from '@/lib/portal/workflow-server';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    try {
        const { user } = await requireIdentity(req);
        const task_id = z.string().uuid().parse(req.nextUrl.searchParams.get('task_id'));
        const attachment_id = z.string().uuid().parse(req.nextUrl.searchParams.get('attachment_id'));
        const file = await workflow(user.id, 'ATTACHMENT', { task_id, attachment_id });
        const { data, error } = await adminClient().storage.from('portal-maintenance').createSignedUrl(file.path, 60);
        if (error || !data) throw new PortalError(404, 'Photo not available');
        return json({ url: data.signedUrl });
    } catch (error) { return apiError(error); }
}
export async function POST(req: NextRequest) {
    try {
        const { user, profile } = await requireIdentity(req);
        if (!['TENANT', 'OWNER', 'ADMIN', 'CEO'].includes(profile.account.role) || profile.account.history_only) throw new PortalError(403, 'Photo upload not allowed');
        const reader = req.body?.getReader();
        if (!reader) throw new PortalError(400, 'Photo required');
        const chunks: Uint8Array[] = []; let length = 0;
        while (true) { const item = await reader.read(); if (item.done) break; length += item.value.length; if (length > 6 * 1024 * 1024) { await reader.cancel(); throw new PortalError(413, 'Photo exceeds 5 MB'); } chunks.push(item.value); }
        const input = Buffer.concat(chunks);
        const form = await new Request(req.url, { method: 'POST', headers: { 'Content-Type': req.headers.get('content-type') || '' }, body: input }).formData();
        const task_id = z.string().uuid().parse(form.get('task_id'));
        await workflow(user.id, 'MAINTENANCE_READ', { task_id });
        const file = form.get('file');
        if (!file || typeof file === 'string' || file.size > 5 * 1024 * 1024 || !file.size) throw new PortalError(400, 'Photo required (up to 5 MB)');
        const bytes = Buffer.from(await file.arrayBuffer());
        const ext = file.type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'png' : file.type === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'jpg' : file.type === 'image/webp' && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'webp' : '';
        if (!ext) throw new PortalError(400, 'Use a JPEG, PNG or WebP photo');
        const object_path = `${task_id}/${user.id}/${crypto.randomUUID()}.${ext}`, storage = adminClient().storage.from('portal-maintenance');
        const { error } = await storage.upload(object_path, bytes, { contentType: file.type, upsert: false });
        if (error) throw new PortalError(503, 'Photo storage unavailable');
        try { await workflow(user.id, 'ATTACH', { task_id, object_path, filename: file.name.replace(/[\\/]/g, '').slice(0, 150), mime_type: file.type }); }
        catch (error) { await storage.remove([object_path]); throw error; }
        return json({ saved: true });
    } catch (error) { return apiError(error); }
}
