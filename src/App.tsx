import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './contexts/ToastContext';

// We need AngelsAuthProvider for the platform routes
import { AngelsAuthProvider, RequireAngelsVenue, RequireAngelsCreator } from './components/angels/AngelsAuthProvider';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { AnalyticsTracker } from './components/analytics/AnalyticsTracker';
import { AdPixels } from './components/analytics/AdPixels';

const PageLoader = () => (
    <div className="flex items-center justify-center min-h-screen bg-black">
        <LoadingSpinner />
    </div>
);

// ── CAFEPASTE Angels: public creator + token-gated venue surfaces (lazy) ────
const AngelsLanding         = lazy(() => import('./pages/angels/AngelsLanding'));
const AngelsInvite          = lazy(() => import('./pages/angels/AngelsInvite'));
const AngelsAccept          = lazy(() => import('./pages/angels/AngelsAccept'));
const AngelsThankYou        = lazy(() => import('./pages/angels/AngelsThankYou'));
const VenuesAngelsDirectory = lazy(() => import('./pages/venues/VenuesAngelsDirectory'));
const VenuesAngelsCreator   = lazy(() => import('./pages/venues/VenuesAngelsCreator'));
const VenuesAngelsRequest   = lazy(() => import('./pages/venues/VenuesAngelsRequest'));

// ── CAFEPASTE Angels platform: login'li venue + creator panelleri (lazy) ────
const AngelsLogin           = lazy(() => import('./pages/angels/portal/AngelsLogin'));
const AngelsSetPassword     = lazy(() => import('./pages/angels/portal/AngelsSetPassword'));
const VenueHome             = lazy(() => import('./pages/angels/venue/VenueHome'));
const VenueDiscover         = lazy(() => import('./pages/angels/venue/VenueDiscover'));
const VenueCreatorProfile   = lazy(() => import('./pages/angels/venue/VenueCreatorProfile'));
const VenueRequestNew       = lazy(() => import('./pages/angels/venue/VenueRequestNew'));
const VenueRequests         = lazy(() => import('./pages/angels/venue/VenueRequests'));
const VenueRequestDetail    = lazy(() => import('./pages/angels/venue/VenueRequestDetail'));
const VenueProjects         = lazy(() => import('./pages/angels/venue/VenueProjects'));
const VenueProjectDetail    = lazy(() => import('./pages/angels/venue/VenueProjectDetail'));
const VenuePayments         = lazy(() => import('./pages/angels/venue/VenuePayments'));
const VenueSettings         = lazy(() => import('./pages/angels/venue/VenueSettings'));
const CreatorHome           = lazy(() => import('./pages/angels/creator/CreatorHome'));
const CreatorProfile        = lazy(() => import('./pages/angels/creator/CreatorProfile'));
const CreatorRequests       = lazy(() => import('./pages/angels/creator/CreatorRequests'));
const CreatorRequestDetail  = lazy(() => import('./pages/angels/creator/CreatorRequestDetail'));
const CreatorProposals      = lazy(() => import('./pages/angels/creator/CreatorProposals'));
const CreatorProjects       = lazy(() => import('./pages/angels/creator/CreatorProjects'));
const CreatorProjectDetail  = lazy(() => import('./pages/angels/creator/CreatorProjectDetail'));
const CreatorPayments       = lazy(() => import('./pages/angels/creator/CreatorPayments'));
const CreatorSpotlight      = lazy(() => import('./pages/angels/creator/CreatorSpotlight'));

function App() {
    return (
        <ToastProvider>
            <BrowserRouter>
                <AnalyticsTracker />
                <AdPixels />
                <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* CAFEPASTE Angels — invitation-only creator network. */}
                    <Route path="/" element={<AngelsLanding />} />
                    <Route path="/invite/:token" element={<AngelsInvite />} />
                    <Route path="/accept/:token" element={<AngelsAccept />} />
                    <Route path="/onboarding/:token" element={<AngelsAccept />} />
                    <Route path="/status/:token" element={<AngelsAccept />} />
                    <Route path="/extension/:token" element={<AngelsAccept />} />
                    <Route path="/upload/:token" element={<AngelsAccept />} />
                    <Route path="/thank-you" element={<AngelsThankYou />} />
                    <Route path="/venues/angels" element={<VenuesAngelsDirectory />} />
                    <Route path="/venues/angels/creators/:id" element={<VenuesAngelsCreator />} />
                    <Route path="/venues/angels/request/:creatorId" element={<VenuesAngelsRequest />} />

                    {/* CAFEPASTE Angels platform */}
                    <Route path="/login" element={<AngelsAuthProvider><AngelsLogin /></AngelsAuthProvider>} />
                    <Route path="/set-password" element={<AngelsAuthProvider><AngelsSetPassword /></AngelsAuthProvider>} />
                    
                    <Route path="/venue" element={<AngelsAuthProvider><RequireAngelsVenue><VenueHome /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/discover" element={<AngelsAuthProvider><RequireAngelsVenue><VenueDiscover /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/creators/:id" element={<AngelsAuthProvider><RequireAngelsVenue><VenueCreatorProfile /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/requests" element={<AngelsAuthProvider><RequireAngelsVenue><VenueRequests /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/requests/new/:creatorId" element={<AngelsAuthProvider><RequireAngelsVenue><VenueRequestNew /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/requests/:id" element={<AngelsAuthProvider><RequireAngelsVenue><VenueRequestDetail /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/projects" element={<AngelsAuthProvider><RequireAngelsVenue><VenueProjects /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/projects/:id" element={<AngelsAuthProvider><RequireAngelsVenue><VenueProjectDetail /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/payments" element={<AngelsAuthProvider><RequireAngelsVenue><VenuePayments /></RequireAngelsVenue></AngelsAuthProvider>} />
                    <Route path="/venue/settings" element={<AngelsAuthProvider><RequireAngelsVenue><VenueSettings /></RequireAngelsVenue></AngelsAuthProvider>} />
                    
                    <Route path="/creator" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorHome /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/profile" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorProfile /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/requests" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorRequests /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/requests/:id" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorRequestDetail /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/proposals" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorProposals /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/projects" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorProjects /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/projects/:id" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorProjectDetail /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/payments" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorPayments /></RequireAngelsCreator></AngelsAuthProvider>} />
                    <Route path="/creator/spotlight" element={<AngelsAuthProvider><RequireAngelsCreator><CreatorSpotlight /></RequireAngelsCreator></AngelsAuthProvider>} />
                    
                    {/* Fallback 404 */}
                    <Route path="*" element={<div className="p-8 text-center text-white"><h2 className="text-xl font-bold">404 - Sayfa Bulunamadı</h2></div>} />
                </Routes>
                </Suspense>
            </BrowserRouter>
        </ToastProvider>
    );
}

export default App;
