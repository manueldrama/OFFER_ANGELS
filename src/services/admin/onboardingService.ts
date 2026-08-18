import { supabase } from '../../lib/supabase/client';
import { OnboardingStepTemplate } from '../../types';

export const OnboardingService = {
    async listTemplates() {
        const { data, error } = await supabase
            .from('onboarding_step_templates')
            .select('*')
            .order('sort_order');
        if (error) throw error;
        return (data || []) as OnboardingStepTemplate[];
    },

    async updateTemplate(id: string, updates: Partial<OnboardingStepTemplate>) {
        const { error } = await supabase
            .from('onboarding_step_templates')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;
    },

    async getCustomerProgress() {
        // Get all portals with their checklist status
        const { data, error } = await supabase
            .from('customer_portals')
            .select(`
                id, slug, onboarding_completed, last_accessed_at, created_at,
                lead:leads(id, customer_name, company_name, phone_number),
                checklists:onboarding_checklists(step_key, completed, completed_at)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data || []).map((portal: any) => {
            const total = portal.checklists?.length || 0;
            const done = portal.checklists?.filter((c: any) => c.completed).length || 0;
            return {
                ...portal,
                progress: total > 0 ? Math.round((done / total) * 100) : 0,
                totalSteps: total,
                completedSteps: done
            };
        });
    }
};
