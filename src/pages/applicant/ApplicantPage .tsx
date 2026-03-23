import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { http } from '../../shared/api/http'
import { authSession } from '../../shared/auth/session'
import './applicant.css'
import { FilterSelect } from '../../shared/ui/FilterSelect'
import {
  ApplicantCabinet,
  type ApplicantProfile,
  type CatalogItem,
} from './ApplicantCabinet'
import './applicant-cabinet.css'

type TabKey =
  | 'vacancies'
  | 'resume-profile'
  | 'applications'
  | 'help'
  | 'search'
  | 'chat'
  | 'favorites'
  | 'create-resume'
  | 'profile'

type CreateResumeStep = 1 | 2 | 3 | 4 | 5

type Vacancy = {
  id: number
  title: string
  description: string
  salary_min: number
  salary_max: number
  company_name: string
  city_name: string
  profession_name: string
}

type VacancyDetail = Vacancy & {
  employment_type?: string
  work_schedule?: string
  experience?: string
  skills?: string[]
}

type ApplicationItem = {
  vacancy_id: number
  resume_id: number
  status: 'pending' | 'accepted' | 'rejected'
  created_at?: string
}

type EducationDraft = {
  id?: number
  institutionId: string
  institutionName: string
  startDate: string
  endDate: string
  isStudyingNow: boolean
}

type ExperienceDraft = {
  companyName: string
  position: string
  startDate: string
  endDate: string
  isCurrentJob: boolean
  description: string
}

type ResumeFormState = {
  professionId: string
  firstName: string
  lastName: string
  middleName: string
  gender: string
  cityId: string
  cityName: string
  phone: string
  birthDate: string
  skills: CatalogItem[]
  skillSearch: string
  educations: EducationDraft[]
  workExperiences: ExperienceDraft[]
}

type SearchableSelectProps = {
  label: string
  placeholder: string
  searchPlaceholder: string
  items: CatalogItem[]
  selectedId?: string
  selectedLabel?: string
  onSelect: (item: CatalogItem) => void
  hint?: string
  emptyText?: string
  loading?: boolean
}

const stepLabels = ['Профессия', 'Контакты', 'Образование', 'Навыки', 'Опыт'] as const

const statusLabel: Record<ApplicationItem['status'], string> = {
  pending: 'На рассмотрении',
  accepted: 'Приглашение',
  rejected: 'Отказ',
}

const createEmptyEducation = (): EducationDraft => ({
  institutionId: '',
  institutionName: '',
  startDate: '',
  endDate: '',
  isStudyingNow: false,
})

const createEmptyExperience = (): ExperienceDraft => ({
  companyName: '',
  position: '',
  startDate: '',
  endDate: '',
  isCurrentJob: false,
  description: '',
})

const createEmptyResumeForm = (): ResumeFormState => ({
  professionId: '',
  firstName: '',
  lastName: '',
  middleName: '',
  gender: '',
  cityId: '',
  cityName: '',
  phone: '',
  birthDate: '',
  skills: [],
  skillSearch: '',
  educations: [createEmptyEducation()],
  workExperiences: [createEmptyExperience()],
})

const isEducationFilled = (item: EducationDraft) => Boolean(item.institutionId && item.startDate)
const hasEducationContent = (item: EducationDraft) =>
  Boolean(item.institutionId || item.institutionName || item.startDate || item.endDate)

const isExperienceFilled = (item: ExperienceDraft) => {
  if (!item.companyName && !item.position && !item.startDate && !item.endDate && !item.description) {
    return false
  }

  if (!item.companyName || !item.position || !item.startDate) return false
  if (!item.isCurrentJob && !item.endDate) return false
  return true
}

const hasExperienceContent = (item: ExperienceDraft) =>
  Boolean(item.companyName || item.position || item.startDate || item.endDate || item.description)

const SearchableSelect = ({
  label,
  placeholder,
  searchPlaceholder,
  items,
  selectedId,
  selectedLabel,
  onSelect,
  hint,
  emptyText = 'Ничего не найдено',
  loading = false,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState(selectedLabel ?? '')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return items.slice(0, 12)
    return items.filter((item) => item.name.toLowerCase().includes(normalizedQuery)).slice(0, 12)
  }, [items, query])

  useEffect(() => {
    if (!isOpen) {
      setQuery(selectedLabel ?? '')
    }
  }, [isOpen, selectedLabel])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="searchable-select" ref={rootRef}>
      <span className="field-label">{label}</span>
      <div className={`searchable-select-field ${isOpen ? 'open' : ''}`}>
        <input
          className="searchable-select-input"
          placeholder={selectedId ? searchPlaceholder : placeholder}
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
        />
      </div>
      <span className="select-chevron">▾</span>
      {hint && <span className="field-hint">{hint}</span>}
      {isOpen && (
        <div className="searchable-select-popover">
          <div className="searchable-select-options">
            {loading && <div className="searchable-empty">Загружаем варианты...</div>}
            {!loading && filteredItems.length === 0 && <div className="searchable-empty">{emptyText}</div>}
            {!loading &&
              filteredItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`searchable-option ${selectedId === String(item.id) ? 'active' : ''}`}
                  onClick={() => {
                    onSelect(item)
                    setQuery(item.name)
                    setIsOpen(false)
                  }}
                >
                  <span>{item.name}</span>
                  {selectedId === String(item.id) && <span className="option-check">✓</span>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

const normalizeApplicantProfile = (data: any): ApplicantProfile => ({
  ...data,
  educations: Array.isArray(data?.educations) ? data.educations : [],
  resumes: Array.isArray(data?.resumes) ? data.resumes : [],
})

const fetchProfile = async (): Promise<ApplicantProfile> => {
  const { data } = await http.get('/applicants/me')
  return normalizeApplicantProfile(data)
}

const fetchApplications = async (): Promise<ApplicationItem[]> => {
  const { data } = await http.get('/applicants/me/applications', { params: { skip: 0, limit: 50 } })
  return data
}

const fetchCatalog = async (name: string): Promise<CatalogItem[]> => {
  const { data } = await http.get(`/public/catalogs/${name}`, { params: { skip: 0, limit: 200 } })
  return data
}

const fetchVacancies = async (params: {
  search: string
  cityId?: number
  professionId?: number
}): Promise<Vacancy[]> => {
  const { data } = await http.get('/public/vacancies', {
    params: {
      search: params.search || undefined,
      city_id: params.cityId,
      profession_id: params.professionId,
      limit: 20,
      skip: 0,
    },
  })
  return data
}

const fetchVacancyDetail = async (id: number): Promise<VacancyDetail> => {
  const { data } = await http.get(`/public/vacancies/${id}`)
  return data
}

export const ApplicantPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState<TabKey>('resume-profile')
  const [menuOpen, setMenuOpen] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [createResumeStep, setCreateResumeStep] = useState<CreateResumeStep>(1)
  const [resumeForm, setResumeForm] = useState<ResumeFormState>(createEmptyResumeForm)
  const [resumeFormInitialized, setResumeFormInitialized] = useState(false)
  const [filters, setFilters] = useState({
    salaryFrom: '',
    salaryTo: '',
    salarySpecifiedOnly: false,
    cityId: '',
    professionId: '',
    educationRequired: '',
    experience: '',
    employmentType: '',
    workSchedule: '',
    workFormat: '',
    applicationStatus: 'all',
  })

  const profileQuery = useQuery({ queryKey: ['applicant-profile'], queryFn: fetchProfile })
  const applicationsQuery = useQuery({ queryKey: ['applicant-applications'], queryFn: fetchApplications })
  const citiesQuery = useQuery({ queryKey: ['catalog-cities'], queryFn: () => fetchCatalog('cities') })
  const professionsQuery = useQuery({ queryKey: ['catalog-professions'], queryFn: () => fetchCatalog('professions') })
  const experiencesQuery = useQuery({ queryKey: ['catalog-experiences'], queryFn: () => fetchCatalog('experiences') })
  const skillsQuery = useQuery({ queryKey: ['catalog-skills'], queryFn: () => fetchCatalog('skills') })
  const educationalInstitutionsQuery = useQuery({
    queryKey: ['catalog-educational-institutions'],
    queryFn: () => fetchCatalog('educational-institutions'),
  })
  const employmentTypesQuery = useQuery({
    queryKey: ['catalog-employment-types'],
    queryFn: () => fetchCatalog('employment-types'),
  })
  const workSchedulesQuery = useQuery({
    queryKey: ['catalog-work-schedules'],
    queryFn: () => fetchCatalog('work-schedules'),
  })

  const vacanciesQuery = useQuery({
    queryKey: ['applicant-public-vacancies', search, filters.cityId, filters.professionId],
    queryFn: () =>
      fetchVacancies({
        search,
        cityId: filters.cityId ? Number(filters.cityId) : undefined,
        professionId: filters.professionId ? Number(filters.professionId) : undefined,
      }),
  })

  const vacancyDetailsQuery = useQuery({
    queryKey: ['applicant-vacancy-details', vacanciesQuery.data?.map((v) => v.id).join(',')],
    enabled: Boolean(vacanciesQuery.data?.length),
    queryFn: async () => Promise.all((vacanciesQuery.data ?? []).map((vacancy) => fetchVacancyDetail(vacancy.id))),
  })

  const profile = profileQuery.data
  const resumes = profile?.resumes ?? []
  const primaryResume = resumes[0]

  const selectedProfession = useMemo(
    () => professionsQuery.data?.find((item) => String(item.id) === resumeForm.professionId),
    [professionsQuery.data, resumeForm.professionId],
  )

  const selectedCity = useMemo(
    () => citiesQuery.data?.find((item) => String(item.id) === resumeForm.cityId),
    [citiesQuery.data, resumeForm.cityId],
  )

  const skillSuggestions = useMemo(() => {
    const query = resumeForm.skillSearch.trim().toLowerCase()
    const available = (skillsQuery.data ?? []).filter(
      (item) => !resumeForm.skills.some((skill) => skill.id === item.id),
    )

    if (!query) return available.slice(0, 12)
    return available.filter((item) => item.name.toLowerCase().includes(query)).slice(0, 12)
  }, [resumeForm.skillSearch, resumeForm.skills, skillsQuery.data])

  useEffect(() => {
    if (!profile || resumeFormInitialized) return

    const matchedCity = citiesQuery.data?.find((city) => city.name === (profile.city?.name ?? ''))
    const profileEducations = profile.educations ?? []

    const mappedEducations =
      profileEducations.length > 0
        ? profileEducations.map((item) => ({
            id: item.id,
            institutionId: item.institution_id ? String(item.institution_id) : '',
            institutionName: item.institution_name ?? '',
            startDate: item.start_date ?? '',
            endDate: item.end_date ?? '',
            isStudyingNow: !item.end_date,
          }))
        : [createEmptyEducation()]

    setResumeForm((prev) => ({
      ...prev,
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
      middleName: profile.middle_name ?? '',
      gender: profile.gender ?? '',
      cityId: matchedCity ? String(matchedCity.id) : '',
      cityName: profile.city?.name ?? '',
      phone: profile.phone ?? '',
      birthDate: profile.birth_date ?? '',
      educations: mappedEducations,
    }))

    setResumeFormInitialized(true)
  }, [citiesQuery.data, profile, resumeFormInitialized])

  const appliedVacancyIds = useMemo(
    () => new Set((applicationsQuery.data ?? []).map((item) => item.vacancy_id)),
    [applicationsQuery.data],
  )

  const completion = useMemo(() => {
    if (!profile) return 0

    const checks = [
      Boolean(profile.first_name),
      Boolean(profile.last_name),
      Boolean(profile.phone),
      Boolean(profile.city?.name),
      resumes.length > 0,
      (primaryResume?.skills?.length ?? 0) > 0,
    ]

    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [profile, resumes.length, primaryResume?.skills?.length])

  const currentStepValid = useMemo(() => {
    if (createResumeStep === 1) return Boolean(resumeForm.professionId)
    if (createResumeStep === 2) {
      return Boolean(
        resumeForm.firstName.trim() &&
          resumeForm.lastName.trim() &&
          resumeForm.phone.trim() &&
          resumeForm.cityName.trim(),
      )
    }
    if (createResumeStep === 3) {
      return resumeForm.educations.every((item) => !hasEducationContent(item) || isEducationFilled(item))
    }
    if (createResumeStep === 4) return resumeForm.skills.length > 0
    if (createResumeStep === 5) {
      return resumeForm.workExperiences.every((item) => !hasExperienceContent(item) || isExperienceFilled(item))
    }
    return false
  }, [createResumeStep, resumeForm])

  const filteredVacancies = useMemo(() => {
    const details = vacancyDetailsQuery.data ?? []

    return details.filter((vacancy) => {
      if (filters.salarySpecifiedOnly && (!vacancy.salary_min || !vacancy.salary_max)) return false
      if (filters.salaryFrom && vacancy.salary_max < Number(filters.salaryFrom)) return false
      if (filters.salaryTo && vacancy.salary_min > Number(filters.salaryTo)) return false
      if (filters.experience && vacancy.experience !== filters.experience) return false
      if (filters.employmentType && vacancy.employment_type !== filters.employmentType) return false
      if (filters.workSchedule && vacancy.work_schedule !== filters.workSchedule) return false

      if (filters.workFormat) {
        const text = `${vacancy.work_schedule ?? ''} ${vacancy.description ?? ''}`.toLowerCase()
        if (!text.includes(filters.workFormat.toLowerCase())) return false
      }

      if (filters.educationRequired) {
        const text = vacancy.description.toLowerCase()
        const hasEducationWord = text.includes('образован')
        if (filters.educationRequired === 'yes' && !hasEducationWord) return false
        if (filters.educationRequired === 'no' && hasEducationWord) return false
      }

      return true
    })
  }, [filters, vacancyDetailsQuery.data])

  const filteredApplications = useMemo(() => {
    const all = applicationsQuery.data ?? []
    if (filters.applicationStatus === 'all') return all
    return all.filter((item) => item.status === filters.applicationStatus)
  }, [applicationsQuery.data, filters.applicationStatus])

  const formSummary = useMemo(
    () => [
      { label: 'Профессия', value: selectedProfession?.name ?? 'Не выбрана' },
      {
        label: 'Контакты',
        value:
          resumeForm.firstName || resumeForm.lastName
            ? `${resumeForm.lastName} ${resumeForm.firstName}`.trim()
            : 'Не заполнены',
      },
      { label: 'Город', value: resumeForm.cityName || 'Не выбран' },
      {
        label: 'Образование',
        value: resumeForm.educations.filter(isEducationFilled).length
          ? `${resumeForm.educations.filter(isEducationFilled).length} запис.`
          : 'Не добавлено',
      },
      {
        label: 'Навыки',
        value: resumeForm.skills.length ? resumeForm.skills.map((item) => item.name).join(', ') : 'Не выбраны',
      },
      {
        label: 'Опыт работы',
        value: resumeForm.workExperiences.filter(isExperienceFilled).length
          ? `${resumeForm.workExperiences.filter(isExperienceFilled).length} мест работы`
          : 'Можно добавить позже',
      },
    ],
    [resumeForm, selectedProfession?.name],
  )

  const applyMutation = useMutation({
    mutationFn: async (vacancyId: number) => {
      if (!primaryResume) {
        throw new Error('Создайте резюме, чтобы откликаться на вакансии.')
      }

      await http.post('/applicants/me/applications', {
        vacancy_id: vacancyId,
        resume_id: primaryResume.id,
        status: 'pending',
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applicant-applications'] })
    },
  })

  const saveProfileMutation = useMutation({
    mutationFn: async (payload: {
      first_name: string | null
      last_name: string | null
      middle_name: string | null
      phone: string | null
      birth_date: string | null
      gender: string | null
      city_name: string | null
    }) => {
      const normalizedPhone = (payload.phone ?? '').replace(/[^+\d]/g, '')
      await http.put('/applicants/me', {
        ...payload,
        phone: normalizedPhone || null,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applicant-profile'] })
    },
  })

  const saveEducationMutation = useMutation({
    mutationFn: async (payload: {
      id?: number
      institution_id: number
      start_date: string
      end_date: string | null
    }) => {
      const requestBody = {
        institution_id: payload.institution_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
      }

      if (payload.id) {
        await http.put(`/applicants/me/education/${payload.id}`, requestBody)
        return
      }

      await http.post('/applicants/me/education', requestBody)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applicant-profile'] })
    },
  })

  const deleteEducationMutation = useMutation({
    mutationFn: async (educationId: number) => {
      await http.delete(`/applicants/me/education/${educationId}`)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['applicant-profile'] })
    },
  })

  const createResumeMutation = useMutation({
    mutationFn: async () => {
      if (!resumeForm.professionId) {
        throw new Error('Выберите профессию для резюме.')
      }

      const normalizedPhone = resumeForm.phone.replace(/[^+\d]/g, '')
      await http.put('/applicants/me', {
        first_name: resumeForm.firstName || null,
        last_name: resumeForm.lastName || null,
        middle_name: resumeForm.middleName || null,
        gender: resumeForm.gender || null,
        city_name: resumeForm.cityName || null,
        phone: normalizedPhone || null,
        birth_date: resumeForm.birthDate || null,
      })

      const profileEducationIds = new Set((profile?.educations ?? []).map((item) => item.id))
      const activeEducationIds = new Set<number>()

      for (const education of resumeForm.educations.filter(isEducationFilled)) {
        const payload = {
          institution_id: Number(education.institutionId),
          start_date: education.startDate,
          end_date: education.isStudyingNow ? null : education.endDate || null,
        }

        if (education.id) {
          await http.put(`/applicants/me/education/${education.id}`, payload)
          activeEducationIds.add(education.id)
        } else {
          const { data } = await http.post('/applicants/me/education', payload)
          activeEducationIds.add(data.id)
        }
      }

      const educationIdsToDelete = [...profileEducationIds].filter((id) => !activeEducationIds.has(id))
      for (const id of educationIdsToDelete) {
        await http.delete(`/applicants/me/education/${id}`)
      }

      const { data: resume } = await http.post('/applicants/me/resumes', {
        profession_id: Number(resumeForm.professionId),
      })

      if (resumeForm.skills.length > 0) {
        await http.post(`/applicants/me/resumes/${resume.id}/skills/batch`, {
          skills: resumeForm.skills.map((item) => item.name),
        })
      }

      for (const experience of resumeForm.workExperiences.filter(isExperienceFilled)) {
        await http.post(`/applicants/me/resumes/${resume.id}/work-experiences`, {
          resume_id: resume.id,
          company_name: experience.companyName,
          position: experience.position,
          start_date: experience.startDate,
          end_date: experience.isCurrentJob ? null : experience.endDate || null,
          description: experience.description || null,
        })
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['applicant-profile'] }),
        queryClient.invalidateQueries({ queryKey: ['applicant-applications'] }),
      ])
      setResumeForm(createEmptyResumeForm())
      setResumeFormInitialized(false)
      setCreateResumeStep(1)
      setActiveTab('resume-profile')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await http.post('/auth/logout')
    },
    onSettled: () => {
      authSession.clear()
      navigate('/login', { replace: true })
    },
  })

  const addSkill = (skill: CatalogItem) => {
    setResumeForm((prev) => ({
      ...prev,
      skills: prev.skills.some((item) => item.id === skill.id) ? prev.skills : [...prev.skills, skill],
      skillSearch: '',
    }))
  }

  const removeSkill = (skillId: number) => {
    setResumeForm((prev) => ({
      ...prev,
      skills: prev.skills.filter((item) => item.id !== skillId),
    }))
  }

  const updateEducation = (index: number, updater: (item: EducationDraft) => EducationDraft) => {
    setResumeForm((prev) => ({
      ...prev,
      educations: prev.educations.map((item, currentIndex) =>
        currentIndex === index ? updater(item) : item,
      ),
    }))
  }

  const updateExperience = (index: number, updater: (item: ExperienceDraft) => ExperienceDraft) => {
    setResumeForm((prev) => ({
      ...prev,
      workExperiences: prev.workExperiences.map((item, currentIndex) =>
        currentIndex === index ? updater(item) : item,
      ),
    }))
  }

  const renderVacanciesContent = () => (
    <section className="content-panel">
      <div className="search-row">
        <form
          className="search-box"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
          }}
        >
          <input
            placeholder="Должность, стек, компания"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit">Найти</button>
        </form>
      </div>

      <div className="vacancies-layout">
        <aside className="filters-panel">
          <h3>Фильтры</h3>

          <label>
            Уровень дохода от
            <input
              type="number"
              value={filters.salaryFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, salaryFrom: e.target.value }))}
            />
          </label>

          <label>
            Уровень дохода до
            <input
              type="number"
              value={filters.salaryTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, salaryTo: e.target.value }))}
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={filters.salarySpecifiedOnly}
              onChange={(e) => setFilters((prev) => ({ ...prev, salarySpecifiedOnly: e.target.checked }))}
            />
            Указан доход
          </label>

          <label>
            Регион
            <FilterSelect
              value={filters.cityId}
              onChange={(value) => setFilters((prev) => ({ ...prev, cityId: value }))}
              options={[
                { value: '', label: 'Все' },
                ...(citiesQuery.data?.map((city) => ({
                  value: String(city.id),
                  label: city.name,
                })) ?? []),
              ]}
              placeholder="Все"
            />
          </label>

          <label>
            Специализации
            <FilterSelect
              value={filters.professionId}
              onChange={(value) => setFilters((prev) => ({ ...prev, professionId: value }))}
              options={[
                { value: '', label: 'Все' },
                ...(professionsQuery.data?.map((item) => ({
                  value: String(item.id),
                  label: item.name,
                })) ?? []),
              ]}
              placeholder="Все"
            />
          </label>

          <label>
            Образование
            <FilterSelect
              value={filters.educationRequired}
              onChange={(value) => setFilters((prev) => ({ ...prev, educationRequired: value }))}
              options={[
                { value: '', label: 'Не важно' },
                { value: 'yes', label: 'Требуется' },
                { value: 'no', label: 'Не требуется' },
              ]}
              placeholder="Не важно"
            />
          </label>

          <label>
            Опыт работы
            <FilterSelect
              value={filters.experience}
              onChange={(value) => setFilters((prev) => ({ ...prev, experience: value }))}
              options={[
                { value: '', label: 'Все' },
                ...(experiencesQuery.data?.map((item) => ({
                  value: item.name,
                  label: item.name,
                })) ?? []),
              ]}
              placeholder="Все"
            />
          </label>

          <label>
            Тип занятости
            <FilterSelect
              value={filters.employmentType}
              onChange={(value) => setFilters((prev) => ({ ...prev, employmentType: value }))}
              options={[
                { value: '', label: 'Все' },
                ...(employmentTypesQuery.data?.map((item) => ({
                  value: item.name,
                  label: item.name,
                })) ?? []),
              ]}
              placeholder="Все"
            />
          </label>

          <label>
            График работы
            <FilterSelect
              value={filters.workSchedule}
              onChange={(value) => setFilters((prev) => ({ ...prev, workSchedule: value }))}
              options={[
                { value: '', label: 'Все' },
                ...(workSchedulesQuery.data?.map((item) => ({
                  value: item.name,
                  label: item.name,
                })) ?? []),
              ]}
              placeholder="Все"
            />
          </label>

          <label>
            Формат работы
            <FilterSelect
              value={filters.workFormat}
              onChange={(value) => setFilters((prev) => ({ ...prev, workFormat: value }))}
              options={[
                { value: '', label: 'Все' },
                { value: 'удал', label: 'Удалённо' },
                { value: 'офис', label: 'Офис' },
                { value: 'гибрид', label: 'Гибрид' },
              ]}
              placeholder="Все"
            />
          </label>
        </aside>

        <div className="vacancy-list-area">
          <h3>Найдено вакансий: {filteredVacancies.length}</h3>
          {vacanciesQuery.isLoading && <p>Загружаем вакансии...</p>}
          {vacancyDetailsQuery.isLoading && <p>Загружаем детали вакансий...</p>}
          {applyMutation.isError && <p className="error-text">{(applyMutation.error as Error).message}</p>}

          <div className="vacancy-list">
            {filteredVacancies.map((vacancy) => {
              const alreadyApplied = appliedVacancyIds.has(vacancy.id)

              return (
                <article key={vacancy.id} className="vacancy-card">
                  <h4>
                    <a href={`/vacancies/${vacancy.id}`} target="_blank" rel="noreferrer">
                      {vacancy.title}
                    </a>
                  </h4>
                  <p className="meta">
                    {vacancy.company_name} • {vacancy.city_name}
                  </p>
                  <p className="salary">
                    {vacancy.salary_min.toLocaleString('ru-RU')} — {vacancy.salary_max.toLocaleString('ru-RU')} ₽
                  </p>
                  <div className="chips">
                    {vacancy.experience && <span>{vacancy.experience}</span>}
                    {vacancy.employment_type && <span>{vacancy.employment_type}</span>}
                    {vacancy.work_schedule && <span>{vacancy.work_schedule}</span>}
                  </div>
                  <p className="desc">{vacancy.description}</p>
                  <button
                    disabled={alreadyApplied || applyMutation.isPending}
                    onClick={() => applyMutation.mutate(vacancy.id)}
                  >
                    {alreadyApplied ? 'Отклик отправлен' : applyMutation.isPending ? 'Отправляем...' : 'Откликнуться'}
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )

  const renderResumeProfileTab = () => (
    <section className="content-panel resume-profile-page">
      <section className="summary-top-card" role="button" tabIndex={0} onClick={() => setActiveTab('profile')}>
        <div className="summary-top-card__left">
          <div className="summary-avatar" />
          <div>
            <h3>
              {[profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Пользователь'}
            </h3>
            <p>{profile?.phone || 'Телефон не указан'}</p>
          </div>
        </div>
        <div className="summary-top-card__arrow">›</div>

        <div className="summary-top-card__footer">
          <span>Статус поиска</span>
          <strong>Активно ищу работу</strong>
        </div>
      </section>

      <section className="summary-progress-card">
        <div className="summary-progress-card__icon">✓</div>
        <div className="summary-progress-card__content">
          <h3>Вы откликнулись {applicationsQuery.data?.length ?? 0} раз</h3>
          <p>Продолжайте в том же духе — чем активнее отклики, тем выше шанс получить приглашение.</p>
        </div>
        <button className="summary-link-btn" onClick={() => setActiveTab('vacancies')}>
          Перейти к вакансиям
        </button>
        <div className="summary-progress-line">
          <span style={{ width: `${Math.max(completion, 10)}%` }} />
        </div>
      </section>

      <section className="summary-section">
        <div className="summary-section__header">
          <h2>Мои резюме | rabota.by</h2>
          <button className="create-btn" onClick={() => setActiveTab('create-resume')}>
            Создать резюме
          </button>
        </div>

        <div className="summary-resume-list">
          {resumes.length === 0 && (
            <article className="summary-resume-card summary-resume-card--empty">
              <strong>У вас пока нет резюме</strong>
              <p>Создайте резюме, чтобы откликаться на вакансии и получать приглашения.</p>
            </article>
          )}

          {resumes.map((resume) => {
            const resumeSkills = resume.skills ?? []
            const resumeExperiences = resume.work_experiences ?? []

            return (
              <article key={resume.id} className="summary-resume-card">
                <div className="summary-resume-card__main">
                  <span className="summary-resume-card__tag">Постоянная работа</span>
                  <h3>{resume.profession?.name ?? `Профессия #${resume.profession_id}`}</h3>
                  <p>
                    {resumeSkills.length
                      ? resumeSkills.map((skill) => skill.name).join(', ')
                      : 'Навыки не указаны'}
                  </p>
                  <button className="summary-link-btn summary-link-btn--small" onClick={() => setActiveTab('profile')}>
                    Перейти в профиль
                  </button>
                </div>

                <div className="summary-resume-card__stats">
                  <div>
                    <span>Просмотры</span>
                    <strong>{Math.max(3, resumeExperiences.length * 5)}</strong>
                  </div>
                  <div>
                    <span>Приглашения</span>
                    <strong>{Math.min(5, applicationsQuery.data?.filter((a) => a.status === 'accepted').length ?? 0)}</strong>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )

  const renderApplicationsTab = () => (
    <section className="content-panel">
      <div className="panel-head-row">
        <h3>Отклики</h3>
        <select
          value={filters.applicationStatus}
          onChange={(e) => setFilters((prev) => ({ ...prev, applicationStatus: e.target.value }))}
        >
          <option value="all">Все статусы</option>
          <option value="pending">На рассмотрении</option>
          <option value="accepted">Приглашение</option>
          <option value="rejected">Отказ</option>
        </select>
      </div>
      <div className="application-list">
        {filteredApplications.map((item) => (
          <article key={`${item.vacancy_id}-${item.resume_id}`} className="application-item">
            <strong>Вакансия #{item.vacancy_id}</strong>
            <span className={`status ${item.status}`}>{statusLabel[item.status]}</span>
          </article>
        ))}
      </div>
    </section>
  )

  const renderCreateResumeTab = () => (
    <section className="content-panel create-resume-panel">
      <div className="resume-builder-head">
        <div>
          <h2>Создание резюме</h2>
          <p className="create-subtitle">
            Выберите профессию, подтяните данные из профиля, добавьте образование, навыки и несколько мест работы.
          </p>
        </div>
        <button
          className="ghost create-reset-btn"
          onClick={() => {
            setResumeForm(createEmptyResumeForm())
            setResumeFormInitialized(false)
            setCreateResumeStep(1)
          }}
          disabled={createResumeMutation.isPending}
        >
          Очистить форму
        </button>
      </div>

      <div className="wizard-progress">
        {stepLabels.map((label, index) => {
          const step = (index + 1) as CreateResumeStep

          return (
            <button
              key={label}
              type="button"
              className={step === createResumeStep ? 'active' : step < createResumeStep ? 'done' : ''}
              onClick={() => setCreateResumeStep(step)}
            >
              <strong>{step}</strong>
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      <div className="resume-builder-layout">
        <div className="resume-builder-main">
          {createResumeStep === 1 && (
            <div className="resume-section-card">
              <h3>Выберите профессию</h3>
              <p className="hint">Профессия берётся из справочника backend и выбирается через поиск.</p>
              <SearchableSelect
                label="Профессия"
                placeholder="Выберите профессию"
                searchPlaceholder="Начните вводить профессию"
                items={professionsQuery.data ?? []}
                selectedId={resumeForm.professionId}
                selectedLabel={selectedProfession?.name}
                onSelect={(item) => setResumeForm((prev) => ({ ...prev, professionId: String(item.id) }))}
                loading={professionsQuery.isLoading}
              />
              {selectedProfession && (
                <div className="selected-summary-card">
                  <span>Специализация резюме</span>
                  <strong>{selectedProfession.name}</strong>
                  <p>Именно по этой профессии будут отправляться отклики и строиться карточка резюме.</p>
                </div>
              )}
            </div>
          )}

          {createResumeStep === 2 && (
            <div className="resume-section-card resume-grid">
              <h3 className="full-span">Контактная информация</h3>
              <p className="hint full-span">Если поменяете эти данные здесь — профиль тоже обновится.</p>
              <label>
                <span className="field-label">Фамилия</span>
                <input
                  className="wizard-input"
                  value={resumeForm.lastName}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, lastName: e.target.value }))}
                />
              </label>
              <label>
                <span className="field-label">Имя</span>
                <input
                  className="wizard-input"
                  value={resumeForm.firstName}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, firstName: e.target.value }))}
                />
              </label>
              <label>
                <span className="field-label">Отчество</span>
                <input
                  className="wizard-input"
                  value={resumeForm.middleName}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, middleName: e.target.value }))}
                />
              </label>
              <label>
                <span className="field-label">Пол</span>
                <select
                  className="wizard-input"
                  value={resumeForm.gender}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="">Не указан</option>
                  <option value="м">Мужской</option>
                  <option value="ж">Женский</option>
                </select>
              </label>
              <SearchableSelect
                label="Город"
                placeholder="Выберите город"
                searchPlaceholder="Начните вводить город"
                items={citiesQuery.data ?? []}
                selectedId={resumeForm.cityId}
                selectedLabel={selectedCity?.name || resumeForm.cityName}
                onSelect={(item) =>
                  setResumeForm((prev) => ({
                    ...prev,
                    cityId: String(item.id),
                    cityName: item.name,
                  }))
                }
                loading={citiesQuery.isLoading}
              />
              <label>
                <span className="field-label">Телефон</span>
                <input
                  className="wizard-input"
                  placeholder="+375..."
                  value={resumeForm.phone}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </label>
              <label>
                <span className="field-label">Дата рождения</span>
                <input
                  className="wizard-input"
                  type="date"
                  value={resumeForm.birthDate}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, birthDate: e.target.value }))}
                />
              </label>
            </div>
          )}

          {createResumeStep === 3 && (
            <div className="resume-section-card">
              <div className="section-headline">
                <div>
                  <h3>Образование</h3>
                  <p className="hint">Можно добавить одно или несколько учебных заведений.</p>
                </div>
                <button
                  type="button"
                  className="secondary-inline-btn"
                  onClick={() =>
                    setResumeForm((prev) => ({
                      ...prev,
                      educations: [...prev.educations, createEmptyEducation()],
                    }))
                  }
                >
                  + Добавить образование
                </button>
              </div>

              <div className="entries-stack">
                {resumeForm.educations.map((education, index) => {
                  const selectedInstitution = educationalInstitutionsQuery.data?.find(
                    (item) => String(item.id) === education.institutionId,
                  )

                  return (
                    <div key={`${education.id ?? 'new'}-${index}`} className="entry-card">
                      <div className="entry-card-head">
                        <strong>Образование {index + 1}</strong>
                        {resumeForm.educations.length > 1 && (
                          <button
                            type="button"
                            className="entry-remove-btn"
                            onClick={() =>
                              setResumeForm((prev) => ({
                                ...prev,
                                educations: prev.educations.filter((_, currentIndex) => currentIndex !== index),
                              }))
                            }
                          >
                            Удалить
                          </button>
                        )}
                      </div>
                      <div className="resume-grid education-grid">
                        <SearchableSelect
                          label="Учебное заведение"
                          placeholder="Выберите учебное заведение"
                          searchPlaceholder="Поиск по справочнику"
                          items={educationalInstitutionsQuery.data ?? []}
                          selectedId={education.institutionId}
                          selectedLabel={selectedInstitution?.name || education.institutionName}
                          onSelect={(item) =>
                            updateEducation(index, (current) => ({
                              ...current,
                              institutionId: String(item.id),
                              institutionName: item.name,
                            }))
                          }
                          loading={educationalInstitutionsQuery.isLoading}
                        />
                        <label>
                          <span className="field-label">Дата начала</span>
                          <input
                            className="wizard-input"
                            type="date"
                            value={education.startDate}
                            onChange={(e) =>
                              updateEducation(index, (current) => ({ ...current, startDate: e.target.value }))
                            }
                          />
                        </label>
                        <label>
                          <span className="field-label">Дата окончания</span>
                          <input
                            className="wizard-input"
                            type="date"
                            disabled={education.isStudyingNow}
                            value={education.endDate}
                            onChange={(e) =>
                              updateEducation(index, (current) => ({ ...current, endDate: e.target.value }))
                            }
                          />
                        </label>
                        <label className="checkbox-row checkbox-row-modern full-span">
                          <input
                            type="checkbox"
                            checked={education.isStudyingNow}
                            onChange={(e) =>
                              updateEducation(index, (current) => ({
                                ...current,
                                isStudyingNow: e.target.checked,
                                endDate: e.target.checked ? '' : current.endDate,
                              }))
                            }
                          />
                          Учусь здесь сейчас
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {createResumeStep === 4 && (
            <div className="resume-section-card">
              <h3>Ключевые навыки</h3>
              <p className="hint">Навыки выбираются из справочника.</p>
              <div className="skills-picker">
                <div className="skills-selected-list skills-selected-list-inline">
                  {(skillsQuery.data ?? []).slice(0, 10).map((skill) => (
                    <button key={skill.id} type="button" className="skill-suggestion" onClick={() => addSkill(skill)}>
                      + {skill.name}
                    </button>
                  ))}
                </div>
                <input
                  className="wizard-input"
                  placeholder="Начните вводить навык"
                  value={resumeForm.skillSearch}
                  onChange={(e) => setResumeForm((prev) => ({ ...prev, skillSearch: e.target.value }))}
                />
                <div className="skills-suggestions">
                  {skillSuggestions.map((skill) => (
                    <button key={skill.id} type="button" className="skill-suggestion" onClick={() => addSkill(skill)}>
                      + {skill.name}
                    </button>
                  ))}
                </div>
                <div className="skills-selected-panel">
                  <div className="skills-selected-head">
                    <strong>Выбранные навыки</strong>
                    <span>{resumeForm.skills.length} шт.</span>
                  </div>
                  <div className="skills-selected-list">
                    {resumeForm.skills.length === 0 && <p className="hint">Добавьте хотя бы один навык.</p>}
                    {resumeForm.skills.map((skill) => (
                      <button key={skill.id} type="button" className="skill-pill" onClick={() => removeSkill(skill.id)}>
                        {skill.name} <span>×</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {createResumeStep === 5 && (
            <div className="resume-section-card">
              <div className="section-headline">
                <div>
                  <h3>Опыт работы</h3>
                  <p className="hint">Можно добавить несколько мест работы сразу.</p>
                </div>
                <button
                  type="button"
                  className="secondary-inline-btn"
                  onClick={() =>
                    setResumeForm((prev) => ({
                      ...prev,
                      workExperiences: [...prev.workExperiences, createEmptyExperience()],
                    }))
                  }
                >
                  + Добавить место работы
                </button>
              </div>

              <div className="entries-stack">
                {resumeForm.workExperiences.map((experience, index) => (
                  <div key={`${experience.companyName}-${index}`} className="entry-card">
                    <div className="entry-card-head">
                      <strong>Место работы {index + 1}</strong>
                      {resumeForm.workExperiences.length > 1 && (
                        <button
                          type="button"
                          className="entry-remove-btn"
                          onClick={() =>
                            setResumeForm((prev) => ({
                              ...prev,
                              workExperiences: prev.workExperiences.filter((_, currentIndex) => currentIndex !== index),
                            }))
                          }
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                    <div className="resume-grid">
                      <label>
                        <span className="field-label">Компания</span>
                        <input
                          className="wizard-input"
                          value={experience.companyName}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({ ...current, companyName: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span className="field-label">Должность</span>
                        <input
                          className="wizard-input"
                          value={experience.position}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({ ...current, position: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span className="field-label">Дата начала</span>
                        <input
                          className="wizard-input"
                          type="date"
                          value={experience.startDate}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({ ...current, startDate: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        <span className="field-label">Дата окончания</span>
                        <input
                          className="wizard-input"
                          type="date"
                          disabled={experience.isCurrentJob}
                          value={experience.endDate}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({ ...current, endDate: e.target.value }))
                          }
                        />
                      </label>
                      <label className="checkbox-row checkbox-row-modern full-span">
                        <input
                          type="checkbox"
                          checked={experience.isCurrentJob}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({
                              ...current,
                              isCurrentJob: e.target.checked,
                              endDate: e.target.checked ? '' : current.endDate,
                            }))
                          }
                        />
                        Работаю здесь сейчас
                      </label>
                      <label className="full-span">
                        <span className="field-label">Обязанности и достижения</span>
                        <textarea
                          className="wizard-input"
                          rows={5}
                          value={experience.description}
                          onChange={(e) =>
                            updateExperience(index, (current) => ({ ...current, description: e.target.value }))
                          }
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside className="resume-builder-sidebar">
          <div className="resume-sidebar-card">
            <p className="sidebar-eyebrow">Черновик резюме</p>
            <h3>Сейчас заполняете: {stepLabels[createResumeStep - 1]}</h3>
            <ul className="resume-checklist">
              {formSummary.map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <div className="wizard-actions">
        <button
          className="ghost"
          onClick={() => setCreateResumeStep((prev) => Math.max(1, prev - 1) as CreateResumeStep)}
          disabled={createResumeStep === 1 || createResumeMutation.isPending}
        >
          Назад
        </button>
        {createResumeStep < 5 ? (
          <button
            onClick={() => setCreateResumeStep((prev) => Math.min(5, prev + 1) as CreateResumeStep)}
            disabled={!currentStepValid}
          >
            Продолжить
          </button>
        ) : (
          <button
            onClick={() => createResumeMutation.mutate()}
            disabled={createResumeMutation.isPending || !currentStepValid}
          >
            {createResumeMutation.isPending ? 'Сохраняем...' : 'Создать резюме'}
          </button>
        )}
      </div>

      {!currentStepValid && <p className="hint">Заполните обязательные поля текущего шага, чтобы перейти дальше.</p>}
      {createResumeMutation.isError && <p className="error-text">{(createResumeMutation.error as Error).message}</p>}
    </section>
  )

  const renderProfileTab = () => (
    <ApplicantCabinet
      profile={profile}
      applicationsCount={applicationsQuery.data?.length ?? 0}
      cities={citiesQuery.data ?? []}
      institutions={educationalInstitutionsQuery.data ?? []}
      profileSaving={saveProfileMutation.isPending}
      educationSaving={saveEducationMutation.isPending}
      educationDeleting={deleteEducationMutation.isPending}
      onOpenVacancies={() => setActiveTab('vacancies')}
      onCreateResume={() => setActiveTab('create-resume')}
      onSaveProfile={async (payload) => {
        await saveProfileMutation.mutateAsync(payload)
      }}
      onSaveEducation={async (payload) => {
        await saveEducationMutation.mutateAsync(payload)
      }}
      onDeleteEducation={async (educationId) => {
        await deleteEducationMutation.mutateAsync(educationId)
      }}
    />
  )

  const renderPlaceholder = (title: string, subtitle: string) => (
    <section className="content-panel placeholder-panel">
      <h3>{title}</h3>
      <p>{subtitle}</p>
    </section>
  )

  const tabContent = () => {
    if (activeTab === 'vacancies' || activeTab === 'search') return renderVacanciesContent()
    if (activeTab === 'resume-profile') return renderResumeProfileTab()
    if (activeTab === 'applications') return renderApplicationsTab()
    if (activeTab === 'help') return renderPlaceholder('Помощь', 'Раздел помощи в разработке.')
    if (activeTab === 'chat') return renderPlaceholder('Чат', 'Чат будет добавлен позже.')
    if (activeTab === 'favorites') return renderPlaceholder('Избранное', 'Список избранных вакансий будет добавлен позже.')
    if (activeTab === 'create-resume') return renderCreateResumeTab()
    if (activeTab === 'profile') return renderProfileTab()
    return renderResumeProfileTab()
  }

  return (
    <div className="applicant-page hh-layout">
      <header className="hh-topbar">
        <div className="left-nav">
          <button
            className={`top-tab ${activeTab === 'resume-profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('resume-profile')}
          >
            Резюме и профиль
          </button>
          <button
            className={`top-tab ${activeTab === 'applications' ? 'active' : ''}`}
            onClick={() => setActiveTab('applications')}
          >
            Отклики
          </button>
          <button className={`top-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')}>
            Сервисы
          </button>
          <button className={`top-tab ${activeTab === 'help' ? 'active' : ''}`} onClick={() => setActiveTab('help')}>
            Помощь
          </button>
        </div>

        <div className="right-nav">
          <button className="icon-btn" onClick={() => setActiveTab('search')}>
            🔎 Поиск
          </button>
          <button className="create-btn" onClick={() => setActiveTab('create-resume')}>
            Создать резюме
          </button>
          <div className="burger-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((prev) => !prev)}>
              ☰
            </button>
            {menuOpen && (
              <div className="burger-menu">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setActiveTab('profile')
                  }}
                >
                  Открыть профиль
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setActiveTab('vacancies')
                  }}
                >
                  Вакансии
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    logoutMutation.mutate()
                  }}
                >
                  Выйти из аккаунта
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="hh-content">
        {saveProfileMutation.isError && <p className="error-text">{(saveProfileMutation.error as Error).message}</p>}
        {saveEducationMutation.isError && <p className="error-text">{(saveEducationMutation.error as Error).message}</p>}
        {deleteEducationMutation.isError && <p className="error-text">{(deleteEducationMutation.error as Error).message}</p>}
        {tabContent()}
      </main>
    </div>
  )
} 