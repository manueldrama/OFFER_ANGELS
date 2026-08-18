// /angels/creator/projects — onaylanmış projeler listesi.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderCheck } from 'lucide-react';
import { A } from '../../../components/angels/AngelsShell';
import {
    AngelsDashboardShell, AngelsPageHeader, AngelsTable, AngelsTr, AngelsTd,
    AngelsChip, AngelsEmpty, PROJECT_STATUS_CHIP,
} from '../../../components/angels/dashboard/AngelsDashboard';
import { useAngelsAuth } from '../../../components/angels/AngelsAuthProvider';
import { AngelsPortalCreatorService } from '../../../services/angels/angelsPortalCreatorService';
import type { PlatformProject } from '../../../types/angelsPlatform';

export default function CreatorProjects() {
    const navigate = useNavigate();
    const { activeCreatorId } = useAngelsAuth();
    const [projects, setProjects] = useState<PlatformProject[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!activeCreatorId) return;
        AngelsPortalCreatorService.listProjects(activeCreatorId)
            .then(r => setProjects(r.projects))
            .finally(() => setLoading(false));
    }, [activeCreatorId]);

    return (
        <AngelsDashboardShell area="creator">
            <AngelsPageHeader
                eyebrow="Creator Dashboard"
                title="Projects"
                description="Confirmed collaborations — deliver content and track your payout."
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
                    hint="When a venue accepts your proposal, the confirmed project will appear here."
                />
            ) : (
                <AngelsTable headers={['Project', 'Venue', 'Status', 'Scheduled']}>
                    {projects.map(p => (
                        <AngelsTr key={p.id} onClick={() => navigate(`/creator/projects/${p.id}`)}>
                            <AngelsTd><span style={{ color: A.text, fontWeight: 600 }}>{p.title}</span></AngelsTd>
                            <AngelsTd>{p.venue?.name ?? '—'}</AngelsTd>
                            <AngelsTd>
                                <AngelsChip tone={PROJECT_STATUS_CHIP[p.status]?.tone}>
                                    {PROJECT_STATUS_CHIP[p.status]?.label ?? p.status}
                                </AngelsChip>
                            </AngelsTd>
                            <AngelsTd>{p.scheduled_date ? new Date(p.scheduled_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}</AngelsTd>
                        </AngelsTr>
                    ))}
                </AngelsTable>
            )}
        </AngelsDashboardShell>
    );
}
