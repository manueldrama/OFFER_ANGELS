// Shared media library (Faz 3).
//
// Thin facade over the existing Landing-CMS upload pipeline so the SEO blog
// editor and the landing CMS draw from ONE bucket (`whatsapp_media`) and ONE
// gallery. Upload + listing delegate to LandingPageCmsService (WebP transcode,
// `landing-cms-` prefix) so a file uploaded in either surface shows up in both;
// we only add a `remove()` here. No new bucket, no migration.

import { supabase } from '../../lib/supabase/client';
import { LandingPageCmsService } from './landingPageCmsService';

export interface MediaItem {
    name: string;
    url: string;
    created_at: string;
    kind: 'image' | 'video';
}

const BUCKET = 'whatsapp_media';

export const MediaLibraryService = {
    /** Upload a file (images are transcoded to WebP) and return its public URL. */
    async upload(file: File): Promise<string> {
        return LandingPageCmsService.uploadImage(file);
    },

    /** List previously-uploaded media for the gallery picker, newest first. */
    async list(): Promise<MediaItem[]> {
        return LandingPageCmsService.listLandingMedia();
    },

    /** Delete a media object by its storage name (the `name` field of MediaItem). */
    async remove(name: string): Promise<void> {
        const { error } = await supabase.storage.from(BUCKET).remove([name]);
        if (error) throw new Error(error.message);
    },
};
