import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'
import AdminGate from '../components/admin/AdminGate'
import MasjidTable from '../components/admin/MasjidTable'

const AdminMasjidsPage = () => {
  const [email, setEmail] = useState(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setEmail(session?.user?.email ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase?.auth.signOut()
    setEmail(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent">
      <main className="flex-1 p-4">
        <AdminGate>
          <MasjidTable />
        </AdminGate>
      </main>
    </div>
  )
}

export default AdminMasjidsPage
