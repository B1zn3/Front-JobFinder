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

const dayOptions: ComboOption[] = Array.from({ length: 31 }, (_, index) => {
  const day = String(index + 1).padStart(2, '0')
  return { value: day, label: day }
})

const yearOptions: ComboOption[] = Array.from({ length: 70 }, (_, index) => {
  const year = String(new Date().getFullYear() - index)
  return { value: year, label: year }
})

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i
const phoneRegex = /^\+?[1-9]\d{8,14}$/
const passwordRegex = /^(?=.*[A-Za-zА-Яа-я])(?=.*\d)[^\s]{8,}$/

const normalizePhoneForValidation = (value: string) =>
  value.replace(/[()\-\s]/g, '').trim()

const validateEmailValue = (value: string) => {
  const normalized = value.trim()

  if (!normalized) {
    return 'Введите email.'
  }

  if (!emailRegex.test(normalized)) {
    return 'Некорректный email.'
  }

  return ''
}

const validatePhoneValue = (value: string) => {
  const normalized = normalizePhoneForValidation(value)

  if (!normalized) {
    return 'Введите телефон.'
  }

  if (!phoneRegex.test(normalized)) {
    return 'Некорректный телефон.'
  }

  return ''
}

const validatePasswordValue = (value: string) => {
  if (!value) {
    return 'Введите новый пароль.'
  }

  if (!passwordRegex.test(value)) {
    return 'Пароль должен быть от 8 символов, содержать буквы и цифры, без пробелов.'
  }

  return ''
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

const formatBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) {
    return { day: '', month: '', year: '' }
  }

  const date = new Date(birthDate)
  if (Number.isNaN(date.getTime())) {
    return { day: '', month: '', year: '' }
  }

  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
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

type SearchComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: string | number | null
  emptyText?: string
  onFocus: () => void
  onBlur?: () => void
  onChange: (value: string) => void
  onSelect: (option: ComboOption) => void
}

const SearchCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  activeValue,
  emptyText = 'Ничего не найдено',
  onFocus,
  onBlur,
  onChange,
  onSelect,
}: SearchComboProps) => {
  return (
    <div className={`profile-combo ${isOpen ? 'is-open' : ''}`}>
      <input
        className={`profile-combo-input ${isOpen ? 'is-open' : ''}`}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={onFocus}
        onBlur={onBlur}
        onChange={(e) => onChange(e.target.value)}
      />

      {isOpen && (
        <div className="profile-combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`profile-combo__option ${
                  activeValue === option.value ? 'is-active' : ''
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="profile-combo__empty">{emptyText}</div>
          )}
        </div>
      )}
    </div>
  )
}

type SelectComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  onToggle: () => void
  onSelect: (option: ComboOption) => void
}

const SelectCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`profile-combo ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`profile-combo-field ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
      >
        <span className={value ? 'profile-combo-field__value' : 'profile-combo-field__placeholder'}>
          {value || placeholder}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div className="profile-combo__dropdown">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`profile-combo__option ${value === option.label ? 'is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type ModalProps = {
  title: string
  subtitle: string
  onClose: () => void
  children: ReactNode
}

const SecurityModal = ({ title, subtitle, onClose, children }: ModalProps) => (
  <div className="profile-modal-overlay" onClick={onClose}>
    <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
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

export const ApplicantProfilePage = () => {
  const navigate = useNavigate()

  const [openCombo, setOpenCombo] = useState<string | null>(null)

  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')

  const [emailSuccess, setEmailSuccess] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneSuccess, setPhoneSuccess] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const [emailWarning, setEmailWarning] = useState('')
  const [phoneWarning, setPhoneWarning] = useState('')
  const [passwordWarning, setPasswordWarning] = useState('')

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [gender, setGender] = useState<'Мужской' | 'Женский' | ''>('')
  const [cityId, setCityId] = useState<number | null>(null)
  const [citySearch, setCitySearch] = useState('')
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
      if (event.key === 'Escape') {
        setIsEmailModalOpen(false)
        setIsPhoneModalOpen(false)
        setIsPasswordModalOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

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
    const profile = profileQuery.data
    if (!profile) return

    const birth = formatBirthDateParts(profile.birth_date)

    setFirstName(profile.first_name || '')
    setLastName(profile.last_name || '')
    setMiddleName(profile.middle_name || '')
    setGender(normalizeGender(profile.gender))
    setCityId(profile.city?.id ?? null)
    setCitySearch(profile.city?.name || '')
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

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
    onSuccess: () => {
      setProfileSuccess('Профиль успешно сохранён.')
      setProfileError('')
      void profileQuery.refetch()
    },
    onError: () => {
      setProfileSuccess('')
      setProfileError('Не удалось сохранить профиль.')
    },
  })

  const emailMutation = useMutation({
    mutationFn: async () =>
      updateSensitiveContacts({
        email: emailDraft.trim(),
        phone: phone || null,
        current_password: emailPassword,
      }),
    onSuccess: () => {
      setEmailSuccess('Email успешно обновлён.')
      setEmailError('')
      setEmailPassword('')
      setEmailWarning('')
      setIsEmailModalOpen(false)
      void authMeQuery.refetch()
    },
    onError: () => {
      setEmailSuccess('')
      setEmailError('Не удалось изменить email. Проверь текущий пароль.')
    },
  })

  const phoneMutation = useMutation({
    mutationFn: async () =>
      updateSensitiveContacts({
        email,
        phone: phoneDraft.trim() || null,
        current_password: phonePassword,
      }),
    onSuccess: () => {
      setPhoneSuccess('Телефон успешно обновлён.')
      setPhoneError('')
      setPhonePassword('')
      setPhoneWarning('')
      setIsPhoneModalOpen(false)
      void profileQuery.refetch()
    },
    onError: () => {
      setPhoneSuccess('')
      setPhoneError('Не удалось изменить телефон. Проверь текущий пароль.')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordSuccess('Пароль изменён. Выполняем выход из аккаунта.')
      setPasswordError('')
      setPasswordWarning('')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')

      setTimeout(() => {
        authSession.clear()
        navigate('/login', { replace: true })
      }, 1200)
    },
    onError: () => {
      setPasswordSuccess('')
      setPasswordError('Не удалось изменить пароль. Проверь текущий пароль.')
    },
  })

  const cities = citiesQuery.data || []

  const filteredCities: ComboOption[] = useMemo(() => {
    const value = citySearch.trim().toLowerCase()
    const base = value
      ? cities.filter((item) => item.name.toLowerCase().includes(value))
      : cities

    return base.slice(0, 20).map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [cities, citySearch])

  const selectedMonthLabel =
    monthOptions.find((item) => item.value === birthMonth)?.label || ''

  const initials = getInitials(firstName, lastName)

  const fullName =
    [lastName, firstName, middleName].filter(Boolean).join(' ') || 'Профиль соискателя'

  const handleSaveProfile = async () => {
    setProfileSuccess('')
    setProfileError('')

    const hasAnyBirthPart = birthDay || birthMonth || birthYear
    if (hasAnyBirthPart && (!birthDay || !birthMonth || !birthYear)) {
      setProfileError('Укажите дату рождения полностью.')
      return
    }

    if (citySearch.trim() && !cityId) {
      setProfileError('Выберите город только из списка.')
      return
    }

    await profileMutation.mutateAsync({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      middle_name: middleName.trim() || null,
      gender: gender === 'Мужской' ? 'м' : gender === 'Женский' ? 'ж' : null,
      birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
      city_id: cityId,
      city_name: cityId ? citySearch.trim() : null,
    })
  }

  const handleSaveEmail = async () => {
    setEmailSuccess('')
    setEmailError('')

    const warning = validateEmailValue(emailDraft)
    if (warning) {
      setEmailWarning(warning)
      return
    }

    setEmailWarning('')
    await emailMutation.mutateAsync()
  }

  const handleSavePhone = async () => {
    setPhoneSuccess('')
    setPhoneError('')

    const warning = validatePhoneValue(phoneDraft)
    if (warning) {
      setPhoneWarning(warning)
      return
    }

    setPhoneWarning('')
    await phoneMutation.mutateAsync()
  }

  const handleChangePassword = async () => {
    setPasswordSuccess('')
    setPasswordError('')

    const warning = validatePasswordValue(newPassword)
    if (warning) {
      setPasswordWarning(warning)
      return
    }

    setPasswordWarning('')

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

    await passwordMutation.mutateAsync({
      current_password: currentPassword,
      new_password: newPassword,
    })
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
                    <div className="profile-main-card__eyebrow">Основная информация</div>
                  </div>
                </div>

                {profileSuccess ? (
                  <div className="profile-message profile-message--success">{profileSuccess}</div>
                ) : null}
                {profileError ? (
                  <div className="profile-message profile-message--error">{profileError}</div>
                ) : null}

                <div className="profile-form-grid">
                  <label className="profile-field">
                    <span>Имя</span>
                    <input
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Введите имя"
                    />
                  </label>

                  <label className="profile-field">
                    <span>Фамилия</span>
                    <input
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Введите фамилию"
                    />
                  </label>

                  <label className="profile-field profile-field--full">
                    <span>Отчество</span>
                    <input
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="Введите отчество"
                    />
                  </label>
                </div>

                <div className="profile-form-grid">
                  <div className="profile-field profile-field--full">
                    <span>Пол</span>

                    <div className="profile-segmented">
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

                  <label className="profile-field profile-field--full">
                    <span>Город проживания</span>

                    <SearchCombo
                      value={citySearch}
                      placeholder="Выберите город"
                      isOpen={openCombo === 'city'}
                      options={filteredCities}
                      activeValue={cityId}
                      onFocus={() => setOpenCombo('city')}
                      onBlur={() => {
                        const matched = cities.find(
                          (item) => item.name.toLowerCase() === citySearch.trim().toLowerCase(),
                        )

                        if (!matched) {
                          setCityId(null)
                        }
                      }}
                      onChange={(value) => {
                        setCitySearch(value)
                        setCityId(null)
                        setOpenCombo('city')
                      }}
                      onSelect={(option) => {
                        setCityId(Number(option.value))
                        setCitySearch(option.label)
                        setOpenCombo(null)
                      }}
                      emptyText="Город не найден"
                    />
                  </label>
                </div>

                <div className="profile-field profile-field--full">
                  <span>Дата рождения</span>

                  <div className="profile-date-grid">
                    <SelectCombo
                      value={birthDay}
                      placeholder="День"
                      isOpen={openCombo === 'birthDay'}
                      options={dayOptions}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthDay' ? null : 'birthDay'))
                      }
                      onSelect={(option) => {
                        setBirthDay(String(option.value))
                        setOpenCombo(null)
                      }}
                    />

                    <SelectCombo
                      value={selectedMonthLabel}
                      placeholder="Месяц"
                      isOpen={openCombo === 'birthMonth'}
                      options={monthOptions}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthMonth' ? null : 'birthMonth'))
                      }
                      onSelect={(option) => {
                        setBirthMonth(String(option.value))
                        setOpenCombo(null)
                      }}
                    />

                    <SelectCombo
                      value={birthYear}
                      placeholder="Год"
                      isOpen={openCombo === 'birthYear'}
                      options={yearOptions}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'birthYear' ? null : 'birthYear'))
                      }
                      onSelect={(option) => {
                        setBirthYear(String(option.value))
                        setOpenCombo(null)
                      }}
                    />
                  </div>
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
                        setPasswordWarning('')
                        setCurrentPassword('')
                        setNewPassword('')
                        setConfirmNewPassword('')
                        setIsPasswordModalOpen(true)
                      }}
                    >
                      <EditIcon />
                    </button>
                  </div>
                </div>

                <div className="profile-main-card__footer">
                  <button
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
          <SecurityModal
            title="Изменение email"
            subtitle=""
            onClose={() => setIsEmailModalOpen(false)}
          >
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
                onChange={(e) => {
                  const value = e.target.value
                  setEmailDraft(value)
                  setEmailWarning(value ? validateEmailValue(value) : '')
                }}
                placeholder="Введите новый email"
              />
              {emailWarning ? <span className="profile-field__warning">{emailWarning}</span> : null}
            </label>

            <label className="profile-field">
              <span className="profile-field__label">Текущий пароль</span>
              <input
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
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
          <SecurityModal
            title="Изменение телефона"
            subtitle=""
            onClose={() => setIsPhoneModalOpen(false)}
          >
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
                onChange={(e) => {
                  const value = e.target.value
                  setPhoneDraft(value)
                  setPhoneWarning(value ? validatePhoneValue(value) : '')
                }}
                placeholder="+375..."
              />
              {phoneWarning ? <span className="profile-field__warning">{phoneWarning}</span> : null}
            </label>

            <label className="profile-field">
              <span className="profile-field__label">Текущий пароль</span>
              <input
                type="password"
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
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
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Введите текущий пароль"
                />
              </label>

              <label className="profile-field">
                <span className="profile-field__label">Новый пароль</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => {
                    const value = e.target.value
                    setNewPassword(value)
                    setPasswordWarning(value ? validatePasswordValue(value) : '')
                  }}
                  placeholder="Минимум 8 символов"
                />
                {passwordWarning ? (
                  <span className="profile-field__warning">{passwordWarning}</span>
                ) : null}
              </label>

              <label className="profile-field profile-field--full">
                <span className="profile-field__label">Подтверждение нового пароля</span>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
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