import React from 'react';

interface TemplatePreviewProps {
    content: string;
}

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ content }) => {
    // Replace variables with dummy data for preview
    const renderPreview = () => {
        let text = content || 'WhatsApp şablon mesajınız burada görünecek...';

        text = text.replace(/{{name}}/g, 'Ahmet Yılmaz');
        text = text.replace(/{{company}}/g, 'Örnek A.Ş.');
        text = text.replace(/{{offer_link}}/g, 'https://medvoyage.app/offer/GUCER-TR');
        text = text.replace(/{{selected_model}}/g, 'Aero-Fit Cihazı');
        text = text.replace(/{{campaign_name}}/g, 'Bahar Kampanyası');
        text = text.replace(/{{support_contact}}/g, '+90 532 000 0000');

        return text;
    };

    return (
        <div className="bg-[#EFEAE2] p-4 rounded-lg shadow-inner max-w-sm w-full mx-auto font-sans relative" style={{ backgroundImage: "url('https://static.whatsapp.net/rsrc.php/v3/yl/r/r2o7z7y-0z0.png')", backgroundSize: 'contain' }}>
            {/* WhatsApp Header Mock */}
            <div className="absolute top-0 left-0 w-full h-8 bg-[#075E54] rounded-t-lg opacity-90 z-0"></div>

            <div className="relative z-10 mt-6">
                <div className="bg-white p-3 rounded-lg rounded-tl-none text-sm text-slate-800 whitespace-pre-wrap leading-relaxed inline-block max-w-[85%]">
                    {renderPreview()}
                    <div className="text-[10px] text-slate-400 text-right mt-1">14:30</div>
                </div>
            </div>
        </div>
    );
};
