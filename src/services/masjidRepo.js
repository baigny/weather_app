import { supabase } from './supabaseClient'
import { haversineMeters } from './geo'

const BUCKET = 'masjid-images'

export async function getMasjids() {
  if (!supabase) return []
  const { data, error } = await supabase.from('masjids').select('*').order('name')
  if (error) {
    console.error('getMasjids:', error)
    return []
  }
  return data ?? []
}

/**
 * Masjids within radius (meters) of lat, lon. Client-side filter.
 */
export async function listNearby(lat, lon, radiusMeters = 5000) {
  const all = await getMasjids()
  return all
    .map((m) => ({
      ...m,
      distance: haversineMeters(lat, lon, m.lat, m.lon),
    }))
    .filter((m) => m.distance <= radiusMeters)
    .sort((a, b) => a.distance - b.distance)
}

export async function getMasjidById(id) {
  if (!supabase) return null
  const { data, error } = await supabase.from('masjids').select('*').eq('id', id).single()
  if (error) return null
  return data
}

export async function createMasjid(row) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('masjids')
    .insert({
      name: row.name,
      state: row.state ?? null,
      district: row.district ?? null,
      city: row.city ?? null,
      locality: row.locality ?? null,
      colony: row.colony ?? null,
      address: row.address ?? null,
      lat: row.lat,
      lon: row.lon,
      imam_name: row.imam_name ?? null,
      contact: row.contact ?? null,
      iqamah_times: row.iqamah_times ?? {},
      jummah_times: row.jummah_times ?? [],
      images: row.images ?? [],
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateMasjid(id, row) {
  if (!supabase) throw new Error('Supabase not configured')
  const { data, error } = await supabase
    .from('masjids')
    .update({
      ...(row.name != null && { name: row.name }),
      ...(row.state !== undefined && { state: row.state }),
      ...(row.district !== undefined && { district: row.district }),
      ...(row.city !== undefined && { city: row.city }),
      ...(row.locality !== undefined && { locality: row.locality }),
      ...(row.colony !== undefined && { colony: row.colony }),
      ...(row.address !== undefined && { address: row.address }),
      ...(row.lat != null && { lat: row.lat }),
      ...(row.lon != null && { lon: row.lon }),
      ...(row.imam_name !== undefined && { imam_name: row.imam_name }),
      ...(row.contact !== undefined && { contact: row.contact }),
      ...(row.iqamah_times !== undefined && { iqamah_times: row.iqamah_times }),
      ...(row.jummah_times !== undefined && { jummah_times: row.jummah_times }),
      ...(row.images !== undefined && { images: row.images }),
    })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteMasjid(id) {
  if (!supabase) throw new Error('Supabase not configured')
  const { error } = await supabase.from('masjids').delete().eq('id', id)
  if (error) throw error
}

export async function uploadMasjidImage(masjidId, file) {
  if (!supabase) throw new Error('Supabase not configured')
  const ext = (file.name || '').split('.').pop() || 'jpg'
  const path = `${masjidId}/${crypto.randomUUID()}.${ext}`
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
  if (uploadError) throw uploadError
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = urlData?.publicUrl ?? ''
  const masjid = await getMasjidById(masjidId)
  const images = Array.isArray(masjid?.images) ? [...masjid.images] : []
  images.push({ storage_path: path, url })
  await updateMasjid(masjidId, { images })
  return { storage_path: path, url }
}

export async function deleteMasjidImage(masjidId, storagePath) {
  if (!supabase) throw new Error('Supabase not configured')
  await supabase.storage.from(BUCKET).remove([storagePath])
  const masjid = await getMasjidById(masjidId)
  const images = (Array.isArray(masjid?.images) ? masjid.images : []).filter(
    (i) => i.storage_path !== storagePath
  )
  await updateMasjid(masjidId, { images })
}
