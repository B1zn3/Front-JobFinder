import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './create-resume.css'

type ApplicantProfile = {
  id: number
  first_name?: string | null
  last_name?: string | null
  middle_name?: string | null
  gender?: string | null
  phone?: string | null
  birth_date?: string | null
  city?: {
    id: number
    name: string
  } | null
}

type ProfessionItem = {
  id: number
  name: string
}

type CityItem = {
  id: number
  name: string
}

type SkillItem = {
  id: number
  name: string
}

type EducationInstitutionItem = {
  id: number
  name: string
}

type ResumeResponse = {
  id: number
  profession_id?: number | null
  profession?: {
    id: number
    name: string
  } | null
  created_at?: string | null
  updated_at?: string | null
}

type EducationDraft = {
  localId: string
  institution_id?: number
  institution_name: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
}

type WorkExperienceDraft = {
  localId: string
  company_name: string
  position: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
  is_current: boolean
  description: string
}

type StepKey = 'profession' | 'profile' | 'education' | 'skills' | 'experience'

type ComboOption = {
  value: string | number
  label: string
}

const STEPS: StepKey[] = ['profession', 'profile', 'education', 'skills', 'experience']

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

const yearOptions: ComboOption[] = Array.from({ length: 60 }, (_, index) => {
  const year = String(new Date().getFullYear() - index)
  return { value: year, label: year }
})

const makeLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

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
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

const buildMonthYearDate = (month: string, year: string) => {
  if (!month || !year) return null
  return `${year}-${month}-01`
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile | null> => {
  const { data } = await http.get('/applicants/me')
  return data || null
}

const fetchCatalog = async <T,>(catalogName: string): Promise<T[]> => {
  const { data } = await http.get(`/public/catalogs/${catalogName}`, {
    params: { skip: 0, limit: 100 },
  })
  return Array.isArray(data) ? data : []
}

const fetchProfessions = async (): Promise<ProfessionItem[]> => {
  const { data } = await http.get('/public/professions', {
    params: { skip: 0, limit: 100 },
  })
  return Array.isArray(data) ? data : []
}

const updateApplicantProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/applicants/me', payload)
  return data
}

const createResume = async (payload: Record<string, unknown>): Promise<ResumeResponse> => {
  const { data } = await http.post('/applicants/me/resumes', payload)
  return data
}

const addEducation = async (payload: Record<string, unknown>) => {
  const { data } = await http.post('/applicants/me/education', payload)
  return data
}

const addSkillsBatch = async (resumeId: number, payload: { skills: string[] }) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/skills/batch`, payload)
  return data
}

const addWorkExperience = async (resumeId: number, payload: Record<string, unknown>) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/work-experiences`, payload)
  return data
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    className={`combo-field__chevron ${open ? 'is-open' : ''}`}
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

type SearchComboProps = {
  value: string
  placeholder: string
  isOpen: boolean
  options: ComboOption[]
  activeValue?: string | number | null
  emptyText?: string
  onFocus: () => void
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
  onChange,
  onSelect,
}: SearchComboProps) => {
  return (
    <div className={`combo ${isOpen ? 'is-open' : ''}`}>
      <input
        className={`combo-input ${isOpen ? 'is-open' : ''}`}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
      />

      {isOpen && (
        <div className="combo__dropdown">
          {options.length > 0 ? (
            options.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={`combo__option ${activeValue === option.value ? 'is-active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="combo__empty">{emptyText}</div>
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
  disabled?: boolean
  onToggle: () => void
  onSelect: (option: ComboOption) => void
}

const SelectCombo = ({
  value,
  placeholder,
  isOpen,
  options,
  disabled = false,
  onToggle,
  onSelect,
}: SelectComboProps) => {
  return (
    <div className={`combo ${disabled ? 'is-disabled' : ''} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`combo-field ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        disabled={disabled}
      >
        <span className={value ? 'combo-field__value' : 'combo-field__placeholder'}>
          {value || placeholder}
        </span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && !disabled && (
        <div className="combo__dropdown">
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              className={`combo__option ${value === option.label ? 'is-active' : ''}`}
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

export const CreateResumePage = () => {
  const navigate = useNavigate()

  const [currentStep, setCurrentStep] = useState(0)
  const [createdResumeId, setCreatedResumeId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')
  const [openCombo, setOpenCombo] = useState<string | null>(null)
  const [profileInitialized, setProfileInitialized] = useState(false)

  const [professionSearch, setProfessionSearch] = useState('')
  const [selectedProfessionId, setSelectedProfessionId] = useState<number | null>(null)
  const [selectedProfessionName, setSelectedProfessionName] = useState('')

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [gender, setGender] = useState<'Мужской' | 'Женский' | ''>('')

  const [cityId, setCityId] = useState<number | null>(null)
  const [citySearch, setCitySearch] = useState('')

  const [phone, setPhone] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [educations, setEducations] = useState<EducationDraft[]>([
    {
      localId: makeLocalId(),
      institution_name: '',
      start_month: '',
      start_year: '',
      end_month: '',
      end_year: '',
    },
  ])

  const [skillSearch, setSkillSearch] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<SkillItem[]>([])

  const [experiences, setExperiences] = useState<WorkExperienceDraft[]>([
    {
      localId: makeLocalId(),
      company_name: '',
      position: '',
      start_month: '',
      start_year: '',
      end_month: '',
      end_year: '',
      is_current: false,
      description: '',
    },
  ])

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.combo')) {
        setOpenCombo(null)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    return () => document.removeEventListener('click', handleDocumentClick)
  }, [])

  const profileQuery = useQuery({
    queryKey: ['applicant-profile', 'create-resume'],
    queryFn: fetchApplicantProfile,
  })

  const professionsQuery = useQuery({
    queryKey: ['public-professions', 'create-resume'],
    queryFn: fetchProfessions,
  })

  const citiesQuery = useQuery({
    queryKey: ['public-cities', 'create-resume'],
    queryFn: () => fetchCatalog<CityItem>('cities'),
  })

  const skillsQuery = useQuery({
    queryKey: ['public-skills', 'create-resume'],
    queryFn: () => fetchCatalog<SkillItem>('skills'),
  })

  const educationInstitutionsQuery = useQuery({
    queryKey: ['public-education-institutions', 'create-resume'],
    queryFn: () => fetchCatalog<EducationInstitutionItem>('educational-institutions'),
  })

  useEffect(() => {
    const profile = profileQuery.data
    if (!profile || profileInitialized) return

    const birth = formatBirthDateParts(profile.birth_date)

    setLastName(profile.last_name || '')
    setFirstName(profile.first_name || '')
    setMiddleName(profile.middle_name || '')
    setPhone(profile.phone || '')
    setBirthDay(birth.day)
    setBirthMonth(birth.month)
    setBirthYear(birth.year)

    if (profile.gender === 'м' || profile.gender === 'Мужской') {
      setGender('Мужской')
    } else if (profile.gender === 'ж' || profile.gender === 'Женский') {
      setGender('Женский')
    }

    setCityId(profile.city?.id ?? null)
    setCitySearch(profile.city?.name || '')
    setProfileInitialized(true)
  }, [profileQuery.data, profileInitialized])

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
  })

  const createResumeMutation = useMutation({
    mutationFn: createResume,
  })

  const addEducationMutation = useMutation({
    mutationFn: addEducation,
  })

  const addSkillsBatchMutation = useMutation({
    mutationFn: ({
      resumeId,
      payload,
    }: {
      resumeId: number
      payload: { skills: string[] }
    }) => addSkillsBatch(resumeId, payload),
  })

  const addWorkExperienceMutation = useMutation({
    mutationFn: ({
      resumeId,
      payload,
    }: {
      resumeId: number
      payload: Record<string, unknown>
    }) => addWorkExperience(resumeId, payload),
  })

  const professions = professionsQuery.data || []
  const cities = citiesQuery.data || []
  const skills = skillsQuery.data || []
  const educationInstitutions = educationInstitutionsQuery.data || []

  const filteredProfessions: ComboOption[] = useMemo(() => {
    const value = professionSearch.trim().toLowerCase()
    const base = value
      ? professions.filter((item) => item.name.toLowerCase().includes(value))
      : professions

    return base.slice(0, 20).map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [professionSearch, professions])

  const filteredCities: ComboOption[] = useMemo(() => {
    const value = citySearch.trim().toLowerCase()
    const base = value
      ? cities.filter((item) => item.name.toLowerCase().includes(value))
      : cities

    return base.slice(0, 20).map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [citySearch, cities])

  const filteredSkills: ComboOption[] = useMemo(() => {
    const value = skillSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const base = value
      ? skills.filter((item) => item.name.toLowerCase().includes(value))
      : skills

    return base
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 25)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
  }, [skillSearch, skills, selectedSkills])

  const selectedCityName = useMemo(() => citySearch.trim(), [citySearch])
  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100)

  const validateProfessionStep = () => {
    if (!selectedProfessionId) {
      return 'Выберите профессию.'
    }
    return ''
  }

  const validateProfileStep = () => {
    if (!lastName.trim()) return 'Укажите фамилию.'
    if (!firstName.trim()) return 'Укажите имя.'
    if (!gender) return 'Укажите пол.'
    if (!selectedCityName.trim()) return 'Укажите город проживания.'
    if (!phone.trim()) return 'Укажите номер телефона.'

    const day = Number(birthDay)
    const year = Number(birthYear)

    if (!birthDay || !birthMonth || !birthYear) {
      return 'Укажите дату рождения.'
    }

    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return 'Некорректный день рождения.'
    }

    if (!Number.isInteger(year) || year < 1950 || year > new Date().getFullYear()) {
      return 'Некорректный год рождения.'
    }

    return ''
  }

  const validateEducationStep = () => {
    const hasAnyFilled = educations.some(
      (item) =>
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year
    )

    if (!hasAnyFilled) return ''

    for (const item of educations) {
      const touched =
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year

      if (!touched) continue

      if (!item.institution_id) {
        return 'Выберите учебное заведение из списка.'
      }

      if (!item.start_month || !item.start_year) {
        return 'Укажите дату начала обучения.'
      }

      if (!item.end_month || !item.end_year) {
        return 'Укажите дату окончания обучения.'
      }

      const start = Number(`${item.start_year}${item.start_month}`)
      const end = Number(`${item.end_year}${item.end_month}`)

      if (start > end) {
        return 'Дата окончания обучения не может быть раньше даты начала.'
      }
    }

    return ''
  }

  const validateSkillsStep = () => {
    if (selectedSkills.length === 0) {
      return 'Добавьте хотя бы один навык.'
    }
    return ''
  }

  const validateExperienceStep = () => {
    const hasAnyFilled = experiences.some(
      (item) =>
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim()
    )

    if (!hasAnyFilled) return ''

    for (const item of experiences) {
      const touched =
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim()

      if (!touched) continue

      if (!item.company_name.trim()) {
        return 'Укажите компанию в опыте работы.'
      }

      if (!item.position.trim()) {
        return 'Укажите должность или профессию в опыте работы.'
      }

      if (!item.start_month || !item.start_year) {
        return 'Укажите дату начала работы.'
      }

      if (!item.is_current && (!item.end_month || !item.end_year)) {
        return 'Укажите дату окончания работы или отметьте "Работаю сейчас".'
      }

      if (!item.description.trim()) {
        return 'Укажите обязанности и достижения.'
      }

      if (item.description.trim().length < 10) {
        return 'Описание опыта работы слишком короткое.'
      }

      if (!item.is_current) {
        const start = Number(`${item.start_year}${item.start_month}`)
        const end = Number(`${item.end_year}${item.end_month}`)

        if (start > end) {
          return 'Дата окончания работы не может быть раньше даты начала.'
        }
      }
    }

    return ''
  }

  const goBack = () => {
    if (currentStep === 0) {
      navigate('/applicant')
      return
    }

    setSaveError('')
    setCurrentStep((prev) => prev - 1)
  }

  const goNext = async () => {
    setSaveError('')

    try {
      if (STEPS[currentStep] === 'profession') {
        const error = validateProfessionStep()
        if (error) {
          setSaveError(error)
          return
        }

        if (!createdResumeId) {
          const created = await createResumeMutation.mutateAsync({
            profession_id: selectedProfessionId,
          })
          setCreatedResumeId(created.id)
        }

        setCurrentStep((prev) => prev + 1)
        return
      }

      if (STEPS[currentStep] === 'profile') {
        const error = validateProfileStep()
        if (error) {
          setSaveError(error)
          return
        }

        await profileMutation.mutateAsync({
          last_name: lastName.trim(),
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          gender: gender === 'Мужской' ? 'м' : 'ж',
          city_name: selectedCityName.trim(),
          phone: phone.trim(),
          birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
        })

        setCurrentStep((prev) => prev + 1)
        return
      }

      if (STEPS[currentStep] === 'education') {
        const error = validateEducationStep()
        if (error) {
          setSaveError(error)
          return
        }

        const validEducations = educations.filter(
          (item) =>
            item.institution_id &&
            item.start_month &&
            item.start_year &&
            item.end_month &&
            item.end_year
        )

        for (const education of validEducations) {
          await addEducationMutation.mutateAsync({
            institution_id: education.institution_id,
            start_date: buildMonthYearDate(education.start_month, education.start_year),
            end_date: buildMonthYearDate(education.end_month, education.end_year),
          })
        }

        setCurrentStep((prev) => prev + 1)
        return
      }

      if (STEPS[currentStep] === 'skills') {
        const error = validateSkillsStep()
        if (error) {
          setSaveError(error)
          return
        }

        if (!createdResumeId) {
          setSaveError('Сначала нужно создать резюме.')
          return
        }

        await addSkillsBatchMutation.mutateAsync({
          resumeId: createdResumeId,
          payload: {
            skills: selectedSkills.map((item) => item.name),
          },
        })

        setCurrentStep((prev) => prev + 1)
        return
      }

      if (STEPS[currentStep] === 'experience') {
        const error = validateExperienceStep()
        if (error) {
          setSaveError(error)
          return
        }

        if (!createdResumeId) {
          setSaveError('Сначала нужно создать резюме.')
          return
        }

        const validExperiences = experiences.filter(
          (item) =>
            item.company_name.trim() &&
            item.position.trim() &&
            item.start_month &&
            item.start_year &&
            item.description.trim()
        )

        for (const experience of validExperiences) {
          await addWorkExperienceMutation.mutateAsync({
            resumeId: createdResumeId,
            payload: {
              resume_id: createdResumeId,
              company_name: experience.company_name.trim(),
              position: experience.position.trim(),
              start_date: buildMonthYearDate(experience.start_month, experience.start_year),
              end_date: experience.is_current
                ? null
                : buildMonthYearDate(experience.end_month, experience.end_year),
              description: experience.description.trim(),
            },
          })
        }

        navigate(`/applicant/resume/${createdResumeId}`)
      }
    } catch {
      setSaveError('Не удалось сохранить данные. Проверьте соответствие payload вашему backend.')
    }
  }

  const addEducationRow = () => {
    setEducations((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        institution_name: '',
        start_month: '',
        start_year: '',
        end_month: '',
        end_year: '',
      },
    ])
  }

  const removeEducationRow = (localId: string) => {
    setEducations((prev) => prev.filter((item) => item.localId !== localId))
  }

  const updateEducationRow = (localId: string, patch: Partial<EducationDraft>) => {
    setEducations((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    )
  }

  const addExperienceRow = () => {
    setExperiences((prev) => [
      ...prev,
      {
        localId: makeLocalId(),
        company_name: '',
        position: '',
        start_month: '',
        start_year: '',
        end_month: '',
        end_year: '',
        is_current: false,
        description: '',
      },
    ])
  }

  const removeExperienceRow = (localId: string) => {
    setExperiences((prev) => prev.filter((item) => item.localId !== localId))
  }

  const updateExperienceRow = (localId: string, patch: Partial<WorkExperienceDraft>) => {
    setExperiences((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item))
    )
  }

  const addSkill = (skillId: number) => {
    const skill = skills.find((item) => item.id === skillId)
    if (!skill) return

    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev
      return [...prev, skill]
    })

    setSkillSearch('')
    setOpenCombo(null)
  }

  const removeSkill = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId))
  }

  return (
    <div className="create-resume-page">
      <Header />

      <main className="create-resume-page__main">
        <div className="container create-resume-page__container">
          <section className="create-resume-card">
            <div className="create-resume-card__progress-label">
              Шаг {currentStep + 1} из {STEPS.length} · {progressPercent}%
            </div>

            {STEPS[currentStep] === 'profession' && (
              <>
                <h1 className="create-resume-card__title">Выберите или укажите профессию</h1>

                <SearchCombo
                  value={professionSearch}
                  placeholder="Поиск профессии"
                  isOpen={openCombo === 'profession'}
                  options={filteredProfessions}
                  activeValue={selectedProfessionId}
                  onFocus={() => setOpenCombo('profession')}
                  onChange={(value) => {
                    setProfessionSearch(value)
                    setSelectedProfessionId(null)
                    setSelectedProfessionName('')
                    setOpenCombo('profession')
                  }}
                  onSelect={(option) => {
                    setSelectedProfessionId(Number(option.value))
                    setSelectedProfessionName(option.label)
                    setProfessionSearch(option.label)
                    setOpenCombo(null)
                  }}
                />

                {selectedProfessionName && (
                  <div className="picked-value">Выбрано: {selectedProfessionName}</div>
                )}
              </>
            )}

            {STEPS[currentStep] === 'profile' && (
              <>
                <h1 className="create-resume-card__title">Заполните основную информацию</h1>

                <div className="form-grid">
                  <label className="field">
                    <span>Фамилия</span>
                    <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </label>

                  <label className="field">
                    <span>Имя</span>
                    <input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </label>

                  <label className="field">
                    <span>Отчество</span>
                    <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
                  </label>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Пол</span>

                  <div className="segmented">
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

                <div className="section-block">
                  <span className="section-block__label">Контактная информация</span>

                  <div className="form-grid">
                    <label className="field">
                      <span>Город проживания</span>

                      <SearchCombo
                        value={citySearch}
                        placeholder="Выберите город"
                        isOpen={openCombo === 'city'}
                        options={filteredCities}
                        activeValue={cityId}
                        onFocus={() => setOpenCombo('city')}
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
                      />
                    </label>

                    <label className="field">
                      <span>Номер телефона</span>
                      <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                    </label>
                  </div>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Дата рождения</span>

                  <div className="date-grid date-grid--three">
                    <label className="field">
                      <span>День</span>
                      <input value={birthDay} onChange={(e) => setBirthDay(e.target.value)} />
                    </label>

                    <label className="field">
                      <span>Месяц</span>
                      <SelectCombo
                        value={monthOptions.find((item) => item.value === birthMonth)?.label || ''}
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
                    </label>

                    <label className="field">
                      <span>Год</span>
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
                    </label>
                  </div>
                </div>
              </>
            )}

            {STEPS[currentStep] === 'education' && (
              <>
                <h1 className="create-resume-card__title">
                  Какое учебное заведение включить в резюме?
                </h1>

                {educations.map((education, index) => {
                  const educationSearch = education.institution_name.trim().toLowerCase()

                  const educationOptions: ComboOption[] = (
                    educationSearch
                      ? educationInstitutions.filter((item) =>
                          item.name.toLowerCase().includes(educationSearch)
                        )
                      : educationInstitutions
                  )
                    .slice(0, 20)
                    .map((item) => ({
                      value: item.id,
                      label: item.name,
                    }))

                  const startMonthLabel =
                    monthOptions.find((item) => item.value === education.start_month)?.label || ''

                  const endMonthLabel =
                    monthOptions.find((item) => item.value === education.end_month)?.label || ''

                  return (
                    <div key={education.localId} className="education-card">
                      <div className="education-card__head">
                        <h3>Образование {index + 1}</h3>

                        {educations.length > 1 && (
                          <button
                            type="button"
                            className="link-danger"
                            onClick={() => removeEducationRow(education.localId)}
                          >
                            Удалить
                          </button>
                        )}
                      </div>

                      <label className="field">
                        <span>Учебное заведение</span>

                        <SearchCombo
                          value={education.institution_name}
                          placeholder="Поиск учебного заведения"
                          isOpen={openCombo === `education-${education.localId}`}
                          options={educationOptions}
                          activeValue={education.institution_id}
                          onFocus={() => setOpenCombo(`education-${education.localId}`)}
                          onChange={(value) => {
                            updateEducationRow(education.localId, {
                              institution_name: value,
                              institution_id: undefined,
                            })
                            setOpenCombo(`education-${education.localId}`)
                          }}
                          onSelect={(option) => {
                            updateEducationRow(education.localId, {
                              institution_id: Number(option.value),
                              institution_name: option.label,
                            })
                            setOpenCombo(null)
                          }}
                        />
                      </label>

                      <div className="education-card__dates">
                        <div className="education-card__date-group">
                          <span className="section-block__label">Дата начала</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>
                              <SelectCombo
                                value={startMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `education-start-month-${education.localId}`}
                                options={monthOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-start-month-${education.localId}`
                                      ? null
                                      : `education-start-month-${education.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    start_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>
                              <SelectCombo
                                value={education.start_year}
                                placeholder="Год"
                                isOpen={openCombo === `education-start-year-${education.localId}`}
                                options={yearOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-start-year-${education.localId}`
                                      ? null
                                      : `education-start-year-${education.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    start_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="education-card__date-group">
                          <span className="section-block__label">Дата окончания</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>
                              <SelectCombo
                                value={endMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `education-end-month-${education.localId}`}
                                options={monthOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-end-month-${education.localId}`
                                      ? null
                                      : `education-end-month-${education.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    end_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>
                              <SelectCombo
                                value={education.end_year}
                                placeholder="Год"
                                isOpen={openCombo === `education-end-year-${education.localId}`}
                                options={yearOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `education-end-year-${education.localId}`
                                      ? null
                                      : `education-end-year-${education.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateEducationRow(education.localId, {
                                    end_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}

                <button type="button" className="ghost-add-btn" onClick={addEducationRow}>
                  Добавить ещё образование
                </button>
              </>
            )}

            {STEPS[currentStep] === 'skills' && (
              <>
                <h1 className="create-resume-card__title">Какими навыками владеете?</h1>

                <label className="field">
                  <span>Навыки</span>

                  <SearchCombo
                    value={skillSearch}
                    placeholder="Поиск навыков"
                    isOpen={openCombo === 'skills'}
                    options={filteredSkills}
                    onFocus={() => setOpenCombo('skills')}
                    onChange={(value) => {
                      setSkillSearch(value)
                      setOpenCombo('skills')
                    }}
                    onSelect={(option) => addSkill(Number(option.value))}
                    emptyText="Навыки не найдены"
                  />
                </label>

                {selectedSkills.length > 0 && (
                  <div className="chip-list chip-list--selected">
                    {selectedSkills.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="chip chip--selected"
                        onClick={() => removeSkill(item.id)}
                      >
                        {item.name} ×
                      </button>
                    ))}
                  </div>
                )}

                <div className="section-block">
                  <span className="section-block__label">Рекомендованные навыки</span>

                  <div className="chip-list">
                    {filteredSkills.map((item) => (
                      <button
                        key={String(item.value)}
                        type="button"
                        className="chip"
                        onClick={() => addSkill(Number(item.value))}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {STEPS[currentStep] === 'experience' && (
              <>
                <h1 className="create-resume-card__title">Расскажите об опыте работы</h1>

                {experiences.map((experience, index) => {
                  const startMonthLabel =
                    monthOptions.find((item) => item.value === experience.start_month)?.label || ''

                  const endMonthLabel =
                    monthOptions.find((item) => item.value === experience.end_month)?.label || ''

                  return (
                    <div key={experience.localId} className="experience-card">
                      <div className="experience-card__head">
                        <h3>Опыт работы {index + 1}</h3>

                        {experiences.length > 1 && (
                          <button
                            type="button"
                            className="link-danger"
                            onClick={() => removeExperienceRow(experience.localId)}
                          >
                            Удалить
                          </button>
                        )}
                      </div>

                      <label className="field">
                        <span>Компания</span>
                        <input
                          placeholder="Компания"
                          value={experience.company_name}
                          onChange={(e) =>
                            updateExperienceRow(experience.localId, {
                              company_name: e.target.value,
                            })
                          }
                        />
                      </label>

                      <label className="field">
                        <span>Должность или профессия</span>
                        <input
                          placeholder="Должность или профессия"
                          value={experience.position}
                          onChange={(e) =>
                            updateExperienceRow(experience.localId, {
                              position: e.target.value,
                            })
                          }
                        />
                      </label>

                      <div className="experience-card__dates">
                        <div className="experience-card__date-group">
                          <span className="section-block__label">Начало работы</span>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>
                              <SelectCombo
                                value={startMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `exp-start-month-${experience.localId}`}
                                options={monthOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `exp-start-month-${experience.localId}`
                                      ? null
                                      : `exp-start-month-${experience.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    start_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>
                              <SelectCombo
                                value={experience.start_year}
                                placeholder="Год"
                                isOpen={openCombo === `exp-start-year-${experience.localId}`}
                                options={yearOptions}
                                onToggle={() =>
                                  setOpenCombo((prev) =>
                                    prev === `exp-start-year-${experience.localId}`
                                      ? null
                                      : `exp-start-year-${experience.localId}`
                                  )
                                }
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    start_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>
                          </div>
                        </div>

                        <div className="experience-card__date-group">
                          <div className="experience-card__end-head">
                            <span className="section-block__label">Окончание</span>

                            <label className="checkbox-inline">
                              <input
                                type="checkbox"
                                checked={experience.is_current}
                                onChange={(e) =>
                                  updateExperienceRow(experience.localId, {
                                    is_current: e.target.checked,
                                    end_month: e.target.checked ? '' : experience.end_month,
                                    end_year: e.target.checked ? '' : experience.end_year,
                                  })
                                }
                              />
                              <span>Работаю сейчас</span>
                            </label>
                          </div>

                          <div className="date-grid date-grid--two">
                            <label className="field">
                              <span>Месяц</span>
                              <SelectCombo
                                value={endMonthLabel}
                                placeholder="Месяц"
                                isOpen={openCombo === `exp-end-month-${experience.localId}`}
                                options={monthOptions}
                                disabled={experience.is_current}
                                onToggle={() => {
                                  if (experience.is_current) return
                                  setOpenCombo((prev) =>
                                    prev === `exp-end-month-${experience.localId}`
                                      ? null
                                      : `exp-end-month-${experience.localId}`
                                  )
                                }}
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    end_month: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>

                            <label className="field">
                              <span>Год</span>
                              <SelectCombo
                                value={experience.end_year}
                                placeholder="Год"
                                isOpen={openCombo === `exp-end-year-${experience.localId}`}
                                options={yearOptions}
                                disabled={experience.is_current}
                                onToggle={() => {
                                  if (experience.is_current) return
                                  setOpenCombo((prev) =>
                                    prev === `exp-end-year-${experience.localId}`
                                      ? null
                                      : `exp-end-year-${experience.localId}`
                                  )
                                }}
                                onSelect={(option) => {
                                  updateExperienceRow(experience.localId, {
                                    end_year: String(option.value),
                                  })
                                  setOpenCombo(null)
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <label className="field">
                        <span>Обязанности и достижения</span>
                        <textarea
                          placeholder="Чем занимались?"
                          value={experience.description}
                          onChange={(e) =>
                            updateExperienceRow(experience.localId, {
                              description: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>
                  )
                })}

                <button type="button" className="ghost-add-btn" onClick={addExperienceRow}>
                  Добавить опыт работы
                </button>
              </>
            )}

            {saveError && <div className="form-error">{saveError}</div>}
          </section>
        </div>
      </main>

      <div className="resume-stepper-footer">
        <div className="resume-stepper-footer__inner">
          <div className="resume-stepper-footer__progress">
            {STEPS.map((step, index) => (
              <span key={step} className={index <= currentStep ? 'is-active' : ''} />
            ))}
          </div>

          <div className="resume-stepper-footer__actions">
            <button type="button" className="btn btn--outline" onClick={goBack}>
              Назад
            </button>

            <button
              type="button"
              className="btn btn--primary"
              onClick={goNext}
              disabled={
                profileMutation.isPending ||
                createResumeMutation.isPending ||
                addEducationMutation.isPending ||
                addSkillsBatchMutation.isPending ||
                addWorkExperienceMutation.isPending
              }
            >
              {currentStep === STEPS.length - 1
                ? 'Сохранить и завершить'
                : 'Сохранить и продолжить'}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
