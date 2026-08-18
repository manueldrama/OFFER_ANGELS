// Zernio.com API wrapper — Social media scheduling for 14+ platforms
// Docs: https://docs.zernio.com

const ZERNIO_BASE = 'https://zernio.com/api/v1';

// ── Internal payload (used by our app) ──
export interface ZernioPostPayload {
    profileId: string;
    platforms: { platform: string; accountId: string }[];
    content: string;
    publishNow?: boolean;
    scheduledFor?: string; // ISO 8601
    mediaItems?: { url: string; type: 'image' | 'video' }[];
    firstComment?: string;
    customContent?: Record<string, string>; // platform-specific captions
}

interface ZernioPostResponse {
    id: string;
    status: string;
    platforms: Record<string, any>;
    [key: string]: any;
}

interface ZernioPresignResponse {
    uploadUrl: string;
    publicUrl: string;
    expires: string;
}

async function zernioFetch<T>(apiKey: string, path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${ZERNIO_BASE}${path}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
        },
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Zernio API Error (${res.status}): ${body}`);
    }

    return res.json();
}

export const ZernioService = {
    async createPost(apiKey: string, payload: ZernioPostPayload): Promise<ZernioPostResponse> {
        const body: Record<string, any> = {
            profileId: payload.profileId,
            platforms: payload.platforms,
            content: payload.content,
        };

        if (payload.publishNow) body.publishNow = true;
        if (payload.scheduledFor) body.scheduledFor = payload.scheduledFor;
        if (payload.mediaItems?.length) body.mediaItems = payload.mediaItems;
        if (payload.firstComment) body.firstComment = payload.firstComment;
        if (payload.customContent && Object.keys(payload.customContent).length > 0) {
            body.customContent = payload.customContent;
        }

        return zernioFetch<ZernioPostResponse>(apiKey, '/posts', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    },

    // Step 1: Get presigned upload URL from Zernio
    async presignMedia(apiKey: string, fileName: string, fileType: string): Promise<ZernioPresignResponse> {
        return zernioFetch<ZernioPresignResponse>(apiKey, '/media/presign', {
            method: 'POST',
            body: JSON.stringify({ fileName, fileType }),
        });
    },

    // Step 2: Upload file to presigned URL (no auth needed)
    async uploadToPresigned(uploadUrl: string, file: File): Promise<void> {
        const res = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': file.type },
            body: file,
        });
        if (!res.ok) {
            throw new Error(`Zernio media upload failed (${res.status})`);
        }
    },

    async getPostStatus(apiKey: string, postId: string): Promise<ZernioPostResponse> {
        return zernioFetch<ZernioPostResponse>(apiKey, `/posts/${postId}`, { method: 'GET' });
    },

    async deletePost(apiKey: string, postId: string): Promise<void> {
        await zernioFetch(apiKey, `/posts/${postId}`, { method: 'DELETE' });
    },
};
