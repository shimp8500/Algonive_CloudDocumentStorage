// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mrgydkfteuduanauupok.supabase.co'
const supabaseKey = 'API_KEY'; // input your API KEY
 
export const supabase = createClient(supabaseUrl, supabaseKey);
