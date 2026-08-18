import { supabase } from '../../lib/supabase/client';
import { ServiceNote } from '../../types';
import { PortalNotificationsService } from '../portalNotificationsService';

export const AdminServiceNotesService = {
    async listNotes(serviceRequestId: string): Promise<ServiceNote[]> {
        const { data, error } = await supabase
            .from('service_notes')
            .select('*')
            .eq('service_request_id', serviceRequestId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('[AdminServiceNotesService] Error listing notes:', error);
            throw error;
        }

        return (data || []) as ServiceNote[];
    },

    async addNote(noteData: {
        service_request_id: string;
        author_id: string;
        author_type: 'admin' | 'customer' | 'system';
        content: string;
        is_internal: boolean;
    }): Promise<ServiceNote> {
        const { data, error } = await supabase
            .from('service_notes')
            .insert([noteData])
            .select()
            .single();

        if (error) {
            console.error('[AdminServiceNotesService] Error adding note:', error);
            throw error;
        }

        // Send portal notification for non-internal admin notes
        if (!noteData.is_internal && noteData.author_type === 'admin') {
            const { data: sr } = await supabase
                .from('service_requests')
                .select('lead_id, title')
                .eq('id', noteData.service_request_id)
                .single();

            if (sr?.lead_id) {
                const preview = noteData.content.length > 100
                    ? noteData.content.slice(0, 100) + '…'
                    : noteData.content;
                PortalNotificationsService.createNotification(sr.lead_id, {
                    title: 'Servis Talebinize Yeni Mesaj',
                    message: `"${sr.title}" — ${preview}`,
                    type: 'service',
                    link: '/portal/service',
                }).catch(err => console.error('[AdminServiceNotesService] Portal notification failed:', err));
            }
        }

        return data as ServiceNote;
    },

    async deleteNote(id: string): Promise<void> {
        const { error } = await supabase
            .from('service_notes')
            .delete()
            .eq('id', id);

        if (error) {
            console.error('[AdminServiceNotesService] Error deleting note:', error);
            throw error;
        }
    }
};
