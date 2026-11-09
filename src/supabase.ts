import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ocvtuktyikntgymbnebl.supabase.co';
const supabaseKey = 'sb_publishable_fcRJhSEViJiQaukgtCKvxA_5oFLLbDr';

export const supabase = createClient(supabaseUrl, supabaseKey);
