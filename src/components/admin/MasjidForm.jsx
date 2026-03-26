import { useState, useEffect } from 'react'
import {
  createMasjid,
  updateMasjid,
  uploadMasjidImage,
  deleteMasjidImage,
} from '../../services/masjidRepo'
import { Button } from '@/components/ui/button'

const PRAYER_KEYS = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

// Time format: HH:MM or H:MM (24h) or 1:00 AM/PM
const TIME_REGEX = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$|^([01]?[0-9]|2[0-3]):[0-5][0-9]$/i
function isValidTime(s) {
  if (!s || typeof s !== 'string') return true // empty = optional
  return TIME_REGEX.test(s.trim())
}

const MAX_IMAGE_SIZE_MB = 5
const MAX_IMAGE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

export default function MasjidForm({ masjid, onSaved, onCancel }) {
  const isEdit = !!masjid?.id
  const [state, setState] = useState(masjid?.state ?? '')
  const [district, setDistrict] = useState(masjid?.district ?? '')
  const [city, setCity] = useState(masjid?.city ?? '')
  const [locality, setLocality] = useState(masjid?.locality ?? '')
  const [colony, setColony] = useState(masjid?.colony ?? '')
  const [name, setName] = useState(masjid?.name ?? '')
  const [address, setAddress] = useState(masjid?.address ?? '')
  const [lat, setLat] = useState(masjid?.lat ?? '')
  const [lon, setLon] = useState(masjid?.lon ?? '')
  const [imamName, setImamName] = useState(masjid?.imam_name ?? '')
  const [contact, setContact] = useState(masjid?.contact ?? '')
  const [iqamah, setIqamah] = useState(() => ({
    Fajr: masjid?.iqamah_times?.Fajr ?? '',
    Dhuhr: masjid?.iqamah_times?.Dhuhr ?? '',
    Asr: masjid?.iqamah_times?.Asr ?? '',
    Maghrib: masjid?.iqamah_times?.Maghrib ?? '',
    Isha: masjid?.iqamah_times?.Isha ?? '',
  }))
  const [jummah, setJummah] = useState(
    Array.isArray(masjid?.jummah_times) ? masjid.jummah_times.join(', ') : ''
  )
  const [images, setImages] = useState(() => (Array.isArray(masjid?.images) ? masjid.images : []))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})

  useEffect(() => {
    if (!masjid) return
    setState(masjid.state ?? '')
    setDistrict(masjid.district ?? '')
    setCity(masjid.city ?? '')
    setLocality(masjid.locality ?? '')
    setColony(masjid.colony ?? '')
    setName(masjid.name ?? '')
    setAddress(masjid.address ?? '')
    setLat(masjid.lat ?? '')
    setLon(masjid.lon ?? '')
    setImamName(masjid.imam_name ?? '')
    setContact(masjid.contact ?? '')
    setIqamah({
      Fajr: masjid.iqamah_times?.Fajr ?? '',
      Dhuhr: masjid.iqamah_times?.Dhuhr ?? '',
      Asr: masjid.iqamah_times?.Asr ?? '',
      Maghrib: masjid.iqamah_times?.Maghrib ?? '',
      Isha: masjid.iqamah_times?.Isha ?? '',
    })
    setJummah(Array.isArray(masjid.jummah_times) ? masjid.jummah_times.join(', ') : '')
    setImages(Array.isArray(masjid.images) ? masjid.images : [])
  }, [masjid])

  function validate() {
    const err = {}
    if (!name.trim()) err.name = 'Masjid name is required'
    const latN = Number(lat)
    const lonN = Number(lon)
    if (!Number.isFinite(latN) || latN < -90 || latN > 90) err.lat = 'Valid latitude (-90 to 90) is required'
    if (!Number.isFinite(lonN) || lonN < -180 || lonN > 180) err.lon = 'Valid longitude (-180 to 180) is required'
    PRAYER_KEYS.forEach((k) => {
      if (!isValidTime(iqamah[k])) err[`iqamah_${k}`] = 'Use format like 05:30 or 1:00 PM'
    })
    const jummahParts = jummah.split(',').map((s) => s.trim()).filter(Boolean)
    jummahParts.forEach((part, i) => {
      if (!isValidTime(part)) err[`jummah_${i}`] = 'Use format like 1:00 PM'
    })
    setFieldErrors(err)
    return Object.keys(err).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    if (!validate()) {
      setError('Please fix the errors below before submitting.')
      return
    }
    setSaving(true)
    const latN = Number(lat)
    const lonN = Number(lon)
    const jummahArr = jummah
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    try {
      if (isEdit) {
        await updateMasjid(masjid.id, {
          name: name.trim(),
          state: state.trim() || null,
          district: district.trim() || null,
          city: city.trim() || null,
          locality: locality.trim() || null,
          colony: colony.trim() || null,
          address: address.trim() || null,
          lat: latN,
          lon: lonN,
          imam_name: imamName.trim() || null,
          contact: contact.trim() || null,
          iqamah_times: iqamah,
          jummah_times: jummahArr,
          images,
        })
      } else {
        await createMasjid({
          name: name.trim(),
          state: state.trim() || null,
          district: district.trim() || null,
          city: city.trim() || null,
          locality: locality.trim() || null,
          colony: colony.trim() || null,
          address: address.trim() || null,
          lat: latN,
          lon: lonN,
          imam_name: imamName.trim() || null,
          contact: contact.trim() || null,
          iqamah_times: iqamah,
          jummah_times: jummahArr,
          images,
        })
      }
      onSaved?.()
    } catch (err) {
      setError(err?.message ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!masjid?.id) {
      setError('Save the masjid first to add images.')
      e.target.value = ''
      return
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) {
      setError('Please upload an image (JPEG, PNG, WebP, or GIF).')
      e.target.value = ''
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Image must be under ${MAX_IMAGE_SIZE_MB} MB.`)
      e.target.value = ''
      return
    }
    setUploading(true)
    setError(null)
    try {
      const added = await uploadMasjidImage(masjid.id, file)
      setImages((prev) => [...prev, added])
    } catch (err) {
      setError(err?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  async function handleRemoveImage(storagePath) {
    if (!masjid?.id) return
    try {
      await deleteMasjidImage(masjid.id, storagePath)
      setImages((prev) => prev.filter((i) => i.storage_path !== storagePath))
    } catch (err) {
      setError(err?.message ?? 'Delete failed')
    }
  }

  const inputClass = (key) =>
    `w-full px-3 py-2.5 border rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${fieldErrors[key] ? 'border-red-500' : 'border-gray-300'}`

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Location hierarchy */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Location</h3>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>State</label>
            <input
              type="text"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className={inputClass('state')}
              placeholder="e.g. Maharashtra"
            />
          </div>
          <div>
            <label className={labelClass}>District</label>
            <input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={inputClass('district')}
              placeholder="e.g. Mumbai"
            />
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass('city')}
              placeholder="e.g. Mumbai"
            />
          </div>
          <div>
            <label className={labelClass}>Locality</label>
            <input
              type="text"
              value={locality}
              onChange={(e) => setLocality(e.target.value)}
              className={inputClass('locality')}
              placeholder="Area or locality"
            />
          </div>
          <div>
            <label className={labelClass}>Colony</label>
            <input
              type="text"
              value={colony}
              onChange={(e) => setColony(e.target.value)}
              className={inputClass('colony')}
              placeholder="Colony or sector"
            />
          </div>
        </div>
      </section>

      {/* Masjid name */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Masjid details</h3>
        <div>
          <label className={labelClass}>Masjid's Name (former name) *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass('name')}
            placeholder="Masjid name or former name"
            required
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </div>
      </section>

      {/* Coordinates */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Coordinates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Masjid's Latitude *</label>
            <input
              type="number"
              step="any"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              className={inputClass('lat')}
              placeholder="e.g. 19.0760"
            />
            {fieldErrors.lat && <p className="mt-1 text-xs text-red-600">{fieldErrors.lat}</p>}
          </div>
          <div>
            <label className={labelClass}>Masjid's Longitude *</label>
            <input
              type="number"
              step="any"
              value={lon}
              onChange={(e) => setLon(e.target.value)}
              className={inputClass('lon')}
              placeholder="e.g. 72.8777"
            />
            {fieldErrors.lon && <p className="mt-1 text-xs text-red-600">{fieldErrors.lon}</p>}
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Masjid's Images</h3>
        {isEdit ? (
          <>
            <label className="block text-sm font-medium text-gray-600 mb-2">Upload file</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFile}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploading && <span className="text-sm text-gray-500 mt-1 block">Uploading…</span>}
            <p className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF, max {MAX_IMAGE_SIZE_MB} MB</p>
            <div className="flex flex-wrap gap-3 mt-3">
              {images.map((img) => (
                <div key={img.storage_path} className="relative group">
                  <img src={img.url} alt="" className="w-24 h-24 object-cover rounded-lg border border-gray-200 shadow-sm" />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(img.storage_path)}
                    className="absolute -top-1 -right-1 w-6 h-6 flex items-center justify-center bg-red-500 text-white text-xs rounded-full shadow hover:bg-red-600 cursor-pointer"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Save the masjid first, then you can add images from the edit view.</p>
        )}
      </section>

      {/* Contact */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Point of contact</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Masjid's Point of Contact Name</label>
            <input
              type="text"
              value={imamName}
              onChange={(e) => setImamName(e.target.value)}
              className={inputClass('imamName')}
              placeholder="Name"
            />
          </div>
          <div>
            <label className={labelClass}>Masjid's Point of Contact Number</label>
            <input
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className={inputClass('contact')}
              placeholder="e.g. +91 98765 43210"
            />
          </div>
        </div>
      </section>

      {/* Timings — Iqamah + Jummah below Isha row */}
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Iqamah & Jummah timings</h3>
        <div>
          <label className={labelClass}>Iqamah times</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-gray-50 border border-gray-200">
            {PRAYER_KEYS.map((k) => (
              <div key={k}>
                <span className="block text-xs text-gray-500 mb-0.5">{k}</span>
                <input
                  type="text"
                  value={iqamah[k]}
                  onChange={(e) => setIqamah((p) => ({ ...p, [k]: e.target.value }))}
                  placeholder="e.g. 05:30 or 1:00 PM"
                  className={inputClass(`iqamah_${k}`)}
                />
                {fieldErrors[`iqamah_${k}`] && <p className="mt-0.5 text-xs text-red-600">{fieldErrors[`iqamah_${k}`]}</p>}
              </div>
            ))}
            {/* Jummah row below Isha */}
            <div className="sm:col-span-2">
              <span className="block text-xs text-gray-500 mb-0.5">Jummah</span>
              <input
                type="text"
                value={jummah}
                onChange={(e) => setJummah(e.target.value)}
                placeholder="e.g. 1:00 PM, 1:45 PM"
                className={inputClass('jummah')}
              />
              {fieldErrors.jummah_0 != null && <p className="mt-0.5 text-xs text-red-600">Use format like 1:00 PM for each time</p>}
            </div>
          </div>
        </div>
      </section>

      {/* Submit — at the end so form is not submitted before timings */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
        <Button type="submit" disabled={saving} className="cursor-pointer">
          {saving ? 'Saving' : isEdit ? 'Update masjid' : 'Add Masjid'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
