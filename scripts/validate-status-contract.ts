import { computeStatus, buildStatusResponse } from '../lib/status/compute'
import { generateMockHourlyData } from '../lib/data/mock'
import { toStatusJsonContract } from '../lib/status/contract'
import type { StatusJsonContract, StatusState } from '../types/status'

const REQUIRED_KEYS = [
  'version',
  'zone_code',
  'as_of_utc',
  'status',
  'why',
  'o3_max_1h_ugm3',
  'o3_max_8h_ugm3',
  'trigger_station',
  'data_age_minutes',
  'stations',
  'notice_pdf_url',
]

const TRIGGER_KEYS = ['id', 'name', 'ts_utc']
const STATION_KEYS = ['id', 'name', 'value', 'timestamp_utc']

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function ensureKeysMatch(actual: string[], expected: string[], context: string) {
  const extra = actual.filter((key) => !expected.includes(key))
  const missing = expected.filter((key) => !actual.includes(key))

  assert(extra.length === 0, `${context} contains unexpected keys: ${extra.join(', ')}`)
  assert(missing.length === 0, `${context} is missing keys: ${missing.join(', ')}`)
}

function validateTrigger(trigger: StatusJsonContract['trigger_station']) {
  if (trigger === null) {
    return
  }

  ensureKeysMatch(Object.keys(trigger), TRIGGER_KEYS, 'trigger_station')
  assert(typeof trigger.id === 'string' && trigger.id.length > 0, 'trigger_station.id must be a non-empty string')
  assert(typeof trigger.name === 'string' && trigger.name.length > 0, 'trigger_station.name must be a non-empty string')
  assert(typeof trigger.ts_utc === 'string' && trigger.ts_utc.length > 0, 'trigger_station.ts_utc must be a non-empty string')
}

function validateStations(stations: StatusJsonContract['stations']) {
  assert(Array.isArray(stations), 'stations must be an array')
  assert(stations.length > 0, 'stations array must not be empty')

  stations.forEach((station, index) => {
    ensureKeysMatch(Object.keys(station), STATION_KEYS, `stations[${index}]`)
    assert(typeof station.id === 'string' && station.id.length > 0, `stations[${index}].id must be a non-empty string`)
    assert(typeof station.name === 'string' && station.name.length > 0, `stations[${index}].name must be a non-empty string`)
    assert(typeof station.timestamp_utc === 'string' && station.timestamp_utc.length > 0, `stations[${index}].timestamp_utc must be a non-empty string`)
    assert(typeof station.value === 'number' && Number.isFinite(station.value), `stations[${index}].value must be a finite number`)
  })
}

function validateContract(contract: StatusJsonContract) {
  ensureKeysMatch(Object.keys(contract), REQUIRED_KEYS, 'status json contract')

  assert(contract.version === '1', 'version must be "1"')
  assert(typeof contract.zone_code === 'string' && contract.zone_code.length > 0, 'zone_code must be a non-empty string')
  assert(typeof contract.as_of_utc === 'string' && contract.as_of_utc.length > 0, 'as_of_utc must be a non-empty string')
  assert(contract.status === 'INFO_EXCEEDED' || contract.status === 'COMPLIANT', 'status must be INFO_EXCEEDED or COMPLIANT')

  if (contract.why !== null) {
    assert(typeof contract.why === 'string', 'why must be string or null')
  }

  if (contract.o3_max_1h_ugm3 !== null) {
    assert(typeof contract.o3_max_1h_ugm3 === 'number' && Number.isFinite(contract.o3_max_1h_ugm3), 'o3_max_1h_ugm3 must be finite number or null')
  }
  if (contract.o3_max_8h_ugm3 !== null) {
    assert(typeof contract.o3_max_8h_ugm3 === 'number' && Number.isFinite(contract.o3_max_8h_ugm3), 'o3_max_8h_ugm3 must be finite number or null')
  }

  assert(typeof contract.data_age_minutes === 'number' && Number.isFinite(contract.data_age_minutes), 'data_age_minutes must be a finite number')
  assert(typeof contract.notice_pdf_url === 'string' && contract.notice_pdf_url.length > 0, 'notice_pdf_url must be a non-empty string')

  validateTrigger(contract.trigger_station)
  validateStations(contract.stations)
}

async function main() {
  const mockData = generateMockHourlyData(48)
  let state: StatusState | null = null
  state = computeStatus(mockData, state)
  const statusResponse = buildStatusResponse(state, mockData)
  const contract = toStatusJsonContract(statusResponse)

  validateContract(contract)

  // Ensure no accidental field removals in future by deep-freezing keys from type
  console.log('Status JSON contract v1 validation passed.')
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})


