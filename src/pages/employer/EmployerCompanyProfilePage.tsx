import type { AxiosError } from 'axios'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './employer-company-profile.css'
import showPasswordIcon from '../../assets/показать_пароль.png'
import hidePasswordIcon from '../../assets/скрыть_пароль.png'

type VacancySummary = {
  id: number
}

type GeoRegion = {
  id: number
  name: string
}

type GeoDistrict = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
}

type GeoCity = {
  id: number
  name: string
  full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
}

type CompanyCityItem = GeoCity | {
  id: number
  name?: string | null
  full_name?: string | null
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_id?: number | null
  settlement_type_name?: string | null
}

type CompanyProfile = {
  id: number
  name: string
  description?: string | null
  website?: string | null
  logo?: string | null
  founded_year?: number | null
  employee_count?: number | null
  vacancies_count?: number | null
  vacancies?: VacancySummary[]
  city_ids?: number[] | null
  city_names?: string[] | null
  cities?: CompanyCityItem[] | null
}

type AuthMeResponse = {
  id: number
  email: string
  role: string
  is_active: boolean
}

type ApiValidationItem = {
  loc?: Array<string | number>
  msg?: string
  type?: string
}

type ApiErrorResponse = {
  detail?: string | { message?: string; error?: string } | ApiValidationItem[]
  message?: string
  error?: string
}

type CompanyFieldErrors = {
  name: string
  description: string
  website: string
  foundedYear: string
  employeeCount: string
  offices: string
}
type PasswordInputProps = {
  value: string
  placeholder: string
  autoComplete?: string
  onChange: (value: string) => void
}

const PasswordInput = ({
  value,
  placeholder,
  autoComplete,
  onChange,
}: PasswordInputProps) => {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="company-password-input">
      <input
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />

      <button
        type="button"
        className="company-password-input__toggle"
        onClick={() => setIsVisible((prev) => !prev)}
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
      >
        <img
          src={isVisible ? hidePasswordIcon : showPasswordIcon}
          alt=""
          aria-hidden="true"
        />
      </button>
    </div>
  )
}
const currentYear = new Date().getFullYear()

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const specialRegex = /[^A-Za-zА-Яа-я0-9]/

const emptyCompanyFieldErrors = (): CompanyFieldErrors => ({
  name: '',
  description: '',
  website: '',
  foundedYear: '',
  employeeCount: '',
  offices: '',
})

const fetchCompanyProfile = async (): Promise<CompanyProfile> => {
  const { data } = await http.get('/companies/me')
  return data
}

const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  const { data } = await http.get('/auth/me')
  return data
}

const updateCompanyProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/companies/me', payload)
  return data
}

const updateSensitiveCredentials = async (payload: {
  email: string
  phone: string | null
  current_password: string
}) => {
  const { data } = await http.patch('/auth/me/credentials', payload)
  return data
}

const changePassword = async (payload: {
  current_password: string
  new_password: string
}) => {
  const { data } = await http.patch('/auth/me/password', payload)
  return data
}

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) return ''

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed
  }

  return `https://${trimmed}`
}

const isValidUrl = (value: string) => {
  if (!value.trim()) return true

  try {
    const url = new URL(normalizeUrl(value))
    return Boolean(url.hostname.includes('.'))
  } catch {
    return false
  }
}

const parsePositiveInteger = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) return null

  if (!/^\d+$/.test(trimmed)) return undefined

  const parsed = Number(trimmed)

  if (!Number.isSafeInteger(parsed) || parsed < 0) return undefined

  return parsed
}

const normalizeArrayResponse = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]

  if (value && typeof value === 'object') {
    const payload = value as { items?: unknown[]; results?: unknown[]; data?: unknown[] }

    if (Array.isArray(payload.items)) return payload.items as T[]
    if (Array.isArray(payload.results)) return payload.results as T[]
    if (Array.isArray(payload.data)) return payload.data as T[]
  }

  return []
}

const fetchCatalog = async <T,>(catalogName: string, limit = 1000): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit },
  })

  return normalizeArrayResponse<T>(data)
}

const getCityDisplayName = (city?: Partial<GeoCity> | null) => {
  if (!city) return ''

  if (city.full_name?.trim()) return city.full_name.trim()

  const settlementType = city.settlement_type_name?.trim() || ''
  const title = [settlementType, city.name].filter(Boolean).join(' ').trim()

  return [title, city.district_name, city.region_name]
    .filter((item) => item && String(item).trim())
    .join(', ')
}

const formatCompactNumber = (value?: number | null) => {
  if (value === null || value === undefined) return '—'

  if (value < 1000) return String(value)

  if (value < 1_000_000) {
    const result = value / 1000
    return `${Number.isInteger(result) ? result : result.toFixed(1)}k+`
  }

  const result = value / 1_000_000
  return `${Number.isInteger(result) ? result : result.toFixed(1)}M+`
}

const getCompanyInitials = (name: string) => {
  const normalized = name.trim()

  if (!normalized) return 'C'

  return normalized
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (lower.includes('users_email_key') || lower.includes('key (email)')) {
    return 'Email уже используется другим аккаунтом.'
  }

  if (
    lower.includes('email already') ||
    lower.includes('email exists') ||
    lower.includes('почта уже') ||
    lower.includes('email уже')
  ) {
    return 'Email уже используется другим аккаунтом.'
  }

  if (
    lower.includes('incorrect password') ||
    lower.includes('invalid password') ||
    lower.includes('wrong password') ||
    lower.includes('неверный пароль') ||
    lower.includes('текущий пароль')
  ) {
    return 'Неверный текущий пароль.'
  }

  if (
    lower.includes('input should be a valid email') ||
    lower.includes('value is not a valid email') ||
    lower.includes('valid email')
  ) {
    return 'Введите корректный email.'
  }

  if (lower.includes('name') || lower.includes('company') || lower.includes('название')) {
    return 'Укажите название компании.'
  }

  if (lower.includes('website') || lower.includes('url') || lower.includes('сайт')) {
    return 'Проверьте ссылку на сайт компании.'
  }

  if (lower.includes('founded') || lower.includes('year') || lower.includes('год')) {
    return 'Проверьте год основания.'
  }

  if (lower.includes('employee') || lower.includes('сотруд')) {
    return 'Проверьте количество сотрудников.'
  }

  if (lower.includes('field required')) {
    return 'Заполните обязательные поля.'
  }

  if (lower.includes('string should have at least')) {
    const count = message.match(/(\d+)/)?.[1]
    return count ? `Поле должно содержать минимум ${count} символов.` : 'Слишком короткое значение.'
  }

  if (lower.includes('not authenticated') || lower.includes('unauthorized')) {
    return 'Сессия истекла. Войдите в аккаунт заново.'
  }

  if (lower.includes('forbidden') || lower.includes('доступ запрещ')) {
    return 'Недостаточно прав для выполнения действия.'
  }

  if (lower.includes('profile not found') || lower.includes('компании не найден')) {
    return 'Профиль компании не найден.'
  }

  if (status === 400) return message || 'Некорректные данные.'
  if (status === 401) return 'Сессия истекла. Войдите в аккаунт заново.'
  if (status === 403) return 'Недостаточно прав для выполнения действия.'
  if (status === 404) return 'Данные не найдены.'
  if (status === 409) return message || 'Такие данные уже используются другим аккаунтом.'
  if (status === 422) return message || 'Проверьте корректность введённых данных.'
  if (status === 429) return 'Слишком много попыток. Попробуйте позже.'
  if (status && status >= 500) return 'Ошибка сервера. Попробуйте позже.'

  if (message.length > 220) {
    return 'Не удалось выполнить действие. Проверьте данные и попробуйте снова.'
  }

  return message || 'Не удалось выполнить действие.'
}

const getApiErrorMessage = (error: unknown, fallback: string) => {
  const axiosError = error as AxiosError<ApiErrorResponse>
  const status = axiosError.response?.status
  const data = axiosError.response?.data

  if (!axiosError.response) {
    return 'Нет соединения с сервером. Проверьте интернет или попробуйте позже.'
  }

  if (Array.isArray(data?.detail)) {
    const messages = uniqueMessages(
      data.detail.map((item) => translateApiErrorMessage(item.msg || '', status)),
    )

    return messages[0] || fallback
  }

  if (typeof data?.detail === 'string') {
    return translateApiErrorMessage(data.detail, status)
  }

  if (data?.detail && typeof data.detail === 'object' && !Array.isArray(data.detail)) {
    const message = data.detail.message || data.detail.error
    if (message) return translateApiErrorMessage(message, status)
  }

  if (data?.message) return translateApiErrorMessage(data.message, status)
  if (data?.error) return translateApiErrorMessage(data.error, status)

  switch (status) {
    case 400:
      return 'Некорректные данные. Проверьте форму.'
    case 401:
      return 'Сессия истекла. Войдите в аккаунт заново.'
    case 403:
      return 'Недостаточно прав для выполнения действия.'
    case 404:
      return 'Данные не найдены.'
    case 409:
      return 'Такие данные уже используются другим аккаунтом.'
    case 422:
      return 'Проверьте корректность введённых данных.'
    case 429:
      return 'Слишком много попыток. Попробуйте позже.'
    default:
      return status && status >= 500 ? 'Ошибка сервера. Попробуйте позже.' : fallback
  }
}

const validateEmailValue = (value: string) => {
  const normalized = value.trim()

  if (!normalized) return 'Введите email.'
  if (!emailRegex.test(normalized)) return 'Введите корректный email.'

  return ''
}

const validatePasswordValue = (value: string) => {
  const errors: string[] = []

  if (!value) {
    errors.push('Введите новый пароль.')
    return errors
  }

  if (/\s/.test(value)) {
    errors.push('Пароль не должен содержать пробелы.')
  }

  if (value.length < 8) {
    errors.push('Пароль должен содержать минимум 8 символов.')
  }

  if (!/[a-zа-я]/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну строчную букву.')
  }

  if (!/[A-ZА-Я]/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну заглавную букву.')
  }

  if (!/\d/.test(value)) {
    errors.push('Пароль должен содержать хотя бы одну цифру.')
  }

  if (!specialRegex.test(value)) {
    errors.push('Пароль должен содержать хотя бы один специальный символ.')
  }

  return errors
}

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null
  return <span className="company-profile-field__error">{message}</span>
}

const PasswordErrors = ({ errors }: { errors: string[] }) => {
  if (!errors.length) return null

  return (
    <div className="company-profile-field-errors">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  )
}

const EditIcon = () => (
  <svg className="company-security-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0-3-3L5 17v3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 6.5l4 4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

type SecurityModalProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

const SecurityModal = ({ title, subtitle, onClose, children }: SecurityModalProps) => (
  <div className="company-profile-modal-overlay" onClick={onClose}>
    <div className="company-profile-modal" onClick={(event) => event.stopPropagation()}>
      <div className="company-profile-modal__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <button
  type="button"
  className="company-profile-modal__close"
  onClick={onClose}
  aria-label="Закрыть"
>
  <span>×</span>
</button>
      </div>

      {children}
    </div>
  </div>
)

type CompanyGeoSelectOption = {
  id: number
  name: string
  region_id?: number | null
  region_name?: string | null
  district_id?: number | null
  district_name?: string | null
  settlement_type_name?: string | null
  full_name?: string | null
}

type CompanyGeoSelectProps = {
  label: string
  placeholder: string
  value: string
  options: CompanyGeoSelectOption[]
  openKey: string
  openSelect: string | null
  disabled?: boolean
  isLoading?: boolean
  emptyText?: string
  getLabel?: (item: CompanyGeoSelectOption) => string
  setOpenSelect: (value: string | null) => void
  onChange: (value: string) => void
}

const CompanyGeoSelect = ({
  label,
  placeholder,
  value,
  options,
  openKey,
  openSelect,
  disabled = false,
  isLoading = false,
  emptyText = 'Нет вариантов',
  getLabel = (item) => item.name,
  setOpenSelect,
  onChange,
}: CompanyGeoSelectProps) => {
  const isDisabled = disabled || isLoading
  const isOpen = !isDisabled && openSelect === openKey
  const selected = options.find((item) => String(item.id) === value)
  const selectedLabel = selected ? getLabel(selected) : ''

  return (
    <div className={`company-geo-select ${isOpen ? 'is-open' : ''} ${isDisabled ? 'is-disabled' : ''}`}>
      <span className="company-profile-field-label">{label}</span>

      <button
        type="button"
        className={`company-geo-select__trigger ${isOpen ? 'is-open' : ''}`}
        disabled={isDisabled}
        onClick={() => setOpenSelect(isOpen ? null : openKey)}
        aria-expanded={isOpen}
      >
        <span className={selected ? 'is-value' : 'is-placeholder'}>
          {isLoading ? 'Загружаем...' : selectedLabel || placeholder}
        </span>

        <svg className="company-geo-select__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 9L12 15L18 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen ? (
        <div className="company-geo-select__dropdown">
          <button
            type="button"
            className={`company-geo-select__option ${!value ? 'is-active' : ''}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('')
              setOpenSelect(null)
            }}
          >
            {placeholder}
          </button>

          {options.length > 0 ? (
            options.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`company-geo-select__option ${String(item.id) === value ? 'is-active' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(String(item.id))
                  setOpenSelect(null)
                }}
              >
                {getLabel(item)}
              </button>
            ))
          ) : (
            <div className="company-geo-select__empty">{emptyText}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}

type CompanyOfficeSelectorProps = {
  cities: GeoCity[]
  regions: GeoRegion[]
  districts: GeoDistrict[]
  selectedCityIds: number[]
  regionId: string
  districtId: string
  cityIdToAdd: string
  openSelect: string | null
  isCitiesLoading?: boolean
  isRegionsLoading?: boolean
  isDistrictsLoading?: boolean
  error?: string
  setOpenSelect: (value: string | null) => void
  onRegionChange: (value: string) => void
  onDistrictChange: (value: string) => void
  onCityIdToAddChange: (value: string) => void
  onAddCity: () => void
  onRemoveCity: (cityId: number) => void
}

const CompanyOfficeSelector = ({
  cities,
  regions,
  districts,
  selectedCityIds,
  regionId,
  districtId,
  cityIdToAdd,
  openSelect,
  isCitiesLoading,
  isRegionsLoading,
  isDistrictsLoading,
  error,
  setOpenSelect,
  onRegionChange,
  onDistrictChange,
  onCityIdToAddChange,
  onAddCity,
  onRemoveCity,
}: CompanyOfficeSelectorProps) => {
  const selectedIds = new Set(selectedCityIds)

  const filteredDistricts = districts.filter(
    (district) => !regionId || String(district.region_id || '') === regionId,
  )

  const availableCities = cities
    .filter((city) => !regionId || String(city.region_id || '') === regionId)
    .filter((city) => !districtId || String(city.district_id || '') === districtId)
    .filter((city) => !selectedIds.has(city.id))
    .slice(0, 200)

  const selectedCities = selectedCityIds
    .map((id) => cities.find((city) => city.id === id))
    .filter(Boolean) as GeoCity[]

  return (
    <section className="company-profile-offices company-profile-field--full">
      <div className="company-profile-offices__head">
        <div>
          <span className="company-profile-eyebrow">Офисы компании</span>
          <h3>Города присутствия</h3>
          <p>Выберите населённые пункты, где есть офисы или филиалы компании.</p>
        </div>

        <strong>{selectedCityIds.length}</strong>
      </div>

      <div className="company-profile-offices__select-grid">
        <CompanyGeoSelect
          label="Область"
          placeholder="Все области"
          value={regionId}
          options={regions}
          openKey="office-region"
          openSelect={openSelect}
          isLoading={isRegionsLoading}
          setOpenSelect={setOpenSelect}
          onChange={(nextValue) => {
            onRegionChange(nextValue)
            onDistrictChange('')
            onCityIdToAddChange('')
          }}
        />

        <CompanyGeoSelect
          label="Район"
          placeholder="Все районы"
          value={districtId}
          options={filteredDistricts}
          openKey="office-district"
          openSelect={openSelect}
          isLoading={isDistrictsLoading}
          disabled={!regionId}
          emptyText={regionId ? 'В выбранной области нет районов' : 'Сначала выберите область'}
          getLabel={(district) =>
            district.region_name ? `${district.name}, ${district.region_name}` : district.name
          }
          setOpenSelect={setOpenSelect}
          onChange={(nextValue) => {
            onDistrictChange(nextValue)
            onCityIdToAddChange('')
          }}
        />

        <CompanyGeoSelect
          label="Город / населённый пункт"
          placeholder="Выберите город"
          value={cityIdToAdd}
          options={availableCities}
          openKey="office-city"
          openSelect={openSelect}
          isLoading={isCitiesLoading}
          disabled={!regionId || !districtId}
          emptyText={
            !regionId
              ? 'Сначала выберите область'
              : !districtId
                ? 'Сначала выберите район'
                : 'В выбранном районе нет доступных городов'
          }
          getLabel={(city) => getCityDisplayName(city)}
          setOpenSelect={setOpenSelect}
          onChange={onCityIdToAddChange}
        />

        <button
          type="button"
          className="company-profile-btn company-profile-btn--primary company-profile-offices__add-btn"
          onClick={onAddCity}
          disabled={!cityIdToAdd || isCitiesLoading}
        >
          Добавить город
        </button>
      </div>

      {error ? <FieldError message={error} /> : null}

      {selectedCities.length > 0 ? (
        <div className="company-profile-office-list">
          {selectedCities.map((city) => (
            <div key={city.id} className="company-profile-office-chip">
              <span>{getCityDisplayName(city)}</span>
              <button
                type="button"
                onClick={() => onRemoveCity(city.id)}
                aria-label={`Удалить ${getCityDisplayName(city)}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="company-profile-offices__empty">
          Города офисов пока не выбраны. Добавьте хотя бы один город, чтобы кандидаты видели географию компании.
        </div>
      )}
    </section>
  )
}

export const EmployerCompanyProfilePage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [noticeSuccess, setNoticeSuccess] = useState('')
  const [noticeError, setNoticeError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<CompanyFieldErrors>(emptyCompanyFieldErrors())

  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [emailWarning, setEmailWarning] = useState('')
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([])

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [foundedYear, setFoundedYear] = useState('')
  const [employeeCount, setEmployeeCount] = useState('')

  const [selectedCityIds, setSelectedCityIds] = useState<number[]>([])
  const [officeRegionId, setOfficeRegionId] = useState('')
  const [officeDistrictId, setOfficeDistrictId] = useState('')
  const [officeCityIdToAdd, setOfficeCityIdToAdd] = useState('')
  const [openOfficeSelect, setOpenOfficeSelect] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [emailPassword, setEmailPassword] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['employer-profile', 'company-profile-page'],
    queryFn: fetchCompanyProfile,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const authMeQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: fetchAuthMe,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const regionsQuery = useQuery({
    queryKey: ['company-profile-regions'],
    queryFn: () => fetchCatalog<GeoRegion>('regions'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const districtsQuery = useQuery({
    queryKey: ['company-profile-districts'],
    queryFn: () => fetchCatalog<GeoDistrict>('districts'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['company-profile-cities'],
    queryFn: () => fetchCatalog<GeoCity>('cities', 1000),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const updateProfileMutation = useMutation({
    mutationFn: updateCompanyProfile,
    onSuccess: async () => {
      setNoticeSuccess('Профиль компании успешно сохранён.')
      setNoticeError('')
      setFieldErrors(emptyCompanyFieldErrors())

      await Promise.all([
        profileQuery.refetch(),
        queryClient.invalidateQueries({ queryKey: ['employer-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['employer-profile', 'company-profile-page'] }),
      ])
    },
    onError: (error) => {
      setNoticeSuccess('')
      setNoticeError(getApiErrorMessage(error, 'Не удалось сохранить профиль компании.'))
    },
  })

  const emailMutation = useMutation({
    mutationFn: async () =>
      updateSensitiveCredentials({
        email: emailDraft.trim(),
        phone: null,
        current_password: emailPassword,
      }),
    onSuccess: async () => {
      const nextEmail = emailDraft.trim()

      setEmail(nextEmail)
      setEmailSuccess('Email успешно обновлён.')
      setEmailError('')
      setEmailWarning('')
      setEmailPassword('')
      setIsEmailModalOpen(false)

      await authMeQuery.refetch()
    },
    onError: (error) => {
      setEmailSuccess('')
      setEmailError(
        getApiErrorMessage(error, 'Не удалось изменить email. Проверьте текущий пароль.'),
      )
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess('Пароль изменён. Выполняем выход из аккаунта.')
      setPasswordError('')
      setPasswordWarnings([])
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')

      window.setTimeout(() => {
        authSession.clear()
        navigate('/login', { replace: true })
      }, 1200)
    },
    onError: (error) => {
      setPasswordSuccess('')
      setPasswordError(
        getApiErrorMessage(error, 'Не удалось изменить пароль. Проверьте текущий пароль.'),
      )
    },
  })

  useEffect(() => {
    const profile = profileQuery.data
    if (!profile) return

    setName(profile.name || '')
    setDescription(profile.description || '')
    setWebsite(profile.website || '')
    setFoundedYear(profile.founded_year ? String(profile.founded_year) : '')
    setEmployeeCount(
      profile.employee_count !== null && profile.employee_count !== undefined
        ? String(profile.employee_count)
        : '',
    )

    const idsFromProfile = [
      ...(Array.isArray(profile.city_ids) ? profile.city_ids : []),
      ...(Array.isArray(profile.cities)
        ? profile.cities
            .map((city) => city?.id)
            .filter((id): id is number => typeof id === 'number')
        : []),
    ]

    setSelectedCityIds(Array.from(new Set(idsFromProfile)))
  }, [profileQuery.data])

  useEffect(() => {
    const profile = profileQuery.data
    const cities = citiesQuery.data || []

    if (!profile || selectedCityIds.length > 0 || cities.length === 0) return

    const cityNames = Array.isArray(profile.city_names) ? profile.city_names : []
    if (!cityNames.length) return

    const normalizedNames = new Set(cityNames.map((name) => name.trim().toLowerCase()))

    const matchedIds = cities
      .filter((city) => {
        const variants = [city.name, city.full_name, getCityDisplayName(city)]
          .filter(Boolean)
          .map((value) => String(value).trim().toLowerCase())

        return variants.some((variant) => normalizedNames.has(variant))
      })
      .map((city) => city.id)

    if (matchedIds.length) {
      setSelectedCityIds(Array.from(new Set(matchedIds)))
    }
  }, [profileQuery.data, citiesQuery.data, selectedCityIds.length])

  useEffect(() => {
    const me = authMeQuery.data
    if (!me) return

    setEmail(me.email || '')
    setEmailDraft(me.email || '')
  }, [authMeQuery.data])

  useEffect(() => {
    const hasOpenedModal = isEmailModalOpen || isPasswordModalOpen
    document.body.style.overflow = hasOpenedModal ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isEmailModalOpen, isPasswordModalOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setIsEmailModalOpen(false)
      setIsPasswordModalOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.company-geo-select')) {
        setOpenOfficeSelect(null)
      }
    }

    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [])

  const vacanciesCount = useMemo(() => {
    const profile = profileQuery.data

    if (!profile) return 0
    if (typeof profile.vacancies_count === 'number') return profile.vacancies_count
    if (Array.isArray(profile.vacancies)) return profile.vacancies.length

    return 0
  }, [profileQuery.data])

  const completionPercent = useMemo(() => {
    const fields = [
      name.trim(),
      description.trim(),
      website.trim(),
      foundedYear.trim(),
      employeeCount.trim(),
      selectedCityIds.length ? 'offices' : '',
    ]

    const filled = fields.filter(Boolean).length

    return Math.round((filled / fields.length) * 100)
  }, [name, description, website, foundedYear, employeeCount, selectedCityIds.length])

  const yearsOnMarket = useMemo(() => {
    const parsed = parsePositiveInteger(foundedYear)
    

    if (!parsed) return null

    return parsed
  }, [foundedYear])

  const normalizedLogo = profileQuery.data?.logo?.trim() || ''
  const displayName = name.trim() || 'Профиль компании'
  const initials = getCompanyInitials(displayName)

  const cities = citiesQuery.data || []
  const regions = regionsQuery.data || []
  const districts = districtsQuery.data || []

  const selectedOfficeCities = useMemo(() => {
    return selectedCityIds
      .map((id) => cities.find((city) => city.id === id))
      .filter(Boolean) as GeoCity[]
  }, [selectedCityIds, cities])

  const validateProfile = () => {
    const nextErrors = emptyCompanyFieldErrors()

    const normalizedName = name.trim()
    const normalizedDescription = description.trim()
    const parsedFoundedYear = parsePositiveInteger(foundedYear)
    const parsedEmployeeCount = parsePositiveInteger(employeeCount)

    if (!normalizedName) {
      nextErrors.name = 'Укажите название компании.'
    } else if (normalizedName.length < 2) {
      nextErrors.name = 'Название компании слишком короткое.'
    } else if (normalizedName.length > 120) {
      nextErrors.name = 'Название компании должно быть не длиннее 120 символов.'
    }

    if (normalizedDescription && normalizedDescription.length < 20) {
      nextErrors.description = 'Описание компании слишком короткое. Минимум 20 символов.'
    }

    if (!isValidUrl(website)) {
      nextErrors.website = 'Введите корректный сайт компании.'
    }

    if (parsedFoundedYear === undefined) {
      nextErrors.foundedYear = 'Год основания должен быть целым числом.'
    } else if (parsedFoundedYear !== null && parsedFoundedYear < 1800) {
      nextErrors.foundedYear = 'Год основания выглядит некорректно.'
    } else if (parsedFoundedYear !== null && parsedFoundedYear > currentYear) {
      nextErrors.foundedYear = 'Год основания не может быть в будущем.'
    }

    if (parsedEmployeeCount === undefined) {
      nextErrors.employeeCount = 'Количество сотрудников должно быть целым числом.'
    }

    if (selectedCityIds.length === 0) {
      nextErrors.offices = 'Добавьте хотя бы один город офиса компании.'
    }

    setFieldErrors(nextErrors)

    return Object.values(nextErrors).some(Boolean)
  }

  const buildProfilePayload = () => {
    const parsedFoundedYear = parsePositiveInteger(foundedYear)
    const parsedEmployeeCount = parsePositiveInteger(employeeCount)

    return {
      name: name.trim(),
      description: description.trim() || null,
      website: website.trim() ? normalizeUrl(website) : null,
      logo: profileQuery.data?.logo || null,
      founded_year: parsedFoundedYear,
      employee_count: parsedEmployeeCount,
      city_ids: selectedCityIds,
    }
  }

  const handleAddOfficeCity = () => {
    const nextCityId = Number(officeCityIdToAdd)

    if (!Number.isFinite(nextCityId) || nextCityId <= 0) return

    setSelectedCityIds((prev) => {
      if (prev.includes(nextCityId)) return prev
      return [...prev, nextCityId]
    })

    setOfficeCityIdToAdd('')
    setOpenOfficeSelect(null)
    setFieldErrors((prev) => ({ ...prev, offices: '' }))
    setNoticeError('')
    setNoticeSuccess('')
  }

  const handleRemoveOfficeCity = (cityId: number) => {
    setSelectedCityIds((prev) => prev.filter((id) => id !== cityId))
    setFieldErrors((prev) => ({ ...prev, offices: '' }))
    setNoticeError('')
    setNoticeSuccess('')
  }

  const handleSaveProfile = async () => {
    setNoticeSuccess('')
    setNoticeError('')

    const hasErrors = validateProfile()
    if (hasErrors) return

    try {
      await updateProfileMutation.mutateAsync(buildProfilePayload())
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const handleSaveEmail = async () => {
    setEmailSuccess('')
    setEmailError('')

    const warning = validateEmailValue(emailDraft)

    if (warning) {
      setEmailWarning(warning)
      return
    }

    if (!emailPassword.trim()) {
      setEmailError('Введите текущий пароль.')
      return
    }

    if (emailDraft.trim() === email.trim()) {
      setEmailError('Новый email совпадает с текущим.')
      return
    }

    setEmailWarning('')

    try {
      await emailMutation.mutateAsync()
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const handleChangePassword = async () => {
    setPasswordSuccess('')
    setPasswordError('')

    const warnings = validatePasswordValue(newPassword)

    if (warnings.length) {
      setPasswordWarnings(warnings)
      return
    }

    setPasswordWarnings([])

    if (!currentPassword.trim()) {
      setPasswordError('Введите текущий пароль.')
      return
    }

    if (!confirmNewPassword) {
      setPasswordError('Подтвердите новый пароль.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError('Новый пароль и подтверждение не совпадают.')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('Новый пароль должен отличаться от текущего.')
      return
    }

    try {
      await passwordMutation.mutateAsync({
        current_password: currentPassword,
        new_password: newPassword,
      })
    } catch {
      // Ошибка обработана в onError.
    }
  }

  const isPageLoading = profileQuery.isLoading || authMeQuery.isLoading
  const isPageError = profileQuery.isError || authMeQuery.isError

  return (
    <div className="company-profile-page">
      <Header />

      <main className="company-profile-page__main">
        <div className="company-profile-container">
          <section className="company-profile-shell">
            <aside className="company-profile-sidebar">
              <section className="company-profile-summary-card">
                <div className="company-profile-logo-wrap">
                  {normalizedLogo ? (
                    <img
                      src={normalizedLogo}
                      alt="Логотип компании"
                      className="company-profile-logo"
                    />
                  ) : (
                    <div className="company-profile-logo company-profile-logo--placeholder">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="company-profile-summary-content">
                  <span className="company-profile-eyebrow">Компания</span>

                  <h1>{displayName}</h1>

                  <p>Заполненный профиль помогает кандидатам быстрее понять работодателя.</p>
                </div>

                <div className="company-profile-progress">
                  <div className="company-profile-progress__head">
                    <span>Заполненность</span>
                    <strong>{completionPercent}%</strong>
                  </div>

                  <div className="company-profile-progress__bar">
                    <span style={{ width: `${completionPercent}%` }} />
                  </div>
                </div>

                <div className="company-profile-stats">
                  <div className="company-profile-stat">
                    <span>Вакансий</span>
                    <strong>{formatCompactNumber(vacanciesCount)}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Сотрудников</span>
                    <strong>{formatCompactNumber(parsePositiveInteger(employeeCount) || null)}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Год основания</span>
                    <strong>{yearsOnMarket !== null ? `${yearsOnMarket}` : '—'}</strong>
                  </div>

                  <div className="company-profile-stat">
                    <span>Городов офисов</span>
                    <strong>{selectedCityIds.length}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className="company-profile-btn company-profile-btn--outline company-profile-logo-btn"
                  disabled
                >
                  Логотип скоро появится
                </button>
              </section>
            </aside>

            <section className="company-profile-main">
              <section className="company-profile-main-card">
                <div className="company-profile-main-card__header">
                  <div>
                    <span className="company-profile-eyebrow">Кабинет работодателя</span>

                    <h2>Профиль компании</h2>

                    <p>Укажите данные компании, которые будут использоваться в вакансиях.</p>
                  </div>

                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--outline"
                    onClick={() => navigate('/employer/vacancies')}
                  >
                    ← К вакансиям
                  </button>
                </div>

                {isPageLoading ? (
                  <div className="company-profile-state">Загружаем профиль компании...</div>
                ) : null}

                {isPageError ? (
                  <div className="company-profile-message company-profile-message--error">
                    {profileQuery.isError
                      ? getApiErrorMessage(profileQuery.error, 'Не удалось загрузить профиль компании.')
                      : getApiErrorMessage(authMeQuery.error, 'Не удалось загрузить данные аккаунта.')}
                  </div>
                ) : null}

                {noticeSuccess ? (
                  <div className="company-profile-message company-profile-message--success">
                    {noticeSuccess}
                  </div>
                ) : null}

                {noticeError ? (
                  <div className="company-profile-message company-profile-message--error">
                    {noticeError}
                  </div>
                ) : null}

                <div className="company-profile-form-grid">
                  <label className="company-profile-field">
                    <span>Название компании</span>

                    <input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, name: '' }))
                        setNoticeError('')
                        setNoticeSuccess('')
                      }}
                      maxLength={120}
                      placeholder="Например: SoftStore"
                    />

                    <FieldError message={fieldErrors.name} />
                  </label>

                  <label className="company-profile-field">
                    <span>Сайт компании</span>

                    <input
                      value={website}
                      onChange={(event) => {
                        setWebsite(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, website: '' }))
                        setNoticeError('')
                        setNoticeSuccess('')
                      }}
                      placeholder="Например: softstore.by"
                    />

                    <FieldError message={fieldErrors.website} />
                  </label>

                  <label className="company-profile-field company-profile-field--full">
                    <span>Описание компании</span>

                    <textarea
                      value={description}
                      onChange={(event) => {
                        setDescription(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, description: '' }))
                        setNoticeError('')
                        setNoticeSuccess('')
                      }}
                      maxLength={2000}
                      placeholder="Расскажите, чем занимается компания, какая у вас команда и почему кандидату стоит выбрать вас."
                    />

                    <FieldError message={fieldErrors.description} />
                  </label>

                  <div className="company-profile-counter">
                    {description.trim().length}/2000 символов
                  </div>
                </div>

                <CompanyOfficeSelector
                  cities={cities}
                  regions={regions}
                  districts={districts}
                  selectedCityIds={selectedCityIds}
                  regionId={officeRegionId}
                  districtId={officeDistrictId}
                  cityIdToAdd={officeCityIdToAdd}
                  openSelect={openOfficeSelect}
                  isCitiesLoading={citiesQuery.isLoading}
                  isRegionsLoading={regionsQuery.isLoading}
                  isDistrictsLoading={districtsQuery.isLoading}
                  error={fieldErrors.offices}
                  setOpenSelect={setOpenOfficeSelect}
                  onRegionChange={(value) => {
                    setOfficeRegionId(value)
                    setNoticeError('')
                    setNoticeSuccess('')
                  }}
                  onDistrictChange={(value) => {
                    setOfficeDistrictId(value)
                    setNoticeError('')
                    setNoticeSuccess('')
                  }}
                  onCityIdToAddChange={setOfficeCityIdToAdd}
                  onAddCity={handleAddOfficeCity}
                  onRemoveCity={handleRemoveOfficeCity}
                />

                <div className="company-profile-form-grid company-profile-form-grid--compact">
                  <label className="company-profile-field">
                    <span>Год основания</span>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={1800}
                      max={currentYear}
                      value={foundedYear}
                      onChange={(event) => {
                        setFoundedYear(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, foundedYear: '' }))
                        setNoticeError('')
                        setNoticeSuccess('')
                      }}
                      placeholder="Например: 2018"
                    />

                    <FieldError message={fieldErrors.foundedYear} />
                  </label>

                  <label className="company-profile-field">
                    <span>Количество сотрудников</span>

                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={employeeCount}
                      onChange={(event) => {
                        setEmployeeCount(event.target.value)
                        setFieldErrors((prev) => ({ ...prev, employeeCount: '' }))
                        setNoticeError('')
                        setNoticeSuccess('')
                      }}
                      placeholder="Например: 100000"
                    />

                    <FieldError message={fieldErrors.employeeCount} />
                  </label>
                </div>

                <div className="company-security-list">
                  <div className="company-security-row">
                    <div className="company-security-row__content">
                      <span>Email</span>
                      <strong>{email || 'Не указан'}</strong>
                    </div>

                    <button
                      type="button"
                      className="company-security-edit-btn"
                      onClick={() => {
                        setEmailSuccess('')
                        setEmailError('')
                        setEmailWarning('')
                        setEmailPassword('')
                        setEmailDraft(email)
                        setIsEmailModalOpen(true)
                      }}
                      aria-label="Изменить email"
                    >
                      <EditIcon />
                    </button>
                  </div>

                  <div className="company-security-row">
                    <div className="company-security-row__content">
                      <span>Пароль</span>
                      <strong>••••••••</strong>
                    </div>

                    <button
                      type="button"
                      className="company-security-edit-btn"
                      onClick={() => {
                        setPasswordSuccess('')
                        setPasswordError('')
                        setPasswordWarnings([])
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmNewPassword('')
                        setIsPasswordModalOpen(true)
                      }}
                      aria-label="Изменить пароль"
                    >
                      <EditIcon />
                    </button>
                  </div>
                </div>

                <div className="company-profile-main-card__footer">
                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--outline"
                    onClick={() => navigate('/employer/vacancies/create')}
                  >
                    Создать вакансию
                  </button>

                  <button
                    type="button"
                    className="company-profile-btn company-profile-btn--primary company-profile-save-btn"
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending || isPageLoading}
                  >
                    {updateProfileMutation.isPending ? 'Сохраняем...' : 'Сохранить профиль'}
                  </button>
                </div>
              </section>
            </section>
          </section>
        </div>

        {isEmailModalOpen && (
          <SecurityModal title="Изменение email" onClose={() => setIsEmailModalOpen(false)}>
            {emailSuccess ? (
              <div className="company-profile-message company-profile-message--success">
                {emailSuccess}
              </div>
            ) : null}

            {emailError ? (
              <div className="company-profile-message company-profile-message--error">
                {emailError}
              </div>
            ) : null}

            <label className="company-profile-field">
              <span>Новый email</span>

              <input
                type="email"
                value={emailDraft}
                onChange={(event) => {
                  const value = event.target.value

                  setEmailDraft(value)
                  setEmailWarning(value ? validateEmailValue(value) : '')
                  setEmailError('')
                }}
                placeholder="name@example.com"
              />

              <FieldError message={emailWarning} />
            </label>

            <label className="company-profile-field">
              <span>Текущий пароль</span>

              <PasswordInput
                value={emailPassword}
                placeholder="Введите текущий пароль"
                autoComplete="current-password"
                onChange={(value) => {
                  setEmailPassword(value)
                  setEmailError('')
                }}
              />
            </label>

            <div className="company-profile-modal__footer">
              <button
                type="button"
                className="company-profile-btn company-profile-btn--outline"
                onClick={() => setIsEmailModalOpen(false)}
              >
                Отмена
              </button>

              <button
                type="button"
                className="company-profile-btn company-profile-btn--primary"
                onClick={handleSaveEmail}
                disabled={emailMutation.isPending}
              >
                {emailMutation.isPending ? 'Сохраняем...' : 'Сохранить email'}
              </button>
            </div>
          </SecurityModal>
        )}

        {isPasswordModalOpen && (
          <SecurityModal
            title="Смена пароля"
            subtitle="После успешной смены пароля потребуется заново войти в аккаунт."
            onClose={() => setIsPasswordModalOpen(false)}
          >
            {passwordSuccess ? (
              <div className="company-profile-message company-profile-message--success">
                {passwordSuccess}
              </div>
            ) : null}

            {passwordError ? (
              <div className="company-profile-message company-profile-message--error">
                {passwordError}
              </div>
            ) : null}

            <div className="company-profile-form-grid company-profile-form-grid--password">
              <label className="company-profile-field">
                <span>Текущий пароль</span>

                <PasswordInput
  value={currentPassword}
  placeholder="Введите текущий пароль"
  autoComplete="current-password"
  onChange={(value) => {
    setCurrentPassword(value)
    setPasswordError('')
  }}
/>
              </label>

              <label className="company-profile-field">
                <span>Новый пароль</span>

                <PasswordInput
  value={newPassword}
  placeholder="Aa123456!"
  autoComplete="new-password"
  onChange={(value) => {
    setNewPassword(value)
    setPasswordWarnings(value ? validatePasswordValue(value) : [])
    setPasswordError('')
  }}
/>

                <PasswordErrors errors={passwordWarnings} />
              </label>

              <label className="company-profile-field company-profile-field--full">
                <span>Подтверждение нового пароля</span>

                <PasswordInput
  value={confirmNewPassword}
  placeholder="Повторите новый пароль"
  autoComplete="new-password"
  onChange={(value) => {
    setConfirmNewPassword(value)
    setPasswordError('')
  }}
/>
              </label>
            </div>

            <div className="company-profile-modal__footer">
              <button
                type="button"
                className="company-profile-btn company-profile-btn--outline"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Отмена
              </button>

              <button
                type="button"
                className="company-profile-btn company-profile-btn--primary"
                onClick={handleChangePassword}
                disabled={passwordMutation.isPending}
              >
                {passwordMutation.isPending ? 'Меняем пароль...' : 'Изменить пароль'}
              </button>
            </div>
          </SecurityModal>
        )}
      </main>

      <Footer />
    </div>
  )
}