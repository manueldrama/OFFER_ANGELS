import React, { useState, useEffect } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { AlertTriangle, Send, Phone, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase/client';
import { AdminUsersService } from '../services/admin/usersService';
import { AdminCampaignsService } from '../services/admin/campaignsService';
import { findOrCreateLeadByPhone } from '../services/leadDedup';
import { generateOfferShortCode } from '../services/admin/shortCode';

const InvalidLinkState = () => {
    const { t } = useTranslation('offer');
    // We try to grab the token from the URL (e.g., /offer/:token)
    const token = window.location.pathname.split('/').pop() || 'Bilinmiyor';
    
    const [customerName, setCustomerName] = useState<string | null>(null);
    const [assignedTo, setAssignedTo] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [phone, setPhone] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        const fetchOldLeadInfo = async () => {
            if (token === 'Bilinmiyor') {
                setIsLoading(false);
                return;
            }
            try {
                // Try to find if this token ever existed to greet the customer by name
                const { data } = await supabase
                    .from('offer_links')
                    .select('leads(customer_name, assigned_to)')
                    .eq('token', token)
                    .single();
                
                if (data && data.leads) {
                    setCustomerName((data.leads as any).customer_name);
                    setAssignedTo((data.leads as any).assigned_to);
                }
            } catch (err) {
                console.error("Failed to fetch past lead info:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOldLeadInfo();
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        
        const digits = phone.replace(/\D/g, '');
        if (digits.length < 10) {
            setErrorMsg(t('invalidLink.errorInvalidPhone'));
            return;
        }

        setIsSubmitting(true);
        try {
            let finalAssignedTo = assignedTo;

            // Fallback to random active sales representative if no one is assigned
            if (!finalAssignedTo) {
                try {
                    const activeReps = await AdminUsersService.listActiveSalesReps();
                    if (activeReps.length > 0) {
                        const randomRep = activeReps[Math.floor(Math.random() * activeReps.length)];
                        finalAssignedTo = randomRep.id;
                    }
                } catch (repErr) {
                    console.error('Failed to fetch fallback sales reps:', repErr);
                }
            }

            // Telefon bazlı find-or-create: aynı numaralı mevcut lead varsa kullanılır,
            // yoksa yeni lead açılır (assigned_to sadece YENİ lead için geçerli; mevcut lead'in atamasına dokunulmaz).
            let newLeadId: string;
            let leadIsExisting: boolean;
            try {
                const result = await findOrCreateLeadByPhone({
                    phone,
                    customer_name: fullName || customerName || t('invalidLink.fallbackName'),
                    source: 'Expired Link Request',
                    assigned_to: finalAssignedTo,
                });
                newLeadId = result.lead.id;
                leadIsExisting = result.isExisting;
            } catch (leadErr: any) {
                console.error('Failed to find or create lead:', leadErr);
                setErrorMsg(t('invalidLink.errorRequestFailed'));
                setIsSubmitting(false);
                return;
            }

            await supabase.from('lead_notes').insert({
                lead_id: newLeadId,
                note_content: leadIsExisting
                    ? `Mevcut müşteri, süresi dolmuş veya iptal edilmiş "${token}" numaralı linkten yeni bir teklif talep etti; sistem yeni bir link atadı.`
                    : `Müşteri süresi dolmuş veya iptal edilmiş olan "${token}" numaralı teklif linkinden yeni bir teklif talebinde bulundu ve sistem otomatik olarak yeni bir link atadı.`,
                is_system_generated: true
            });

            {
                // Generate a new random token
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let rawToken = '';
                for (let i = 0; i < 8; i++) {
                    rawToken += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                const newToken = 'RE-' + rawToken.substring(0, 5); // Example: RE-A1B2C
                const newShortCode = generateOfferShortCode();
                const newOfferUrl = `${window.location.origin.replace(/^http:\/\//, 'https://')}/o/${newShortCode}`;

                // Fetch the currently active campaign
                let activeCampaignId = undefined;
                let activeCampaignExpiresAt = undefined;
                try {
                    const campaigns = await AdminCampaignsService.listCampaigns();
                    const activeCampaign = campaigns.find(c => c.is_active);
                    if (activeCampaign) {
                        activeCampaignId = activeCampaign.id;
                        activeCampaignExpiresAt = activeCampaign.valid_until;
                    }
                } catch (campErr) {
                    console.error('Failed to fetch active campaign for auto-link generation:', campErr);
                }

                // Insert the new offer link
                const { error: offerError } = await supabase.from('offer_links').insert([{
                    lead_id: newLeadId,
                    token: newToken,
                    short_code: newShortCode,
                    campaign_id: activeCampaignId,
                    valid_until: activeCampaignExpiresAt || null,
                    status: 'active',
                    is_active: true
                }]);

                if (!offerError) {
                    // Send automated WhatsApp template with the new offer link
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const isBypass = localStorage.getItem('admin_bypass') === 'true';
                        // Use bypass token if no user is logged in (since customers are unauthenticated)
                        const authToken = session?.access_token || 'mock-admin-bypass';
                        
                        await fetch('/api/whatsapp/send-template', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({
                                phone_number: phone,
                                lead_id: newLeadId,
                                template_name: 'offer_link3',
                                language_code: 'en',
                                parameters: [
                                    fullName || customerName || t('invalidLink.fallbackCustomer'),
                                    newOfferUrl
                                ]
                            })
                        });
                    } catch (whatsappErr) {
                        console.error('Failed to trigger automated WhatsApp offer link message:', whatsappErr);
                    }
                } else {
                   console.error('Failed to create new offer link automatically:', offerError);
                }
            }

            setIsSuccess(true);
        } catch (err) {
            console.error(err);
            setErrorMsg(t('invalidLink.errorGeneric'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
               <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-lg shadow-xl text-center max-w-sm w-full border border-slate-100">
                    <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-3">{t('invalidLink.successTitle')}</h1>
                    <p className="text-slate-500 text-[15px] leading-relaxed mb-6">
                        {t('invalidLink.successMessage')}
                    </p>
                    <div className="p-4 bg-slate-50 rounded-lg text-xs font-bold text-slate-400">
                        CAFEPASTE © {new Date().getFullYear()}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
            {/* Background design elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-red-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />

            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full border border-slate-100 relative z-10">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-red-50 text-red-500 rounded-lg flex items-center justify-center mx-auto mb-5 rotate-3 shadow-sm border border-red-100">
                        <AlertTriangle size={28} />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 mb-2">
                        {customerName ? t('invalidLink.greetingNamed', { customerName }) : t('invalidLink.title')}
                    </h1>
                    <p className="text-slate-500 text-[15px] leading-relaxed">
                        <Trans
                            i18nKey="invalidLink.description"
                            ns="offer"
                            components={{ strong: <span className="font-semibold text-slate-700" /> }}
                        />
                    </p>
                </div>

                <div className="bg-slate-50 p-5 rounded-lg border border-slate-100 mb-6">
                    <h2 className="text-sm font-bold text-slate-900 mb-2">{t('invalidLink.newOfferTitle')}</h2>
                    <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        {t('invalidLink.newOfferSubtitle')}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-3">
                        {!customerName && (
                            <div className="relative">
                                <input 
                                    type="text" 
                                    placeholder={t('invalidLink.fullNamePlaceholder')}
                                    value={fullName}
                                    onChange={e => setFullName(e.target.value)}
                                    className="w-full pl-4 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                    required
                                />
                            </div>
                        )}
                        <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                                <Phone size={16} />
                            </div>
                            <input 
                                type="tel" 
                                placeholder={t('invalidLink.phonePlaceholder')}
                                value={phone}
                                onChange={e => {
                                    setPhone(e.target.value);
                                    setErrorMsg('');
                                }}
                                className={`w-full pl-10 pr-4 py-3 bg-white border rounded-lg text-sm focus:outline-none focus:ring-2 transition-all ${errorMsg ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-primary focus:ring-primary/20'}`}
                                required
                            />
                        </div>
                        {errorMsg && <p className="text-[11px] text-red-500 font-medium px-1">{errorMsg}</p>}

                        <button 
                            type="submit" 
                            disabled={isSubmitting || phone.length < 5}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-slate-900 text-white font-bold py-3.5 rounded-lg hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Send size={16} />
                                    {t('invalidLink.submitButton')}
                                </>
                            )}
                        </button>
                    </form>
                </div>
                
                <div className="text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        {t('invalidLink.footerBrand')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default InvalidLinkState;
