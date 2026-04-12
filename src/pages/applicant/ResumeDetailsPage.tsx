import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Header } from '../../shared/ui/Header'
import { Footer } from '../../shared/ui/Footer'
import { http } from '../../shared/api/http'
import './resume-details.css'

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
  educations?: EducationItem[]
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

type ResumeSkill = {
  id: number
  name: string
}

type WorkExperienceItem = {
  id: number
  resume_id: number
  company_name: string
  position: string
  start_date: string
  end_date?: string | null
  description?: string | null
}

type EducationItem = {
  id: number
  institution_id: number
  institution_name: string
  start_date: string
  end_date?: string | null
}

type ResumeResponse = {
  id: number
  applicant_id: number
  profession_id: number
  profession?: {
    id: number
    name: string
  } | null
  skills?: ResumeSkill[]
  work_experiences?: WorkExperienceItem[]
  created_at?: string | null
  updated_at?: string | null
}

type ComboOption = {
  value: string | number
  label: string
}

type NoticeState = {
  type: 'success' | 'error'
  text: string
} | null

type GenderValue = 'м' | 'ж' | ''

type EducationDraft = {
  localId: string
  id?: number
  institution_id?: number
  institution_name: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
}

type WorkExperienceDraft = {
  localId: string
  id?: number
  company_name: string
  position: string
  start_month: string
  start_year: string
  end_month: string
  end_year: string
  is_current: boolean
  description: string
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
  const value = String(index + 1).padStart(2, '0')
  return { value, label: String(index + 1) }
})

const yearOptions: ComboOption[] = Array.from({ length: 70 }, (_, index) => {
  const year = String(new Date().getFullYear() - index)
  return { value: year, label: year }
})

const genderOptions: ComboOption[] = [
  { value: 'м', label: 'Мужской' },
  { value: 'ж', label: 'Женский' },
]

const makeLocalId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const toArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? value : [])

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('ru-RU')
}

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data as
      | { detail?: string | { message?: string } | Array<{ msg?: string }> }
      | undefined

    if (typeof detail?.detail === 'string') return detail.detail
    if (Array.isArray(detail?.detail) && detail.detail[0]?.msg) return detail.detail[0].msg || fallback
    if (error.message) return error.message
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}

const parseBirthDateParts = (birthDate?: string | null) => {
  if (!birthDate) return { day: '', month: '', year: '' }

  const raw = String(birthDate).slice(0, 10)
  const [year, month, day] = raw.split('-')

  return {
    day: day || '',
    month: month || '',
    year: year || '',
  }
}

const buildBirthDate = (day: string, month: string, year: string) => {
  if (!day || !month || !year) return null
  return `${year}-${month}-${day}`
}

const parseMonthYear = (value?: string | null) => {
  if (!value) return { month: '', year: '' }

  const raw = String(value).slice(0, 10)
  const [year, month] = raw.split('-')

  return {
    year: year || '',
    month: month || '',
  }
}

const buildMonthYearDate = (month: string, year: string) => {
  if (!month || !year) return null
  return `${year}-${month}-01`
}

const fetchApplicantProfile = async (): Promise<ApplicantProfile> => {
  const { data } = await http.get('/applicants/me')
  return data
}

const fetchResume = async (resumeId: number): Promise<ResumeResponse> => {
  const { data } = await http.get(`/applicants/me/resumes/${resumeId}`)
  return data
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

const fetchEducationInstitutions = async (): Promise<EducationInstitutionItem[]> => {
  try {
    return await fetchCatalog<EducationInstitutionItem>('educational-institutions')
  } catch {
    return fetchCatalog<EducationInstitutionItem>('education_institutions')
  }
}

const updateApplicantProfile = async (payload: Record<string, unknown>) => {
  const { data } = await http.put('/applicants/me', payload)
  return data
}

const updateResume = async (resumeId: number, payload: { profession_id: number }) => {
  const { data } = await http.put(`/applicants/me/resumes/${resumeId}`, payload)
  return data
}

const deleteResume = async (resumeId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}`)
}

const addSkillsBatch = async (resumeId: number, payload: { skills: string[] }) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/skills/batch`, payload)
  return data
}

const removeSkill = async (resumeId: number, skillId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}/skills/${skillId}`)
}

const addEducation = async (payload: {
  institution_id: number
  start_date: string
  end_date: string | null
}) => {
  const { data } = await http.post('/applicants/me/education', payload)
  return data
}

const updateEducation = async (
  educationId: number,
  payload: {
    institution_id: number
    start_date: string
    end_date: string | null
  },
) => {
  const { data } = await http.put(`/applicants/me/education/${educationId}`, payload)
  return data
}

const deleteEducation = async (educationId: number) => {
  await http.delete(`/applicants/me/education/${educationId}`)
}

const addWorkExperience = async (
  resumeId: number,
  payload: {
    resume_id: number
    company_name: string
    position: string
    start_date: string
    end_date: string | null
    description: string | null
  },
) => {
  const { data } = await http.post(`/applicants/me/resumes/${resumeId}/work-experiences`, payload)
  return data
}

const updateWorkExperience = async (
  resumeId: number,
  experienceId: number,
  payload: {
    company_name: string
    position: string
    start_date: string
    end_date: string | null
    description: string | null
  },
) => {
  const { data } = await http.put(
    `/applicants/me/resumes/${resumeId}/work-experiences/${experienceId}`,
    payload,
  )
  return data
}

const deleteWorkExperience = async (resumeId: number, experienceId: number) => {
  await http.delete(`/applicants/me/resumes/${resumeId}/work-experiences/${experienceId}`)
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
              className={`combo__option ${
                value === option.label || value === String(option.value) ? 'is-active' : ''
              }`}
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

const createEducationDraft = (item?: EducationItem): EducationDraft => {
  const start = parseMonthYear(item?.start_date)
  const end = parseMonthYear(item?.end_date)

  return {
    localId: makeLocalId(),
    id: item?.id,
    institution_id: item?.institution_id,
    institution_name: item?.institution_name ?? '',
    start_month: start.month,
    start_year: start.year,
    end_month: end.month,
    end_year: end.year,
  }
}

const createExperienceDraft = (item?: WorkExperienceItem): WorkExperienceDraft => {
  const start = parseMonthYear(item?.start_date)
  const end = parseMonthYear(item?.end_date)

  return {
    localId: makeLocalId(),
    id: item?.id,
    company_name: item?.company_name ?? '',
    position: item?.position ?? '',
    start_month: start.month,
    start_year: start.year,
    end_month: end.month,
    end_year: end.year,
    is_current: !item?.end_date,
    description: item?.description ?? '',
  }
}

export const ResumeDetailsPage = () => {
  const { resumeId } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const numericResumeId = Number(resumeId)

  const [notice, setNotice] = useState<NoticeState>(null)
  const [openCombo, setOpenCombo] = useState<string | null>(null)

  const [professionSearch, setProfessionSearch] = useState('')
  const [selectedProfessionId, setSelectedProfessionId] = useState<number | null>(null)
  const [selectedProfessionName, setSelectedProfessionName] = useState('')

  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState<GenderValue>('')

  const [cityId, setCityId] = useState<number | null>(null)
  const [citySearch, setCitySearch] = useState('')

  const [birthDay, setBirthDay] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthYear, setBirthYear] = useState('')

  const [educations, setEducations] = useState<EducationDraft[]>([])
  const [selectedSkills, setSelectedSkills] = useState<SkillItem[]>([])
  const [skillSearch, setSkillSearch] = useState('')
  const [experiences, setExperiences] = useState<WorkExperienceDraft[]>([])

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

  const applicantQuery = useQuery({
    queryKey: ['applicant-profile', numericResumeId],
    queryFn: fetchApplicantProfile,
    enabled: Number.isFinite(numericResumeId) && numericResumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resumeQuery = useQuery({
    queryKey: ['applicant-resume', numericResumeId],
    queryFn: () => fetchResume(numericResumeId),
    enabled: Number.isFinite(numericResumeId) && numericResumeId > 0,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const professionsQuery = useQuery({
    queryKey: ['public-professions', 'resume-details'],
    queryFn: fetchProfessions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const citiesQuery = useQuery({
    queryKey: ['public-cities', 'resume-details'],
    queryFn: () => fetchCatalog<CityItem>('cities'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const skillsQuery = useQuery({
    queryKey: ['public-skills', 'resume-details'],
    queryFn: () => fetchCatalog<SkillItem>('skills'),
    retry: false,
    refetchOnWindowFocus: false,
  })

  const educationInstitutionsQuery = useQuery({
    queryKey: ['public-education-institutions', 'resume-details'],
    queryFn: fetchEducationInstitutions,
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    const profile = applicantQuery.data
    if (!profile) return

    const birth = parseBirthDateParts(profile.birth_date)

    setLastName(profile.last_name || '')
    setFirstName(profile.first_name || '')
    setMiddleName(profile.middle_name || '')
    setPhone(profile.phone || '')
    setBirthDay(birth.day)
    setBirthMonth(birth.month)
    setBirthYear(birth.year)

    if (profile.gender === 'ж' || profile.gender === 'Женский') {
      setGender('ж')
    } else if (profile.gender === 'м' || profile.gender === 'Мужской') {
      setGender('м')
    } else {
      setGender('')
    }

    setCityId(profile.city?.id ?? null)
    setCitySearch(profile.city?.name || '')
    setEducations(toArray<EducationItem>(profile.educations).map(createEducationDraft))
  }, [applicantQuery.data])

  useEffect(() => {
    const resume = resumeQuery.data
    if (!resume) return

    setSelectedProfessionId(resume.profession_id ?? null)
    setSelectedProfessionName(resume.profession?.name || '')
    setProfessionSearch(resume.profession?.name || '')
    setSelectedSkills(toArray<ResumeSkill>(resume.skills))
    setExperiences(toArray<WorkExperienceItem>(resume.work_experiences).map(createExperienceDraft))
  }, [resumeQuery.data])

  const professions = professionsQuery.data || []
  const cities = citiesQuery.data || []
  const skills = skillsQuery.data || []
  const educationInstitutions = educationInstitutionsQuery.data || []
  const currentResume = resumeQuery.data

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
    const base = value ? cities.filter((item) => item.name.toLowerCase().includes(value)) : cities

    return base.slice(0, 25).map((item) => ({
      value: item.id,
      label: item.name,
    }))
  }, [citySearch, cities])

  const filteredSkills: ComboOption[] = useMemo(() => {
    const value = skillSearch.trim().toLowerCase()
    const selectedIds = new Set(selectedSkills.map((item) => item.id))

    const base = value ? skills.filter((item) => item.name.toLowerCase().includes(value)) : skills

    return base
      .filter((item) => !selectedIds.has(item.id))
      .slice(0, 25)
      .map((item) => ({
        value: item.id,
        label: item.name,
      }))
  }, [skillSearch, skills, selectedSkills])

  const profileMutation = useMutation({
    mutationFn: updateApplicantProfile,
  })

  const resumeMutation = useMutation({
    mutationFn: (payload: { profession_id: number }) => updateResume(numericResumeId, payload),
  })

  const addSkillsBatchMutation = useMutation({
    mutationFn: (payload: { skills: string[] }) => addSkillsBatch(numericResumeId, payload),
  })

  const removeSkillMutation = useMutation({
    mutationFn: (skillId: number) => removeSkill(numericResumeId, skillId),
  })

  const addEducationMutation = useMutation({
    mutationFn: addEducation,
  })

  const updateEducationMutation = useMutation({
    mutationFn: ({
      educationId,
      payload,
    }: {
      educationId: number
      payload: {
        institution_id: number
        start_date: string
        end_date: string | null
      }
    }) => updateEducation(educationId, payload),
  })

  const deleteEducationMutation = useMutation({
    mutationFn: (educationId: number) => deleteEducation(educationId),
  })

  const addWorkExperienceMutation = useMutation({
    mutationFn: (payload: {
      resume_id: number
      company_name: string
      position: string
      start_date: string
      end_date: string | null
      description: string | null
    }) => addWorkExperience(numericResumeId, payload),
  })

  const updateWorkExperienceMutation = useMutation({
    mutationFn: ({
      experienceId,
      payload,
    }: {
      experienceId: number
      payload: {
        company_name: string
        position: string
        start_date: string
        end_date: string | null
        description: string | null
      }
    }) => updateWorkExperience(numericResumeId, experienceId, payload),
  })

  const deleteWorkExperienceMutation = useMutation({
    mutationFn: (experienceId: number) => deleteWorkExperience(numericResumeId, experienceId),
  })

  const deleteResumeMutation = useMutation({
    mutationFn: () => deleteResume(numericResumeId),
  })

  const setSuccess = (text: string) => setNotice({ type: 'success', text })
  const setError = (text: string) => setNotice({ type: 'error', text })

  const addEducationRow = () => {
    setEducations((prev) => [...prev, createEducationDraft()])
  }

  const updateEducationRow = (localId: string, patch: Partial<EducationDraft>) => {
    setEducations((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const removeEducationRowLocal = (localId: string) => {
    setEducations((prev) => prev.filter((item) => item.localId !== localId))
  }

  const addExperienceRow = () => {
    setExperiences((prev) => [...prev, createExperienceDraft()])
  }

  const updateExperienceRow = (localId: string, patch: Partial<WorkExperienceDraft>) => {
    setExperiences((prev) =>
      prev.map((item) => (item.localId === localId ? { ...item, ...patch } : item)),
    )
  }

  const removeExperienceRowLocal = (localId: string) => {
    setExperiences((prev) => prev.filter((item) => item.localId !== localId))
  }

  const addSkillToSelection = (skillId: number) => {
    const skill = skills.find((item) => item.id === skillId)
    if (!skill) return

    setSelectedSkills((prev) => {
      if (prev.some((item) => item.id === skill.id)) return prev
      return [...prev, skill]
    })

    setSkillSearch('')
    setOpenCombo(null)
  }

  const removeSkillFromSelection = (skillId: number) => {
    setSelectedSkills((prev) => prev.filter((item) => item.id !== skillId))
  }

  const validateResume = () => {
    if (!selectedProfessionId) return 'Выберите профессию.'
    return ''
  }

  const validateProfile = () => {
    if (!lastName.trim()) return 'Укажите фамилию.'
    if (!firstName.trim()) return 'Укажите имя.'
    if (!citySearch.trim()) return 'Укажите город проживания.'
    if (!cityId) return 'Выберите город из списка.'
    if (!phone.trim()) return 'Укажите номер телефона.'
    if (!gender) return 'Выберите пол.'
    if (!birthDay || !birthMonth || !birthYear) return 'Укажите дату рождения.'
    return ''
  }

  const validateEducationSection = () => {
    const touchedRows = educations.filter(
      (item) =>
        item.institution_name.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year,
    )

    for (const item of touchedRows) {
      if (!item.institution_id) return 'Выберите учебное заведение из списка.'
      if (!item.start_month || !item.start_year) return 'Укажите дату начала обучения.'
      if (!item.end_month || !item.end_year) return 'Укажите дату окончания обучения.'

      const start = Number(`${item.start_year}${item.start_month}`)
      const end = Number(`${item.end_year}${item.end_month}`)

      if (start > end) return 'Дата окончания обучения не может быть раньше даты начала.'
    }

    return ''
  }

  const validateExperienceSection = () => {
    const touchedRows = experiences.filter(
      (item) =>
        item.company_name.trim() ||
        item.position.trim() ||
        item.start_month ||
        item.start_year ||
        item.end_month ||
        item.end_year ||
        item.description.trim(),
    )

    for (const item of touchedRows) {
      if (!item.company_name.trim()) return 'Укажите компанию.'
      if (!item.position.trim()) return 'Укажите должность.'
      if (!item.start_month || !item.start_year) return 'Укажите дату начала работы.'
      if (!item.is_current && (!item.end_month || !item.end_year)) {
        return 'Укажите дату окончания работы или отметьте «Работаю сейчас».'
      }
      if (!item.description.trim()) return 'Добавьте описание опыта работы.'

      if (!item.is_current) {
        const start = Number(`${item.start_year}${item.start_month}`)
        const end = Number(`${item.end_year}${item.end_month}`)
        if (start > end) return 'Дата окончания работы не может быть раньше даты начала.'
      }
    }

    return ''
  }

  const handleSaveResume = async () => {
    setNotice(null)
    const error = validateResume()
    if (error) {
      setError(error)
      return
    }

    try {
      await resumeMutation.mutateAsync({
        profession_id: Number(selectedProfessionId),
      })

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })
      await queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] })
      setSuccess('Резюме сохранено.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось сохранить резюме.'))
    }
  }

  const handleSaveProfile = async () => {
    setNotice(null)
    const error = validateProfile()
    if (error) {
      setError(error)
      return
    }

    try {
      await profileMutation.mutateAsync({
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        middle_name: middleName.trim() || null,
        phone: phone.trim(),
        gender,
        city_name: citySearch.trim(),
        birth_date: buildBirthDate(birthDay, birthMonth, birthYear),
      })

      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })
      setSuccess('Профиль соискателя сохранён.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось сохранить профиль.'))
    }
  }

  const handleSaveSkills = async () => {
    setNotice(null)

    try {
      const currentSkills = toArray<ResumeSkill>(currentResume?.skills)
      const currentIds = new Set(currentSkills.map((item) => item.id))
      const selectedIds = new Set(selectedSkills.map((item) => item.id))

      const toRemove = currentSkills.filter((item) => !selectedIds.has(item.id))
      const toAdd = selectedSkills
        .filter((item) => !currentIds.has(item.id))
        .map((item) => item.name)

      for (const skill of toRemove) {
        await removeSkillMutation.mutateAsync(skill.id)
      }

      if (toAdd.length > 0) {
        await addSkillsBatchMutation.mutateAsync({ skills: toAdd })
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })
      setSuccess('Навыки сохранены.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось сохранить навыки.'))
    }
  }

  const handleSaveEducations = async () => {
    setNotice(null)
    const error = validateEducationSection()
    if (error) {
      setError(error)
      return
    }

    try {
      const touchedRows = educations.filter(
        (item) =>
          item.institution_name.trim() ||
          item.start_month ||
          item.start_year ||
          item.end_month ||
          item.end_year,
      )

      for (const item of touchedRows) {
        if (!item.institution_id) continue

        const payload = {
          institution_id: item.institution_id,
          start_date: buildMonthYearDate(item.start_month, item.start_year) as string,
          end_date: buildMonthYearDate(item.end_month, item.end_year),
        }

        if (item.id) {
          await updateEducationMutation.mutateAsync({
            educationId: item.id,
            payload,
          })
        } else {
          await addEducationMutation.mutateAsync(payload)
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })
      setSuccess('Образование сохранено.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось сохранить образование.'))
    }
  }

  const handleDeleteEducation = async (item: EducationDraft) => {
    setNotice(null)

    if (!item.id) {
      removeEducationRowLocal(item.localId)
      return
    }

    try {
      await deleteEducationMutation.mutateAsync(item.id)
      removeEducationRowLocal(item.localId)
      await queryClient.invalidateQueries({ queryKey: ['applicant-profile', numericResumeId] })
      setSuccess('Образование удалено.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить образование.'))
    }
  }

  const handleSaveExperiences = async () => {
    setNotice(null)
    const error = validateExperienceSection()
    if (error) {
      setError(error)
      return
    }

    try {
      const touchedRows = experiences.filter(
        (item) =>
          item.company_name.trim() ||
          item.position.trim() ||
          item.start_month ||
          item.start_year ||
          item.end_month ||
          item.end_year ||
          item.description.trim(),
      )

      for (const item of touchedRows) {
        const payload = {
          company_name: item.company_name.trim(),
          position: item.position.trim(),
          start_date: buildMonthYearDate(item.start_month, item.start_year) as string,
          end_date: item.is_current ? null : buildMonthYearDate(item.end_month, item.end_year),
          description: item.description.trim() || null,
        }

        if (item.id) {
          await updateWorkExperienceMutation.mutateAsync({
            experienceId: item.id,
            payload,
          })
        } else {
          await addWorkExperienceMutation.mutateAsync({
            resume_id: numericResumeId,
            ...payload,
          })
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })
      setSuccess('Опыт работы сохранён.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось сохранить опыт работы.'))
    }
  }

  const handleDeleteExperience = async (item: WorkExperienceDraft) => {
    setNotice(null)

    if (!item.id) {
      removeExperienceRowLocal(item.localId)
      return
    }

    try {
      await deleteWorkExperienceMutation.mutateAsync(item.id)
      removeExperienceRowLocal(item.localId)
      await queryClient.invalidateQueries({ queryKey: ['applicant-resume', numericResumeId] })
      setSuccess('Опыт работы удалён.')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить опыт работы.'))
    }
  }

  const handleDeleteResume = async () => {
    setNotice(null)
    const confirmed = window.confirm('Удалить это резюме?')
    if (!confirmed) return

    try {
      await deleteResumeMutation.mutateAsync()
      await queryClient.invalidateQueries({ queryKey: ['applicant-resumes'] })
      navigate('/applicant')
    } catch (err) {
      setError(getErrorMessage(err, 'Не удалось удалить резюме.'))
    }
  }

  if (!resumeId || Number.isNaN(numericResumeId) || numericResumeId <= 0) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty">Некорректный идентификатор резюме.</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (applicantQuery.isLoading || resumeQuery.isLoading) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty">Загрузка данных...</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (applicantQuery.isError || resumeQuery.isError) {
    return (
      <div className="resume-editor-page">
        <Header />
        <main className="resume-editor-page__main">
          <div className="resume-editor-page__container">
            <div className="resume-editor-empty resume-editor-empty--error">
              {getErrorMessage(
                resumeQuery.error || applicantQuery.error,
                'Не удалось загрузить данные резюме.',
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="resume-editor-page">
      <Header />

      <main className="resume-editor-page__main">
        <div className="resume-editor-page__container">

          {notice && (
            <div
              className={`resume-editor-notice ${
                notice.type === 'success'
                  ? 'resume-editor-notice--success'
                  : 'resume-editor-notice--error'
              }`}
            >
              {notice.text}
            </div>
          )}

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-hero__topbar">
              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--outline"
                onClick={() => navigate('/applicant')}
              >
                ← Назад к списку резюме
              </button>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--danger"
                onClick={handleDeleteResume}
                disabled={deleteResumeMutation.isPending}
              >
                Удалить резюме
              </button>
            </div>

            <div className="resume-editor-hero__content">
              <div className="resume-editor-hero__label">Резюме</div>
              <h1 className="resume-editor-hero__title">
                {selectedProfessionName || currentResume?.profession?.name || 'Резюме'}
              </h1>
              <div className="resume-editor-hero__meta">
                Создано: {formatDateTime(currentResume?.created_at)} · Обновлено:{' '}
                {formatDateTime(currentResume?.updated_at)}
              </div>
            </div>
            <div className="resume-editor-section__head">
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Профиль соискателя</h2>
                <p className="resume-editor-section__subtitle">
                  Эти данные относятся ко всему профилю, а не только к одному резюме.
                </p>
              </div>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--primary"
                onClick={handleSaveProfile}
                disabled={profileMutation.isPending}
              >
                Сохранить профиль
              </button>
            </div>

            <div className="resume-editor-subgrid">
              <div className="resume-editor-subcard">
                <div className="resume-editor-subcard__title">Личные данные</div>

                <div className="form-grid form-grid--three">
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

                <div className="form-grid form-grid--two">
                  <label className="field">
                    <span>Пол</span>

                    <SelectCombo
                      value={genderOptions.find((item) => item.value === gender)?.label || ''}
                      placeholder="Выберите пол"
                      isOpen={openCombo === 'gender'}
                      options={genderOptions}
                      onToggle={() =>
                        setOpenCombo((prev) => (prev === 'gender' ? null : 'gender'))
                      }
                      onSelect={(option) => {
                        setGender(String(option.value) as GenderValue)
                        setOpenCombo(null)
                      }}
                    />
                  </label>
                </div>

                <div className="section-block">
                  <span className="section-block__label">Дата рождения</span>

                  <div className="date-grid date-grid--three">
                    <label className="field">
                      <span>День</span>
                      <SelectCombo
                        value={dayOptions.find((item) => item.value === birthDay)?.label || ''}
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
              </div>

              <div className="resume-editor-subcard">
                <div className="resume-editor-subcard__title">Контактная информация</div>

                <div className="form-grid form-grid--two">
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
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Навыки</h2>
                <p className="resume-editor-section__subtitle">
                  Навыки привязаны к выбранному резюме.
                </p>
              </div>

              <button
                type="button"
                className="resume-editor-btn resume-editor-btn--primary"
                onClick={handleSaveSkills}
                disabled={addSkillsBatchMutation.isPending || removeSkillMutation.isPending}
              >
                Сохранить навыки
              </button>
            </div>

            <div className="resume-editor-subcard resume-editor-subcard--highlight">
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
                  onSelect={(option) => addSkillToSelection(Number(option.value))}
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
                      onClick={() => removeSkillFromSelection(item.id)}
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
                      onClick={() => addSkillToSelection(Number(item.value))}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Опыт работы</h2>
                <p className="resume-editor-section__subtitle">
                  Каждую запись можно редактировать отдельно.
                </p>
              </div>

              <div className="resume-editor-actions">
                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--ghost"
                  onClick={addExperienceRow}
                >
                  Добавить опыт
                </button>

                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--primary"
                  onClick={handleSaveExperiences}
                  disabled={
                    addWorkExperienceMutation.isPending || updateWorkExperienceMutation.isPending
                  }
                >
                  Сохранить опыт
                </button>
              </div>
            </div>

            {experiences.length === 0 && (
              <div className="resume-editor-empty-inline">Опыт работы пока не добавлен.</div>
            )}

            {experiences.map((experience, index) => {
              const startMonthLabel =
                monthOptions.find((item) => item.value === experience.start_month)?.label || ''

              const endMonthLabel =
                monthOptions.find((item) => item.value === experience.end_month)?.label || ''

              return (
                <div key={experience.localId} className="experience-card">
                  <div className="experience-card__head">
                    <h3>Опыт работы {index + 1}</h3>

                    <button
                      type="button"
                      className="link-danger"
                      onClick={() => handleDeleteExperience(experience)}
                      disabled={deleteWorkExperienceMutation.isPending}
                    >
                      Удалить
                    </button>
                  </div>

                  <div className="form-grid form-grid--two">
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
                  </div>

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
                                  : `exp-start-month-${experience.localId}`,
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
                                  : `exp-start-year-${experience.localId}`,
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
                                  : `exp-end-month-${experience.localId}`,
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
                                  : `exp-end-year-${experience.localId}`,
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
          </section>

          <section className="resume-editor-card resume-editor-section">
            <div className="resume-editor-section__head">
              <div>
                <h2 className="resume-editor-section__title">Образование</h2>
                <p className="resume-editor-section__subtitle">
                  Эти записи относятся ко всему профилю соискателя.
                </p>
              </div>

              <div className="resume-editor-actions">
                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--ghost"
                  onClick={addEducationRow}
                >
                  Добавить образование
                </button>

                <button
                  type="button"
                  className="resume-editor-btn resume-editor-btn--primary"
                  onClick={handleSaveEducations}
                  disabled={addEducationMutation.isPending || updateEducationMutation.isPending}
                >
                  Сохранить образование
                </button>
              </div>
            </div>

            {educations.length === 0 && (
              <div className="resume-editor-empty-inline">Образование пока не добавлено.</div>
            )}

            {educations.map((education, index) => {
              const educationSearch = education.institution_name.trim().toLowerCase()

              const educationOptions: ComboOption[] = (
                educationSearch
                  ? educationInstitutions.filter((item) =>
                      item.name.toLowerCase().includes(educationSearch),
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

                    <button
                      type="button"
                      className="link-danger"
                      onClick={() => handleDeleteEducation(education)}
                      disabled={deleteEducationMutation.isPending}
                    >
                      Удалить
                    </button>
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
                                  : `education-start-month-${education.localId}`,
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
                                  : `education-start-year-${education.localId}`,
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
                                  : `education-end-month-${education.localId}`,
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
                                  : `education-end-year-${education.localId}`,
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
          </section>
        </div>
      </main>

      <Footer />
    </div>
  )
}