// src/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://mrgydkfteuduanauupok.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yZ3lka2Z0ZXVkdWFuYXV1cG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI4NTI3MzQsImV4cCI6MjA2ODQyODczNH0.8slzpX0PvcPEXy8mqJZwJushmi9_kocGRt9-fot2aVk';

export const supabase = createClient(supabaseUrl, supabaseKey);
