import { useState, useEffect } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { getMasjids, deleteMasjid } from '../../services/masjidRepo'
import MasjidForm from './MasjidForm'
import { Button } from '@/components/ui/button'

export default function MasjidTable() {
  const [masjids, setMasjids] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const list = await getMasjids()
      setMasjids(list)
    } catch (err) {
      setError(err?.message ?? 'Failed to load masjids')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleDelete(m) {
    if (!confirm(`Delete "${m.name}"?`)) return
    try {
      await deleteMasjid(m.id)
      await load()
    } catch (err) {
      setError(err?.message ?? 'Delete failed')
    }
  }

  function handleSaved() {
    setEditing(null)
    setShowForm(false)
    load()
  }

  if (loading) return <p className="text-gray-500">Loading masjids…</p>
  if (error) return <p className="text-red-600">{error}</p>

  const formOpen = showForm || editing

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Masjids</h2>
        <Button
          type="button"
          onClick={() => { setShowForm(true); setEditing(null); }}
          className="cursor-pointer"
        >
          Add Masjid
        </Button>
      </div>

      {formOpen ? (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
          <MasjidForm
            masjid={editing ?? undefined}
            onSaved={handleSaved}
            onCancel={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="w-full text-sm hidden sm:table">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Name</th>
                  <th className="text-left p-3 font-medium text-gray-700">City</th>
                  <th className="text-left p-3 font-medium text-gray-700">Address</th>
                  <th className="p-3 font-medium text-gray-700 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {masjids.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-gray-500">
                      No masjids yet. Add one above.
                    </td>
                  </tr>
                ) : (
                  masjids.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="p-3">{m.name}</td>
                      <td className="p-3">{m.city ?? '—'}</td>
                      <td className="p-3 max-w-[200px] truncate">{m.address ?? '—'}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => { setEditing(m); setShowForm(false); }}
                            className="cursor-pointer text-blue-600 hover:text-blue-700"
                            aria-label="Edit"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(m)}
                            className="cursor-pointer text-red-600 hover:text-red-700"
                            aria-label="Delete"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <div className="sm:hidden divide-y">
              {masjids.length === 0 ? (
                <p className="p-4 text-center text-gray-500">No masjids yet. Add one above.</p>
              ) : (
                masjids.map((m) => (
                  <div key={m.id} className="p-4">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-sm text-gray-600">{m.city ?? '—'} · {(m.address ?? '—').slice(0, 40)}{(m.address?.length > 40 ? '…' : '')}</p>
                    <div className="mt-2 flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => { setEditing(m); setShowForm(false); }}
                        className="cursor-pointer"
                        aria-label="Edit"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(m)}
                        className="cursor-pointer text-red-600"
                        aria-label="Delete"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
