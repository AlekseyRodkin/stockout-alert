import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'

export const supabase = createClient(supabaseUrl, supabaseKey)

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('sellers').select('count(*)').limit(1)
    return !error
  } catch (err) {
    return false
  }
}
