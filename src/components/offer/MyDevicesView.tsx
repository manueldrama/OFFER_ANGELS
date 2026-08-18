import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CustomerDevice, ServiceRequest, ConsumableOrder } from '../../types';
import { OfferContextData } from '../../services/offerContext';
import { supabase } from '../../lib/supabase/client';
import { MonitorSmartphone, Search, Clock, ShieldCheck, AlertCircle, RefreshCcw, Headphones, Plus, Settings2, Package, X, Send } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../hooks/useAppSettings';
import { EditableI18nText } from '../landing/EditableI18nText';

interface MyDevicesViewProps {
    offerContext: OfferContextData;
}

export default function MyDevicesView({ offerContext }: MyDevicesViewProps) {
    const { t } = useTranslation('offer');
    const [devices, setDevices] = useState<CustomerDevice[]>([]);
    const [requests, setRequests] = useState<ServiceRequest[]>([]);
    const [orders, setOrders] = useState<ConsumableOrder[]>([]);
    const [loading, setLoading] = useState(true);

    const [supportModalOpen, setSupportModalOpen] = useState(false);
    const [consumableModalOpen, setConsumableModalOpen] = useState(false);
    const [selectedDevice, setSelectedDevice] = useState<CustomerDevice | null>(null);

    const [requestType, setRequestType] = useState('technical_support');
    const [requestTitle, setRequestTitle] = useState('');
    const [requestDesc, setRequestDesc] = useState('');

    const [itemType, setItemType] = useState('cartridge');
    const [quantity, setQuantity] = useState(1);
    const [orderNotes, setOrderNotes] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const { success, error } = useToast();

    useEffect(() => {
        fetchData();
    }, [offerContext.lead.id]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [devicesRes, requestsRes, ordersRes] = await Promise.all([
                supabase.from('customer_devices').select('*').eq('lead_id', offerContext.lead.id).order('created_at', { ascending: false }),
                supabase.from('service_requests').select('*').eq('lead_id', offerContext.lead.id).order('created_at', { ascending: false }),
                supabase.from('consumable_orders').select('*').eq('lead_id', offerContext.lead.id).order('created_at', { ascending: false })
            ]);

            if (devicesRes.data) setDevices(devicesRes.data);
            if (requestsRes.data) setRequests(requestsRes.data);
            if (ordersRes.data) setOrders(ordersRes.data);
        } catch (error) {
            console.error('Error fetching post-sale data:', error);
        } finally {
            setLoading(false);
        }
    };

    const isWarrantyActive = (endDate: string | null | undefined) => {
        if (!endDate) return false;
        return new Date(endDate) > new Date();
    };

    const handleSubmitSupport = async () => {
        if (!requestTitle || !requestDesc) return error('Hata', 'Lütfen tüm alanları doldurun.');
        setSubmitting(true);
        try {
            await supabase.from('service_requests').insert([{
                lead_id: offerContext.lead.id,
                customer_device_id: selectedDevice?.id,
                request_type: requestType,
                title: requestTitle,
                description: requestDesc,
                priority: 'normal',
                status: 'new',
                preferred_contact_method: 'phone'
            }]);
            success('Başarılı', 'Servis talebiniz oluşturuldu. Ekibimiz en kısa sürede iletişime geçecektir.');
            setSupportModalOpen(false);
            setRequestTitle('');
            setRequestDesc('');
            fetchData();
        } catch (err) {
            error('Hata', 'Talep oluşturulurken bir sorun oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleSubmitConsumable = async () => {
        setSubmitting(true);
        try {
            await supabase.from('consumable_orders').insert([{
                lead_id: offerContext.lead.id,
                customer_device_id: selectedDevice?.id,
                item_type: itemType,
                quantity: quantity,
                notes: orderNotes,
                status: 'new'
            }]);
            success('Başarılı', 'Sipariş talebiniz iletildi. Fiyat ve teslimat bilgisi için aranacaksınız.');
            setConsumableModalOpen(false);
            setQuantity(1);
            setOrderNotes('');
            fetchData();
        } catch (err) {
            error('Hata', 'Sipariş oluşturulurken bir sorun oluştu.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-6 pb-24 space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                    <MonitorSmartphone size={24} />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900"><EditableI18nText i18nKey="offer:myDevicesView.cihazlarim" value={t('offer:myDevicesView.cihazlarim')} /></h2>
                    <p className="text-slate-500 text-sm"><EditableI18nText i18nKey="offer:myDevicesView.satinAldiginizCihazlarVe" value={t('offer:myDevicesView.satinAldiginizCihazlarVe')} /></p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-primary rounded-full animate-spin"></div>
                </div>
            ) : devices.length === 0 ? (
                <div className="bg-white rounded-md p-8 border border-slate-200 text-center shadow-sm">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MonitorSmartphone className="text-slate-400" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2"><EditableI18nText i18nKey="offer:myDevicesView.henuzKayitliCihazinizYok" value={t('offer:myDevicesView.henuzKayitliCihazinizYok')} /></h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto"><EditableI18nText i18nKey="offer:myDevicesView.sistemdeSizeAitKayitli" value={t('offer:myDevicesView.sistemdeSizeAitKayitli')} /></p>
                </div>
            ) : (
                <div className="space-y-4">
                    {devices.map(device => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={device.id}
                            className="bg-white rounded-md p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-5"
                        >
                            <div className="flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-lg font-bold text-slate-900">{device.product_model}</h3>
                                    {device.status === 'service' ? (
                                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><Settings2 size={14} /> Serviste</span>
                                    ) : (
                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1"><ShieldCheck size={14} /> Aktif</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                                    <span className="font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">SN: {device.serial_number || 'Belirtilmemiş'}</span>
                                    <span>Alım: {device.purchase_date ? formatDate(device.purchase_date) : '-'}</span>
                                </div>

                                <div className="bg-slate-50 rounded-md p-3 flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isWarrantyActive(device.warranty_end_date) ? 'bg-primary/20 text-primary' : 'bg-red-100 text-red-500'}`}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 font-medium">Garanti Durumu</span>
                                        <p className={`text-sm font-bold ${isWarrantyActive(device.warranty_end_date) ? 'text-slate-900' : 'text-red-500'}`}>
                                            {isWarrantyActive(device.warranty_end_date) ? 'Devam Ediyor' : 'Süresi Doldu'}
                                            {device.warranty_end_date && <span className="font-normal text-slate-500 ml-1">({formatDate(device.warranty_end_date)} bitiş)</span>}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-row md:flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-4">
                                <button
                                    onClick={() => { setSelectedDevice(device); setSupportModalOpen(true); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary-dark transition-colors"
                                >
                                    <Headphones size={16} /> Destek / Servis
                                </button>
                                <button
                                    onClick={() => { setSelectedDevice(device); setConsumableModalOpen(true); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
                                >
                                    <Package size={16} /> Kartuş / Parça
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Basic Display of recent tickets */}
            {requests.length > 0 && (
                <div className="mt-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2"><Headphones size={20} className="text-slate-400" /> Son Servis Taleplerim</h3>
                    <div className="space-y-3">
                        {requests.slice(0, 3).map(req => (
                            <div key={req.id} className="bg-white rounded-md p-4 border border-slate-200 flex justify-between items-center shadow-sm">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-900">{req.title}</h4>
                                    <p className="text-xs text-slate-500 mt-1">{formatDate(req.created_at || '')}</p>
                                </div>
                                <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full text-xs font-semibold">
                                    {req.status === 'resolved' ? 'Çözüldü' : req.status === 'in_progress' ? 'İşlemde' : 'Açık'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Support Modal */}
            {supportModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-md w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">Yeni Servis Talebi</h3>
                                <p className="text-xs text-slate-500">{selectedDevice?.product_model} için destek isteği.</p>
                            </div>
                            <button onClick={() => setSupportModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-200"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1"><EditableI18nText i18nKey="offer:myDevicesView.talepTuru" value={t('offer:myDevicesView.talepTuru')} /></label>
                                <select value={requestType} onChange={e => setRequestType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-md text-sm bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none">
                                    <option value="technical_support"><EditableI18nText i18nKey="offer:myDevicesView.teknikDestekAriza" value={t('offer:myDevicesView.teknikDestekAriza')} /></option>
                                    <option value="maintenance"><EditableI18nText i18nKey="offer:myDevicesView.periyodikBakimIstemi" value={t('offer:myDevicesView.periyodikBakimIstemi')} /></option>
                                    <option value="installation"><EditableI18nText i18nKey="offer:myDevicesView.kurulumEgitim" value={t('offer:myDevicesView.kurulumEgitim')} /></option>
                                    <option value="other"><EditableI18nText i18nKey="offer:myDevicesView.diger" value={t('offer:myDevicesView.diger')} /></option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1"><EditableI18nText i18nKey="offer:myDevicesView.konuBasligi" value={t('offer:myDevicesView.konuBasligi')} /></label>
                                <input type="text" value={requestTitle} onChange={e => setRequestTitle(e.target.value)} placeholder="Örn: Cihazdan ses geliyor" className="w-full p-2.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1"><EditableI18nText i18nKey="offer:myDevicesView.detayliAciklama" value={t('offer:myDevicesView.detayliAciklama')} /></label>
                                <textarea value={requestDesc} onChange={e => setRequestDesc(e.target.value)} rows={4} placeholder="Sorunu veya talebinizi detaylıca açıklayın..." className="w-full p-2.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"></textarea>
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 shrink-0 flex justify-end gap-3">
                            <button onClick={() => setSupportModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium text-sm hover:bg-slate-50 rounded-md transition-colors"><EditableI18nText i18nKey="offer:myDevicesView.iptal" value={t('offer:myDevicesView.iptal')} /></button>
                            <button
                                onClick={handleSubmitSupport}
                                disabled={submitting}
                                className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-md hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Send size={16} /> {submitting ? 'Gönderiliyor...' : 'Talebi İlet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Consumable Modal */}
            {consumableModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-md w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg"><EditableI18nText i18nKey="offer:myDevicesView.sarfMalzemeSiparisi" value={t('offer:myDevicesView.sarfMalzemeSiparisi')} /></h3>
                                <p className="text-xs text-slate-500">{selectedDevice?.product_model} için malzeme isteği.</p>
                            </div>
                            <button onClick={() => setConsumableModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-md hover:bg-slate-200"><X size={20} /></button>
                        </div>
                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1"><EditableI18nText i18nKey="offer:myDevicesView.urunTipi" value={t('offer:myDevicesView.urunTipi')} /></label>
                                <select value={itemType} onChange={e => setItemType(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-md text-sm bg-slate-50 focus:ring-2 focus:ring-primary/20 outline-none">
                                    <option value="cartridge"><EditableI18nText i18nKey="offer:myDevicesView.baskiKartusuRenkliSiyah" value={t('offer:myDevicesView.baskiKartusuRenkliSiyah')} /></option>
                                    <option value="cleaning_kit"><EditableI18nText i18nKey="offer:myDevicesView.temizlikVeBakimKiti" value={t('offer:myDevicesView.temizlikVeBakimKiti')} /></option>
                                    <option value="accessory"><EditableI18nText i18nKey="offer:myDevicesView.aksesuarParca" value={t('offer:myDevicesView.aksesuarParca')} /></option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Adet</label>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-md border border-slate-200 flex flex-col items-center justify-center bg-slate-50 shrink-0 text-slate-600 hover:bg-slate-100">-</button>
                                    <div className="flex-1 border border-slate-200 rounded-md h-10 flex items-center justify-center font-bold text-lg">{quantity}</div>
                                    <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-md border border-slate-200 flex flex-col items-center justify-center bg-slate-50 shrink-0 text-slate-600 hover:bg-slate-100">+</button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ek Notlar (Opsiyonel)</label>
                                <textarea value={orderNotes} onChange={e => setOrderNotes(e.target.value)} rows={3} placeholder="Örn: Sadece renkli kartuş lazım..." className="w-full p-2.5 border border-slate-200 rounded-md text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"></textarea>
                            </div>
                            <div className="bg-primary/5 border border-primary/20 rounded-md p-3 text-xs text-slate-600">
                                Talebinizi ilettikten sonra ekibimiz fiyatlandırma ve kargo bilgisi için sizi Müşteri Bilgilerinizdeki numaranızdan arayacaktır.
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-100 shrink-0 flex justify-end gap-3">
                            <button onClick={() => setConsumableModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium text-sm hover:bg-slate-50 rounded-md transition-colors"><EditableI18nText i18nKey="offer:myDevicesView.iptal2" value={t('offer:myDevicesView.iptal2')} /></button>
                            <button
                                onClick={handleSubmitConsumable}
                                disabled={submitting}
                                className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <Package size={16} /> {submitting ? 'İletiliyor...' : 'Siparişi İlet'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
