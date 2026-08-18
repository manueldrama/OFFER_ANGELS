// /angels/venue/projects — onaylanmış işbirlikleri listesi.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderCheck } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, PROJECT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { AngelsPortalVenueService } from '../../../services/angels/angelsPortalVenueService';
import { creatorDisplayName, type PlatformProject } from '../../../types/angelsPlatform';

export default function VenueProjects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<PlatformProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AngelsPortalVenueService.listProjects()
            .then(r => setProjects(r.projects))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AngelsDashboardShell area="venue">
            <AngelsPageHeader
                eyebrow="Collaboration Desk"
                title="Projects"
                description="Confirmed collaborations, from payment to delivered content."
            />

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 rounded-full animate-spin"
                        style={{ border: `3px solid ${A.border}`, borderTopColor: A.red }} />
                </div>
            ) : projects.length === 0 ? (
                <AngelsEmpty
                    icon={FolderCheck}
                    title="No projects yet"
                    hint="When you accept a creator's proposal, the confirmed project will appear here."
                />
            ) : (
                <AngelsTable headers={['Project', 'Creator', 'Status', 'Scheduled', 'Created']}>
                    {projects.map(p => (
                        <AngelsTr key={p.id} onClick={() => navigate(`/venue/projects/${p.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{p.title}</span></AngelsTd>
                            <AngelsTd>{creatorDisplayName(p.creator)}</AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={PROJECT_STATUS_CHIP[p.status]?.tone}>
                                    {PROJECT_STATUS_CHIP[p.status]?.label ?? p.status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</AngelsTd>
                            <AngelsTd>{new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
