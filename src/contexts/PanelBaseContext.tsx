import { createContext, useContext } from 'react';
import { ADMIN_BASE, type PanelBase } from '../components/admin/nav/navConfig';

/**
 * Panelin hangi adres tabanında render edildiği: /admin ya da /team.
 *
 * Kabuk (AdminLayout) sağlar; link üreten sayfa içi bileşenler buradan okur.
 * navConfig'e konmadı çünkü navConfig React'siz saf veridir (adminSections
 * oradan import ediyor) — context oraya girse lib katmanı React'e bağlanırdı.
 *
 * Varsayılan ADMIN_BASE: kabuk dışında render edilen eski bir bileşen olursa
 * kanonik linki üretir; yönlendirme kuralı zaten doğru tabana taşır.
 */
const PanelBaseContext = createContext<PanelBase>(ADMIN_BASE);

export const PanelBaseProvider = PanelBaseContext.Provider;

export function usePanelBase(): PanelBase {
    return useContext(PanelBaseContext);
}
