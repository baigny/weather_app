import OlaMapsClient from 'ola-map-sdk'
import { getOlaApiKey } from './olaMapsConfig'

let clientSingleton = null

export function getOlaSdkClient() {
  if (clientSingleton) return clientSingleton
  const apiKey = getOlaApiKey()
  if (!apiKey) throw new Error('VITE_OLA_MAPS_API_KEY is required for Ola SDK')
  clientSingleton = new OlaMapsClient(apiKey)
  return clientSingleton
}

