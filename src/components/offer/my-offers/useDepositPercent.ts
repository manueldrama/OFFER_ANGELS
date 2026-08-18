import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase/client';

export function useDepositPercent() {
  const [depositPercent, setDepositPercent] = useState(20);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('payment_settings')
        .select('settings')
        .limit(1)
        .maybeSingle();
      if (data?.settings?.pre_payment?.deposit_percent) {
        setDepositPercent(data.settings.pre_payment.deposit_percent);
      }
    })();
  }, []);

  return depositPercent;
}
