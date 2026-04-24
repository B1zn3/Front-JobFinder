import type { AxiosError } from 'axios'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './applicant-profile.css'

type CityItem = {
  id: number
  name: string
}

type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  gender?: string | null
  birth_date?: string | null
  city?: {
    id: number
    name: string
  } | null
  photo_url?: string | null
  phone?: string | null
}

type AuthMeResponse = {
  id: number
  email: string
  role: string
  is_active: boolean
}

type ComboOption = {
  value: string | number
  label: string
}

type ProfileFieldErrors = {
  city: string
  birthDate: string
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

const monthOptions: ComboOption[] = [
  { value: '01', label: 'Январь' },
  { value: '02', label: 'Февраль' },
  { value: '03', label: 'Март' },
  { value: '04', label: 'Апрель' },
  { value: '05', label: 'Май' },
  { value: '06', label: 'Июнь' },
  { value: '07', label: 'Июль' },
  { value: '08', label: 'Август' },
  { value: '09', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' },
]

const currentYear = new Date().getFullYear()

const yearOptions: ComboOption[] = Array.from({ length: 81 }, (_, index) => {
  const year = String(currentYear - index)
  return { value: year, label: year }
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const phoneRegex = /^\+?[1-9]\d{8,14}$/
const specialRegex = /[^A-Za-zА-Яа-я0-9]/

const emptyProfileFieldErrors = (): ProfileFieldErrors => ({
  city: '',
  birthDate: '',
})

const normalizePhoneForValidation = (value: string) => {
  return value.replace(/[()\-\s]/g, '').trim()
}

const validateEmailValue = (value: string) => {
  const normalized = value.trim()

  if (!normalized) return 'Введите email.'
  if (!emailRegex.test(normalized)) return 'Введите корректный email.'

  return ''
}

const validatePhoneValue = (value: string) => {
  const normalized = normalizePhoneForValidation(value)

  if (!normalized) return 'Введите телефон.'
  if (!phoneRegex.test(normalized)) return 'Введите телефон в формате +375291234567.'

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

const uniqueMessages = (messages: string[]) => {
  return Array.from(new Set(messages.filter(Boolean)))
}

const translateApiErrorMessage = (message: string, status?: number) => {
  const lower = message.toLowerCase()

  if (
    lower.includes('applicants_phone_key') ||
    lower.includes('key (phone)') ||
    lower.includes('phone already') ||
    lower.includes('phone exists') ||
    lower.includes('телефон уже') ||
    lower.includes('номер уже')
  ) {
    return 'Телефон уже используется другим аккаунтом.'
  }

  if (
    lower.includes('users_email_key') ||
    lower.includes('user_email_key') ||
    lower.includes('key (email)') ||
    lower.includes('email already') ||
    lower.includes('email exists') ||
    lower.includes('email уже') ||
    lower.includes('почта уже')
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

  if (
    lower.includes('phone') &&
    (lower.includes('invalid') || lower.includes('некоррект'))
  ) {
    return 'Введите телефон в формате +375291234567.'
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

  if (
    lower.includes('profile not found') ||
    lower.includes('applicant not found') ||
    lower.includes('профиль не найден')
  ) {
    return 'Профиль соискателя не найден.'
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

  if (data?.message) {
    return translateApiErrorMessage(data.message, status)
  }

  if (data?.error) {
    return translateApiErrorMessage(data.error, status)
  }

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

const getDaysInMonth = (year: string, month: string) => {
  if (!month) return 31

  const parsedYear = year ? Number(year) : 2000
  const parsedMonth = Number(month)

  if (!Number.isFinite(parsedYear) || !Number.isFinite(parsedMonth)) return 31

  return new Date(parsedYear, parsedMonth, 0).getDate()
}

const makeDayOptions = (year: string, month: string): ComboOption[] => {
  const daysCount = getDaysInMonth(year, month)

  return Array.from({ length: daysCount }, (_, index) => {
    const day = String(index + 1).padStart(2, '0')
    return { value: day, label: day }
  })
}

const isRealDate = (day: string, month: string, year: string) => {
  const parsedDay = Number(day)
  const parsedMonth = Number(month)
  const parsedYear = Number(year)

  if (
    !Number.isInteger(parsedDay) ||
    !Number.isInteger(parsedMonth) ||
    !Number.isInteger(parsedYear)
  ) {
    return false
  }

  const date = new Date(parsedYear, parsedMonth - 1, parsedDay)

  return (
    date.getFullYear() === parsedYear &&
    date.getMonth() === parsedMonth - 1 &&
    date.getDate() === parsedDay
  )
}

const getStartOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const validateBirthDateValue = (day: string, month: string, year: string) => {
  const hasAnyPart = Boolean(day || month || year)

  if (!hasAnyPart) return ''

  if (!day || !month || !year) {
    return 'Укажите дату рождения полностью.'
  }

  if (!isRealDate(day, month, year)) {
    return 'Такой даты не существует.'
  }

  const today = getStartOfDay(new Date())
  const minDate = new Date(today)
  minDate.setFullYear(today.getFullYear() - 80)

  const birthDate = new Date(Number(year), Number(month) - 1, Number(day))

  if (birthDate > today) {
    return 'Дата рождения не может быть в будущем.'
  }

  if (birthDate < minDate) {
    return 'Дата рождения должна быть в пределах последних 80 лет.'
  }

  return ''
}

const formatBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) {
    return { day: '', month: '', year: '' }
  }

  const match = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (!match) {
    return { day: '', month: '', year: '' }
  }

  return {
    year: match[1],
    month: match[2],
    day: match[3],
  }
}

const buildBirthDate = (day: string, month: string, year: string) => {
  if (!day || !month || !year) return null
  return `${year}-${month}-${day}`
}

const normalizeGender = (value?: string | null) => {
  if (value === 'м' || value === 'Мужской') return 'Мужской'
  if (value === 'ж' || value === 'Женский') return 'Женский'
  return ''
}

const getInitials = (firstName: string, lastName: string) => {
  const first = firstName.trim().charAt(0)
  const last = lastName.trim().charAt(0)

  return `${first}${last}`.trim().toUpperCase() || 'A'
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile | null> => {
  const { data } = await http.get('/applicants/me')
  return data || null
}

const fetchAuthMe = async (): Promise<AuthMeResponse> => {
  const { data } = await http.get('/auth/me')
  return data
}

const fetchCities = async (): Promise<CityItem[]> => {
  const { data } = await http.get('/public/catalogs/cities', {
    params: { skip: 0, limit: 500 },
  })

  return Array.isArray(data) ? data : []
}

const updateApplicantProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/applicants/me', payload)
  return data
}

const updateSensitiveContacts = async (payload: {
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

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`profile-combo__chevron ${open ? 'is-open' : ''}`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M6 9L12 15L18 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const EditIcon = () => (
  <svg className="security-edit-icon" viewBox="0 0 24 24" aria-hidden="true">
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

type SelectComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: string | number | null
  emptyText?: string
  onToggle: () => void
  onSelect: (option: ComboOption) => void
}

const SelectCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = 'Нет вариантов',
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`profile-combo ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`profile-combo-field ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className={value ? 'profile-combo-field__value' : 'profile-combo-field__placeholder'}>
          {value || placeholder}
        </span>

        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="profile-combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => {
              const isActive =
                activeValue !== undefined &&
                activeValue !== null &&
                String(activeValue) === String(option.value)

              return (
                <button
                  key={String(option.value)}
                  type="button"
                  className={`profile-combo__option ${isActive ? 'is-active' : ''}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onSelect(option)}
                >
                  {option.label}
                </button>
              )
            })
          ) : (
            <div className="profile-combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  )
}

type ModalProps = {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}

const SecurityModal = ({ title, subtitle, onClose, children }: ModalProps) => (
  <div className="profile-modal-overlay" onClick={onClose}>
    <div className="profile-modal" onClick={(event) => event.stopPropagation()}>
      <div className="profile-modal__header">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        <button type="button" className="profile-modal__close" onClick={onClose}>
          ×
        </button>
      </div>

      {children}
    </div>
  </div>
)

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null
  return <span className="profile-field__error">{message}</span>
}

const PasswordErrors = ({ errors }: { errors: string[] }) => {
  if (!errors.length) return null

  return (
    <div className="profile-field-errors">
      {errors.map((error) => (
        <p key={error}>{error}</p>
      ))}
    </div>
  )
}

export const ApplicantProfilePage = () => {
  const navigate = useNavigate()

  const [openCombo, setOpenCombo] = useState<string | null>(null)

  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [profileFieldErrors, setProfileFieldErrors] = useState<ProfileFieldErrors>(
    emptyProfileFieldErrors(),
  )

  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [emailWarning, setEmailWarning] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([])

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [gender, setGender] = useState<'Мужской' | 'Женский' | ''>('')
  const [cityId, setCityId] = useState<number | null>(null)
  const [cityName, setCityName] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  const [emailDraft, setEmailDraft] = useState('')
  const [emailPassword, setEmailPassword] = useState('')

  const [phoneDraft, setPhoneDraft] = useState('')
  const [phonePassword, setPhonePassword] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)

  const profileQuery = useQuery({
    queryKey: ['applicant-profile-page'],
    queryFn: fetchApplicantProfile,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const authMeQuery = useQuery({
    queryKey: ['auth-me'],
    queryFn: fetchAuthMe,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['profile-cities'],
    queryFn: fetchCities,
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement

      if (!target.closest('.profile-combo')) {
        setOpenCombo(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  useEffect(() => {
    const hasOpenedModal = isEmailModalOpen || isPhoneModalOpen || isPasswordModalOpen
    document.body.style.overflow = hasOpenedModal ? 'hidden' : ''

    return () => {
      document.body.style.overflow = ''
    }
  }, [isEmailModalOpen, isPhoneModalOpen, isPasswordModalOpen])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setIsEmailModalOpen(false)
      setIsPhoneModalOpen(false)
      setIsPasswordModalOpen(false)
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  useEffect(() => {
    const profile = profileQuery.data
    if (!profile) return

    const birth = formatBirthDateParts(profile.birth_date)

    setFirstName(profile.first_name || '')
    setLastName(profile.last_name || '')
    setMiddleName(profile.middle_name || '')
    setGender(normalizeGender(profile.gender))
    setCityId(profile.city?.id ?? null)
    setCityName(profile.city?.name || '')
    setBirthDay(birth.day)
    setBirthMonth(birth.month)
    setBirthYear(birth.year)
    setPhone(profile.phone || '')
    setPhoneDraft(profile.phone || '')
  }, [profileQuery.data])

  useEffect(() => {
    const me = authMeQuery.data
    if (!me) return

    setEmail(me.email || '')
    setEmailDraft(me.email || '')
  }, [authMeQuery.data])

  useEffect(() => {
    if (!birthDay) return

    const maxDay = getDaysInMonth(birthYear, birthMonth)

    if (Number(birthDay) > maxDay) {
      setBirthDay('')
    }
  }, [birthDay, birthMonth, birthYear])

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
    onSuccess: () => {
      setProfileSuccess('Профиль успешно сохранён.')
      setProfileError('')
      setProfileFieldErrors(emptyProfileFieldErrors())
      void profileQuery.refetch()
    },
    onError: (error) => {
      setProfileSuccess('')
      setProfileError(getApiErrorMessage(error, 'Не удалось сохранить профиль.'))
    },
  })

  const emailMutation = useMutation({
    mutationFn: async () =>
      updateSensitiveContacts({
        email: emailDraft.trim(),
        phone: normalizePhoneForValidation(phone) || null,
        current_password: emailPassword,
      }),
    onSuccess: () => {
      const nextEmail = emailDraft.trim()

      setEmail(nextEmail)
      setEmailSuccess('Email успешно обновлён.')
      setEmailError('')
      setEmailPassword('')
      setEmailWarning('')
      setIsEmailModalOpen(false)

      void authMeQuery.refetch()
    },
    onError: (error) => {
      setEmailSuccess('')
      setEmailError(
        getApiErrorMessage(error, 'Не удалось изменить email. Проверьте текущий пароль.'),
      )
    },
  })

  const phoneMutation = useMutation({
    mutationFn: async () =>
      updateSensitiveContacts({
        email,
        phone: normalizePhoneForValidation(phoneDraft) || null,
        current_password: phonePassword,
      }),
    onSuccess: () => {
      const nextPhone = normalizePhoneForValidation(phoneDraft)

      setPhone(nextPhone)
      setPhoneSuccess('Телефон успешно обновлён.')
      setPhoneError('')
      setPhonePassword('')
      setPhoneWarning('')
      setIsPhoneModalOpen(false)

      void profileQuery.refetch()
    },
    onError: (error) => {
      setPhoneSuccess('')
      setPhoneError(
        getApiErrorMessage(error, 'Не удалось изменить телефон. Проверьте текущий пароль.'),
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

  const cities = citiesQuery.data || []

  const cityOptions: ComboOption[] = useMemo(() => {
    return [
      { value: '', label: 'Город не указан' },
      ...cities.map((city) => ({
        value: city.id,
        label: city.name,
      })),
    ]
  }, [cities])

  const dayOptions = useMemo(() => {
    return makeDayOptions(birthYear, birthMonth)
  }, [birthYear, birthMonth])

  const selectedMonthLabel = monthOptions.find((item) => item.value === birthMonth)?.label || ''

  const initials = getInitials(firstName, lastName)

  const fullName =
    [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Профиль соискателя'

  const isPageLoading = profileQuery.isLoading || authMeQuery.isLoading
  const isPageError = profileQuery.isError || authMeQuery.isError

  const handleSaveProfile = async () => {
    setProfileSuccess('')
    setProfileError('')

    const nextFieldErrors = emptyProfileFieldErrors()

    const birthDateError = validateBirthDateValue(birthDay, birthMonth, birthYear)
    if (birthDateError) {
      nextFieldErrors.birthDate = birthDateError
    }

    if (cityId !== null) {
      const cityExists = cities.some((city) => city.id === cityId)

      if (!cityExists) {
        nextFieldErrors.city = 'Выберите город из списка.'
      }
    }

    setProfileFieldErrors(nextFieldErrors)

    if (nextFieldErrors.city || nextFieldErrors.birthDate) return

    try {
      await profileMutation.mutateAsync({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        middle_name: middleName.trim() || null,
        gender: gender === 'Мужской' ? 'м' : gender === 'Женский' ? 'ж' : null,
        birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
        city_id: cityId,
        city_name: cityId ? cityName : null,
      })
    } catch {
      // Ошибка уже обработана в onError.
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
      // Ошибка уже обработана в onError.
    }
  }

  const handleSavePhone = async () => {
    setPhoneSuccess('')
    setPhoneError('')

    const warning = validatePhoneValue(phoneDraft)

    if (warning) {
      setPhoneWarning(warning)
      return
    }

    if (!phonePassword.trim()) {
      setPhoneError('Введите текущий пароль.')
      return
    }

    if (normalizePhoneForValidation(phoneDraft) === normalizePhoneForValidation(phone)) {
      setPhoneError('Новый телефон совпадает с текущим.')
      return
    }

    setPhoneWarning('')

    try {
      await phoneMutation.mutateAsync()
    } catch {
      // Ошибка уже обработана в onError.
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
      // Ошибка уже обработана в onError.
    }
  }

  return (
    <div className="applicant-profile-page">
      <Header />

      <main className="applicant-profile-page__main">
        <div className="container">
          <section className="applicant-profile-shell">
            <aside className="applicant-profile-sidebar">
              <div className="profile-summary-card">
                <div className="profile-summary-card__avatar-wrap">
                  {profileQuery.data?.photo_url ? (
                    <img
                      src={profileQuery.data.photo_url}
                      alt="Фото профиля"
                      className="profile-summary-card__avatar-image"
                    />
                  ) : (
                    <div className="profile-summary-card__avatar-placeholder">{initials}</div>
                  )}
                </div>

                <div className="profile-summary-card__content">
                  <span className="profile-summary-card__eyebrow">Профиль</span>

                  <h1 className="profile-summary-card__title">{fullName}</h1>

                  <p className="profile-summary-card__subtitle">
                    Заполненный профиль делает резюме сильнее и понятнее для работодателя.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn--outline profile-summary-card__photo-btn"
                  disabled
                >
                  Фото скоро появится
                </button>
              </div>
            </aside>

            <section className="applicant-profile-main">
              <section className="profile-main-card">
                <div className="profile-main-card__header">
                  <div>
                    <span className="profile-main-card__eyebrow">Основная информация</span>

                    <h2 className="profile-main-card__title">Данные профиля</h2>

                    <p className="profile-main-card__subtitle">
                      Укажите личные данные, город проживания и дату рождения.
                    </p>
                  </div>
                </div>

                {isPageLoading ? (
                  <div className="profile-state">Загружаем профиль...</div>
                ) : null}

                {isPageError ? (
                  <div className="profile-message profile-message--error">
                    Не удалось загрузить данные профиля.
                  </div>
                ) : null}

                {profileSuccess ? (
                  <div className="profile-message profile-message--success">{profileSuccess}</div>
                ) : null}

                {profileError ? (
                  <div className="profile-message profile-message--error">{profileError}</div>
                ) : null}

                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span className="profile-field__label">Имя</span>

                    <input
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Например: Иван"
                    />
                  </label>

                  <label className="profile-field">
                    <span className="profile-field__label">Фамилия</span>

                    <input
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Например: Иванов"
                    />
                  </label>

                  <label className="profile-field profile-field--full">
                    <span className="profile-field__label">Отчество</span>

                    <input
                      value={middleName}
                      onChange={(event) => setMiddleName(event.target.value)}
                      placeholder="Например: Иванович"
                    />
                  </label>
                </div>

                <div className="profile-form-grid">
                  <div className="profile-field profile-field--full">
                    <span className="profile-field__label">Пол</span>

                    <div className="profile-segmented">
                      <button
                        type="button"
                        className={gender === '' ? 'is-active' : ''}
                        onClick={() => setGender('')}
                      >
                        Не указан
                      </button>

                      <button
                        type="button"
                        className={gender === 'Мужской' ? 'is-active' : ''}
                        onClick={() => setGender('Мужской')}
                      >
                        Мужской
                      </button>

                      <button
                        type="button"
                        className={gender === 'Женский' ? 'is-active' : ''}
                        onClick={() => setGender('Женский')}
                      >
                        Женский
                      </button>
                    </div>
                  </div>

                  <div className="profile-field profile-field--full">
                    <span className="profile-field__label">Город проживания</span>

                    <SelectCombo
                      value={cityName}
                      placeholder="Выберите город"
                      isOpen={openCombo === 'city'}
                      options={cityOptions}
                      activeValue={cityId ?? ''}
                      emptyText={citiesQuery.isLoading ? 'Загружаем города...' : 'Города не найдены'}
                      onToggle={() => setOpenCombo((prev) => (prev === 'city' ? null : 'city'))}
                      onSelect={(option) => {
                        if (option.value === '') {
                          setCityId(null)
                          setCityName('')
                        } else {
                          setCityId(Number(option.value))
                          setCityName(option.label)
                        }

                        setProfileFieldErrors((prev) => ({ ...prev, city: '' }))
                        setOpenCombo(null)
                      }}
                    />

                    <FieldError message={profileFieldErrors.city} />
                  </div>
                </div>

                <div className="profile-field profile-field--full">
                  <span className="profile-field__label">Дата рождения</span>

                  <div className="profile-date-grid">
                    <SelectCombo
                      value={birthDay}
                      placeholder="День"
                      isOpen={openCombo === 'birthDay'}
                      options={dayOptions}
                      activeValue={birthDay}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthDay' ? null : 'birthDay'))
                      }
                      onSelect={(option) => {
                        setBirthDay(String(option.value))
                        setProfileFieldErrors((prev) => ({ ...prev, birthDate: '' }))
                        setOpenCombo(null)
                      }}
                    />

                    <SelectCombo
                      value={selectedMonthLabel}
                      placeholder="Месяц"
                      isOpen={openCombo === 'birthMonth'}
                      options={monthOptions}
                      activeValue={birthMonth}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthMonth' ? null : 'birthMonth'))
                      }
                      onSelect={(option) => {
                        setBirthMonth(String(option.value))
                        setProfileFieldErrors((prev) => ({ ...prev, birthDate: '' }))
                        setOpenCombo(null)
                      }}
                    />

                    <SelectCombo
                      value={birthYear}
                      placeholder="Год"
                      isOpen={openCombo === 'birthYear'}
                      options={yearOptions}
                      activeValue={birthYear}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthYear' ? null : 'birthYear'))
                      }
                      onSelect={(option) => {
                        setBirthYear(String(option.value))
                        setProfileFieldErrors((prev) => ({ ...prev, birthDate: '' }))
                        setOpenCombo(null)
                      }}
                    />
                  </div>

                  <FieldError message={profileFieldErrors.birthDate} />
                </div>

                <div className="security-list">
                  <div className="security-row">
                    <div className="security-row__content">
                      <span>Email</span>
                      <strong>{email || 'Не указан'}</strong>
                    </div>

                    <button
                      type="button"
                      className="security-edit-btn"
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

                  <div className="security-row">
                    <div className="security-row__content">
                      <span>Телефон</span>
                      <strong>{phone || 'Не указан'}</strong>
                    </div>

                    <button
                      type="button"
                      className="security-edit-btn"
                      onClick={() => {
                        setPhoneSuccess('')
                        setPhoneError('')
                        setPhoneWarning('')
                        setPhonePassword('')
                        setPhoneDraft(phone)
                        setIsPhoneModalOpen(true)
                      }}
                      aria-label="Изменить телефон"
                    >
                      <EditIcon />
                    </button>
                  </div>

                  <div className="security-row">
                    <div className="security-row__content">
                      <span>Пароль</span>
                      <strong>••••••••</strong>
                    </div>

                    <button
                      type="button"
                      className="security-edit-btn"
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

                <div className="profile-main-card__footer">
                  <button
                    type="button"
                    className="btn btn--primary profile-save-btn"
                    onClick={handleSaveProfile}
                    disabled={profileMutation.isPending}
                  >
                    {profileMutation.isPending ? 'Сохраняем...' : 'Сохранить профиль'}
                  </button>
                </div>
              </section>
            </section>
          </section>
        </div>

        {isEmailModalOpen && (
          <SecurityModal title="Изменение email" onClose={() => setIsEmailModalOpen(false)}>
            {emailSuccess ? (
              <div className="profile-message profile-message--success">{emailSuccess}</div>
            ) : null}

            {emailError ? (
              <div className="profile-message profile-message--error">{emailError}</div>
            ) : null}

            <label className="profile-field">
              <span className="profile-field__label">Новый email</span>

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

            <label className="profile-field">
              <span className="profile-field__label">Текущий пароль</span>

              <input
                type="password"
                value={emailPassword}
                onChange={(event) => {
                  setEmailPassword(event.target.value)
                  setEmailError('')
                }}
                placeholder="Введите текущий пароль"
              />
            </label>

            <div className="profile-modal__footer">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setIsEmailModalOpen(false)}
              >
                Отмена
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSaveEmail}
                disabled={emailMutation.isPending}
              >
                {emailMutation.isPending ? 'Сохраняем...' : 'Сохранить email'}
              </button>
            </div>
          </SecurityModal>
        )}

        {isPhoneModalOpen && (
          <SecurityModal title="Изменение телефона" onClose={() => setIsPhoneModalOpen(false)}>
            {phoneSuccess ? (
              <div className="profile-message profile-message--success">{phoneSuccess}</div>
            ) : null}

            {phoneError ? (
              <div className="profile-message profile-message--error">{phoneError}</div>
            ) : null}

            <label className="profile-field">
              <span className="profile-field__label">Новый телефон</span>

              <input
                value={phoneDraft}
                onChange={(event) => {
                  const value = event.target.value

                  setPhoneDraft(value)
                  setPhoneWarning(value ? validatePhoneValue(value) : '')
                  setPhoneError('')
                }}
                placeholder="+375 (29) 123-45-67"
              />

              <FieldError message={phoneWarning} />
            </label>

            <label className="profile-field">
              <span className="profile-field__label">Текущий пароль</span>

              <input
                type="password"
                value={phonePassword}
                onChange={(event) => {
                  setPhonePassword(event.target.value)
                  setPhoneError('')
                }}
                placeholder="Введите текущий пароль"
              />
            </label>

            <div className="profile-modal__footer">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setIsPhoneModalOpen(false)}
              >
                Отмена
              </button>

              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSavePhone}
                disabled={phoneMutation.isPending}
              >
                {phoneMutation.isPending ? 'Сохраняем...' : 'Сохранить телефон'}
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
              <div className="profile-message profile-message--success">{passwordSuccess}</div>
            ) : null}

            {passwordError ? (
              <div className="profile-message profile-message--error">{passwordError}</div>
            ) : null}

            <div className="profile-form-grid profile-form-grid--password">
              <label className="profile-field">
                <span className="profile-field__label">Текущий пароль</span>

                <input
                  type="password"
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value)
                    setPasswordError('')
                  }}
                  placeholder="Введите текущий пароль"
                />
              </label>

              <label className="profile-field">
                <span className="profile-field__label">Новый пароль</span>

                <input
                  type="password"
                  value={newPassword}
                  onChange={(event) => {
                    const value = event.target.value

                    setNewPassword(value)
                    setPasswordWarnings(value ? validatePasswordValue(value) : [])
                    setPasswordError('')
                  }}
                  placeholder="Aa123456!"
                />

                <PasswordErrors errors={passwordWarnings} />
              </label>

              <label className="profile-field profile-field--full">
                <span className="profile-field__label">Подтверждение нового пароля</span>

                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(event) => {
                    setConfirmNewPassword(event.target.value)
                    setPasswordError('')
                  }}
                  placeholder="Повторите новый пароль"
                />
              </label>
            </div>

            <div className="profile-modal__footer">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setIsPasswordModalOpen(false)}
              >
                Отмена
              </button>

              <button
                type="button"
                className="btn btn--primary"
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